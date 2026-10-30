import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, readJson, withErrorHandling } from "@/lib/api-error";
import { env } from "@/lib/env";
import { getTenantId } from "@/lib/tenant";
import { PLAN_KEYS } from "@/lib/plans";
import { priceIdForPlan, stripe } from "@/lib/stripe";
import { getOrCreateCustomer, getSubscriptionRow } from "@/lib/billing";
import { isLive } from "@/lib/billing-types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ plan: z.enum(PLAN_KEYS) });

/** POST /api/billing/checkout  { "plan": "pro" }  ->  { data: { url } }  (redirect the browser to url) */
export const POST = withErrorHandling(async (req) => {
  const { plan } = bodySchema.parse(await readJson(req));
  const tenantId = await getTenantId();

  const existing = await getSubscriptionRow(tenantId);
  if (existing && isLive(existing.status)) {
    throw new ApiError(409, "ALREADY_SUBSCRIBED", "You already have a subscription. Use plan change instead.");
  }

  const customerId = await getOrCreateCustomer(tenantId);
  const clientKey = req.headers.get("idempotency-key")?.trim();

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
      client_reference_id: tenantId,
      metadata: { tenant_id: tenantId },
      subscription_data: { metadata: { tenant_id: tenantId } },
      success_url: `${env.NEXT_PUBLIC_APP_URL}/billing?checkout=success`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/pricing?checkout=canceled`,
    },
    clientKey ? { idempotencyKey: `checkout-${tenantId}-${clientKey}` } : undefined,
  );

  if (!session.url) throw new ApiError(502, "STRIPE_ERROR", "Stripe did not return a checkout link.");
  return NextResponse.json({ data: { url: session.url } });
});