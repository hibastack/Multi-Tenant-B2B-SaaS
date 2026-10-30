"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/dates";
import { planLabel } from "@/lib/plans";
import { formatMoney, isLive } from "@/lib/billing-types";
import { useBilling } from "@/components/billing/use-billing";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ErrorState, Spinner, btnPrimary, btnSecondary, cardClass } from "@/components/ui";

const bannerStyles = {
  info: "bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  success: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  warning: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  danger: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
};

function Banner({ tone, children }: { tone: keyof typeof bannerStyles; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={`flex flex-col gap-3 rounded-xl px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${bannerStyles[tone]}`}
    >
      {children}
    </div>
  );
}

const invoiceStyles: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  open: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  uncollectible: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  void: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function InvoiceBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${invoiceStyles[status] ?? invoiceStyles.void}`}>
      {status}
    </span>
  );
}

export function BillingView({ justCheckedOut }: { justCheckedOut: boolean }) {
  const { summary, loading, error, waiting, timedOut, reload } = useBilling(justCheckedOut);
  const [busy, setBusy] = useState<"portal" | "cancel" | "resume" | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function openPortal() {
    setBusy("portal");
    try {
      const res = await apiFetch<{ data: { url: string } }>("/api/billing/portal", { method: "POST" });
      window.location.assign(res.data.url);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(null);
    }
  }

  async function setCancel(cancel: boolean) {
    setBusy(cancel ? "cancel" : "resume");
    try {
      await apiFetch<unknown>("/api/billing/subscription", { method: "PATCH", body: { cancelAtPeriodEnd: cancel } });
      toast.success(cancel ? "Your plan will end at the end of this billing period" : "Welcome back! Your plan will continue");
      await reload(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
      setConfirmCancel(false);
    }
  }

  if (loading) return <Spinner label="Loading billing..." />;
  if (error && !summary) return <ErrorState message={error} onRetry={() => reload()} />;

  const sub = summary?.subscription ?? null;
  const invoices = summary?.invoices ?? [];
  const live = sub !== null && isLive(sub.status);
  const pastDue = sub !== null && (sub.status === "past_due" || sub.status === "unpaid");
  const endDate = sub?.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : "the end of the period";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Billing</h1>

      {waiting && (
        <Banner tone="info">
          <span className="flex items-center gap-3">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-700" />
            Confirming your payment with Stripe. This usually takes a few seconds...
          </span>
        </Banner>
      )}
      {timedOut && !live && (
        <Banner tone="warning">
          <span>Your payment is taking longer than usual to confirm. It will show up here as soon as it does.</span>
          <button type="button" className={btnSecondary} onClick={() => reload(true)}>
            Check again
          </button>
        </Banner>
      )}
      {justCheckedOut && live && !pastDue && <Banner tone="success">Payment successful. Your plan is active.</Banner>}
      {pastDue && (
        <Banner tone="danger">
          <span>Your last payment failed. Update your payment method to keep your plan.</span>
          <button type="button" className={btnPrimary} onClick={openPortal} disabled={busy !== null}>
            Update payment method
          </button>
        </Banner>
      )}
      {sub !== null && live && sub.cancelAtPeriodEnd && (
        <Banner tone="warning">
          <span>Your plan is cancelled and ends on {endDate}.</span>
          <button type="button" className={btnSecondary} onClick={() => setCancel(false)} disabled={busy !== null}>
            {busy === "resume" ? "Please wait..." : "Resume plan"}
          </button>
        </Banner>
      )}

      <section className={cardClass}>
        {sub !== null && live ? (
          <>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-zinc-500">Current plan</p>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{planLabel(sub.plan)}</h2>
              </div>
              <span className="w-fit rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium capitalize text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                {sub.status.replace("_", " ")}
              </span>
            </div>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              {sub.cancelAtPeriodEnd ? `Access until ${endDate}.` : `Renews on ${endDate}.`}
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link href="/pricing" className={btnPrimary}>
                Change plan
              </Link>
              <button type="button" className={btnSecondary} onClick={openPortal} disabled={busy !== null}>
                {busy === "portal" ? "Opening..." : "Manage payment method"}
              </button>
              {!sub.cancelAtPeriodEnd && (
                <button
                  type="button"
                  className={`${btnSecondary} sm:ml-auto`}
                  onClick={() => setConfirmCancel(true)}
                  disabled={busy !== null}
                >
                  Cancel plan
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="py-4 text-center">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              {sub ? "Your subscription has ended" : "You're not subscribed yet"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">Pick a plan to unlock your team's workspace.</p>
            <Link href="/pricing" className={`${btnPrimary} mt-4`}>
              See plans
            </Link>
          </div>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Billing history</h2>
        {invoices.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">No invoices yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{inv.number ?? "Invoice"}</p>
                  <p className="text-sm text-zinc-500">{formatDate(inv.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {formatMoney(inv.status === "paid" ? inv.amountPaid : inv.amountDue, inv.currency)}
                  </span>
                  <InvoiceBadge status={inv.status} />
                  {inv.hostedInvoiceUrl && (
                    <a
                      href={inv.hostedInvoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:underline"
                    >
                      View
                    </a>
                  )}
                  {inv.invoicePdf && (
                    <a
                      href={inv.invoicePdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:underline"
                    >
                      PDF
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel your plan?"
        message={`Your plan stays active until ${endDate}. You can resume any time before then.`}
        confirmLabel="Cancel plan"
        busy={busy === "cancel"}
        onConfirm={() => setCancel(true)}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}