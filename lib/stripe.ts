import Stripe from "stripe";
import { env } from "@/lib/env";
import { PLAN_KEYS, type PlanKey } from "@/lib/plans";

const globalForStripe = globalThis as unknown as { stripe?: Stripe };

export const stripe = globalForStripe.stripe ?? new Stripe(env.STRIPE_SECRET_KEY);

if (env.NODE_ENV !== "production") globalForStripe.stripe = stripe;

const PRICE_BY_PLAN: Record<PlanKey, string> = {
  starter: env.STRIPE_PRICE_STARTER,
  pro: env.STRIPE_PRICE_PRO,
  business: env.STRIPE_PRICE_BUSINESS,
};

export function priceIdForPlan(plan: PlanKey): string {
  return PRICE_BY_PLAN[plan];
}

export function planForPriceId(priceId: string): PlanKey | null {
  return PLAN_KEYS.find((key) => PRICE_BY_PLAN[key] === priceId) ?? null;
}