"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { isLive, type BillingSummary } from "@/lib/billing-types";

/**
 * Loads the billing summary and keeps it fresh.
 *  - refetches whenever the tab becomes visible again
 *  - refetches every 20 seconds, so a webhook-driven change (payment failed,
 *    cancelled from the Stripe portal) shows up without a page reload
 *  - waitForActive: right after checkout, polls every 2 seconds (up to 30s)
 *    until the webhook has made the subscription active
 */
export function useBilling(waitForActive = false) {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const deadline = useRef(waitForActive ? Date.now() + 30_000 : 0);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await apiFetch<{ data: BillingSummary }>("/api/billing");
      setSummary(res.data);
      setError(null);
    } catch (err) {
      if (!silent) {
        const message = errorMessage(err);
        setError(message);
        toast.error(message);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const settled = summary?.subscription ? isLive(summary.subscription.status) : false;
  const waiting = waitForActive && !loading && !settled && !timedOut;

  useEffect(() => {
    if (loading) return;
    const id = setInterval(
      () => {
        if (waiting && Date.now() > deadline.current) {
          setTimedOut(true);
          return;
        }
        void load(true);
      },
      waiting ? 2000 : 20_000,
    );
    return () => clearInterval(id);
  }, [loading, waiting, load]);

  return { summary, loading, error, waiting, timedOut, reload: load };
}