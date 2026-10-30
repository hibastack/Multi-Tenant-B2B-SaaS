import type { PoolClient } from "pg";
import type Stripe from "stripe";
import { pool } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import { planForPriceId, stripe } from "@/lib/stripe";
import type { Invoice, Subscription } from "@/lib/billing-types";

type Db = Pick<PoolClient, "query">;

export type SubscriptionRow = {
  tenant_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  plan: string;
  status: string;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
};

export type InvoiceRow = {
  stripe_invoice_id: string;
  number: string | null;
  status: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  created_at: Date;
};

export function mapSubscription(r: SubscriptionRow): Subscription {
  return {
    plan: r.plan,
    status: r.status,
    currentPeriodEnd: r.current_period_end ? r.current_period_end.toISOString() : null,
    cancelAtPeriodEnd: r.cancel_at_period_end,
  };
}

export function mapInvoice(r: InvoiceRow): Invoice {
  return {
    id: r.stripe_invoice_id,
    number: r.number,
    status: r.status,
    amountDue: r.amount_due,
    amountPaid: r.amount_paid,
    currency: r.currency,
    hostedInvoiceUrl: r.hosted_invoice_url,
    invoicePdf: r.invoice_pdf,
    createdAt: r.created_at.toISOString(),
  };
}

export async function getSubscriptionRow(tenantId: string): Promise<SubscriptionRow | null> {
  const { rows } = await pool.query<SubscriptionRow>("select * from subscriptions where tenant_id = $1", [tenantId]);
  return rows[0] ?? null;
}

/** Returns the tenant's Stripe customer id, creating the customer the first time. */
export async function getOrCreateCustomer(tenantId: string): Promise<string> {
  const { rows } = await pool.query<{ name: string; stripe_customer_id: string | null }>(
    "select name, stripe_customer_id from tenants where id = $1",
    [tenantId],
  );
  const tenant = rows[0];
  if (!tenant) throw new ApiError(404, "TENANT_NOT_FOUND", "Tenant not found.");
  if (tenant.stripe_customer_id) return tenant.stripe_customer_id;

  // The idempotency key means two simultaneous clicks still create only one customer.
  const customer = await stripe.customers.create(
    { name: tenant.name, metadata: { tenant_id: tenantId } },
    { idempotencyKey: `customer-${tenantId}` },
  );
  const saved = await pool.query<{ stripe_customer_id: string }>(
    `update tenants set stripe_customer_id = coalesce(stripe_customer_id, $2)
      where id = $1 returning stripe_customer_id`,
    [tenantId, customer.id],
  );
  return saved.rows[0].stripe_customer_id;
}

async function tenantIdForCustomer(db: Db, customerId: string): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>("select id from tenants where stripe_customer_id = $1", [customerId]);
  return rows[0]?.id ?? null;
}

/** Links a Stripe customer to a tenant (used when checkout completes). */
export async function linkCustomer(db: Db, tenantId: string, customerId: string) {
  await db.query("update tenants set stripe_customer_id = $2 where id = $1 and stripe_customer_id is null", [
    tenantId,
    customerId,
  ]);
}

// Stripe's newer API versions keep the billing period on the subscription item.
function periodEnd(sub: Stripe.Subscription): Date | null {
  const s = sub as unknown as {
    current_period_end?: number;
    items?: { data?: { current_period_end?: number }[] };
  };
  const ts = s.items?.data?.[0]?.current_period_end ?? s.current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

/**
 * Fetches the LATEST state of a subscription from Stripe and saves it.
 * Webhooks can arrive late or out of order, so we never trust the event's copy:
 * the event only tells us "something changed", then we go and look.
 */
export async function syncSubscription(db: Db, subscriptionId: string, tenantHint?: string | null) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const tenantId = (await tenantIdForCustomer(db, customerId)) ?? tenantHint ?? sub.metadata?.tenant_id ?? null;
  if (!tenantId) {
    console.warn(`[stripe] subscription ${subscriptionId} does not belong to any tenant, ignoring`);
    return null;
  }

  const priceId = sub.items.data[0]?.price.id ?? "";
  const plan = planForPriceId(priceId) ?? "unknown";

  // The WHERE clause stops a late event of an OLD, cancelled subscription
  // from overwriting the tenant's NEW subscription.
  await db.query(
    `insert into subscriptions
       (tenant_id, stripe_subscription_id, stripe_price_id, plan, status, current_period_end, cancel_at_period_end, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, now())
     on conflict (tenant_id) do update set
       stripe_subscription_id = excluded.stripe_subscription_id,
       stripe_price_id        = excluded.stripe_price_id,
       plan                   = excluded.plan,
       status                 = excluded.status,
       current_period_end     = excluded.current_period_end,
       cancel_at_period_end   = excluded.cancel_at_period_end,
       updated_at             = now()
     where subscriptions.stripe_subscription_id = excluded.stripe_subscription_id
        or subscriptions.status in ('canceled', 'incomplete_expired')`,
    [tenantId, sub.id, priceId, plan, sub.status, periodEnd(sub), sub.cancel_at_period_end],
  );
  return tenantId;
}

/** Fetches the latest copy of an invoice from Stripe and saves it for the billing history. */
export async function syncInvoice(db: Db, invoiceId: string) {
  const inv = await stripe.invoices.retrieve(invoiceId);
  const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
  if (!customerId) return null;
  const tenantId = await tenantIdForCustomer(db, customerId);
  if (!tenantId) return null;

  const status = inv.status ?? "draft";
  if (status === "draft") return tenantId; // drafts are not shown to customers

  await db.query(
    `insert into invoices
       (stripe_invoice_id, tenant_id, number, status, amount_due, amount_paid, currency,
        hosted_invoice_url, invoice_pdf, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     on conflict (stripe_invoice_id) do update set
       number             = excluded.number,
       status             = excluded.status,
       amount_due         = excluded.amount_due,
       amount_paid        = excluded.amount_paid,
       hosted_invoice_url = excluded.hosted_invoice_url,
       invoice_pdf        = excluded.invoice_pdf,
       updated_at         = now()`,
    [
      invoiceId,
      tenantId,
      inv.number ?? null,
      status,
      inv.amount_due,
      inv.amount_paid,
      inv.currency,
      inv.hosted_invoice_url ?? null,
      inv.invoice_pdf ?? null,
      new Date(inv.created * 1000),
    ],
  );
  return tenantId;
}