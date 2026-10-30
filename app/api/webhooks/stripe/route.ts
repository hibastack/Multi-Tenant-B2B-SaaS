import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import type Stripe from "stripe";
import { withTransaction } from "@/lib/db";
import { env } from "@/lib/env";
import { ApiError, withErrorHandling } from "@/lib/api-error";
import { stripe } from "@/lib/stripe";
import { linkCustomer, syncInvoice, syncSubscription } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleEvent(client: PoolClient, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || !session.subscription) return;
      const tenantId = session.metadata?.tenant_id ?? session.client_reference_id ?? null;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (tenantId && customerId) await linkCustomer(client, tenantId, customerId);
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      await syncSubscription(client, subscriptionId, tenantId);
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await syncSubscription(client, sub.id);
      return;
    }

    case "invoice.finalized":
    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.voided": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.id) await syncInvoice(client, invoice.id);
      return;
    }

    default:
      return; // events we don't care about
  }
}

export const POST = withErrorHandling(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) throw new ApiError(400, "MISSING_SIGNATURE", "Missing Stripe-Signature header.");

  // The signature is computed over the EXACT raw bytes, so read the body as text, never as parsed JSON.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw new ApiError(400, "INVALID_SIGNATURE", "Webhook signature verification failed.");
  }

  // Claim the event id and process it in ONE transaction:
  //  - already claimed (Stripe retry or duplicate delivery): skip, answer 200
  //  - processing throws: the claim is rolled back, we answer 500, and Stripe retries later
  const outcome = await withTransaction(async (client) => {
    const claim = await client.query(
      "insert into stripe_events (id, type) values ($1, $2) on conflict (id) do nothing returning id",
      [event.id, event.type],
    );
    if (claim.rowCount === 0) return "duplicate";
    await handleEvent(client, event);
    return "processed";
  });

  console.log(`[stripe] ${event.type} ${event.id} -> ${outcome}`);
  return NextResponse.json({ received: true, outcome });
});