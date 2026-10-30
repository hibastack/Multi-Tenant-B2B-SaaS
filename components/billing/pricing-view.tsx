"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { isLive } from "@/lib/billing-types";
import { PLANS, PLAN_RANK, isPlanKey, planLabel, type PlanInfo, type PlanKey } from "@/lib/plans";
import { useBilling } from "@/components/billing/use-billing";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ErrorState, Spinner, btnPrimary, btnSecondary, cardClass } from "@/components/ui";

export function PricingView({ canceled }: { canceled: boolean }) {
  const router = useRouter();
  const { summary, loading, error, reload } = useBilling();
  const [busyPlan, setBusyPlan] = useState<PlanKey | null>(null);
  const [pendingChange, setPendingChange] = useState<PlanKey | null>(null);

  useEffect(() => {
    if (canceled) toast("Checkout canceled. You were not charged.", { id: "checkout-canceled" });
  }, [canceled]);

  const sub = summary?.subscription ?? null;
  const live = sub && isLive(sub.status) ? sub : null;
  const currentRank = live && isPlanKey(live.plan) ? PLAN_RANK[live.plan] : 0;

  async function startCheckout(plan: PlanKey) {
    setBusyPlan(plan);
    try {
      const res = await apiFetch<{ data: { url: string } }>("/api/billing/checkout", {
        method: "POST",
        body: { plan },
        idempotencyKey: crypto.randomUUID(),
      });
      window.location.assign(res.data.url); // off to Stripe's hosted checkout page
    } catch (err) {
      toast.error(errorMessage(err));
      setBusyPlan(null);
    }
  }

  async function changePlan(plan: PlanKey) {
    setBusyPlan(plan);
    try {
      await apiFetch<unknown>("/api/billing/subscription", { method: "PATCH", body: { plan } });
      toast.success(`Switched to the ${planLabel(plan)} plan`);
      setPendingChange(null);
      router.push("/billing");
    } catch (err) {
      toast.error(errorMessage(err));
      setBusyPlan(null);
      setPendingChange(null);
    }
  }

  function action(plan: PlanInfo): { label: string; disabled: boolean; onClick: () => void } {
    if (!live) return { label: "Subscribe", disabled: false, onClick: () => startCheckout(plan.key) };
    if (live.plan === plan.key) return { label: "Current plan", disabled: true, onClick: () => undefined };
    const label = PLAN_RANK[plan.key] > currentRank ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`;
    return { label, disabled: false, onClick: () => setPendingChange(plan.key) };
  }

  const pendingIsUpgrade = pendingChange ? PLAN_RANK[pendingChange] > currentRank : false;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Simple, honest pricing</h1>
        <p className="mt-2 text-zinc-500">Pick a plan. Change or cancel any time.</p>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => reload()} />
      ) : loading ? (
        <Spinner label="Loading plans..." />
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const a = action(plan);
            const isCurrent = live?.plan === plan.key;
            return (
              <div
                key={plan.key}
                className={`${cardClass} flex flex-col ${
                  isCurrent
                    ? "ring-2 ring-emerald-500"
                    : plan.highlighted
                      ? "ring-2 ring-indigo-500"
                      : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{plan.name}</h2>
                  {isCurrent ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      Your plan
                    </span>
                  ) : plan.highlighted ? (
                    <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
                      Most popular
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-zinc-500">{plan.tagline}</p>
                <p className="mt-4">
                  <span className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">${plan.priceMonthly}</span>
                  <span className="text-sm text-zinc-500"> / month</span>
                </p>
                <ul className="mt-6 flex-1 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span aria-hidden className="text-emerald-600">
                        &#10003;
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`${plan.highlighted && !a.disabled ? btnPrimary : btnSecondary} mt-6 w-full`}
                  disabled={a.disabled || busyPlan !== null}
                  onClick={a.onClick}
                >
                  {busyPlan === plan.key ? "Please wait..." : a.label}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={pendingChange !== null}
        tone="primary"
        title={pendingChange ? `Switch to ${planLabel(pendingChange)}?` : ""}
        message={
          pendingIsUpgrade
            ? "The price difference for the rest of this billing period is charged to your card now."
            : "The unused time on your current plan is credited to your account and used on your next invoices."
        }
        confirmLabel="Confirm change"
        busy={busyPlan !== null}
        onConfirm={() => pendingChange && changePlan(pendingChange)}
        onCancel={() => setPendingChange(null)}
      />
    </div>
  );
}