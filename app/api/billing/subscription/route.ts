import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, readJson, withErrorHandling } from "@/lib/api-error";
import { withTransaction } from "@/lib/db";
import { getTenantId } from "@/lib/tenant";
import { PLAN_KEYS } from "@/lib/plans";
import { priceIdForPlan, stripe } from "@/lib/stripe";
import { getSubscriptionRow, mapSubscription, syncSubscription } from "@/lib/billing";
import { isLive } from "@/lib/billing-types";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    plan: z.enum(PLAN_KEYS).optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
  })
  .refine((d) => d.plan !== undefined || d.cancelAtPeriodEnd !== undefined, {
    message: "Provide plan or cancelAtPeriodEnd",
  });

/**
 * PATCH /api/billing/subscription
 *   { "plan": "business" }            upgrade or downgrade
 *   { "cancelAtPeriodEnd": true }     cancel at the end of the period (false = resume)
 * Safe to repeat: asking for the plan you already have changes nothing.
 */
export const PATCH = withErrorHandling(async (req) => {
  const body = bodySchema.parse(await readJson(req));
  const tenantId = await getTenantId();

  const row = await getSubscriptionRow(tenantId);
  if (!row || !isLive(row.status)) {
    throw new ApiError(409, "NO_ACTIVE_SUBSCRIPTION", "You don't have an active subscription. Subscribe from the pricing page.");
  }

  if (body.plan && body.plan !== row.plan) {
    const current = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
    const itemId = current.items.data[0]?.id;
    if (!itemId) throw new ApiError(500, "SUBSCRIPTION_INVALID", "Subscription has no items.");

    // always_invoice: charge (upgrade) or credit (downgrade) the difference right away.
    await stripe.subscriptions.update(row.stripe_subscription_id, {
      items: [{ id: itemId, price: priceIdForPlan(body.plan) }],
      proration_behavior: "always_invoice",
    });
  }

  if (body.cancelAtPeriodEnd !== undefined) {
    await stripe.subscriptions.update(row.stripe_subscription_id, {
      cancel_at_period_end: body.cancelAtPeriodEnd,
    });
  }

  // Save the new state right now so the UI is correct immediately.
  // The webhook will later arrive with the same state and change nothing.
  await withTransaction((client) => syncSubscription(client, row.stripe_subscription_id, tenantId));

  const fresh = await getSubscriptionRow(tenantId);
  return NextResponse.json({ data: fresh ? mapSubscription(fresh) : null });
});