"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Booking } from "@/lib/booking-types";
import { ApiClientError, apiFetch, errorMessage } from "@/lib/api-client";

export function useBooking(id: string) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    apiFetch<{ data: Booking }>(`/api/bookings/${id}`, { signal: controller.signal })
      .then((res) => setBooking(res.data))
      .catch((err) => {
        if (controller.signal.aborted) return;
        const message = errorMessage(err);
        setError({ message, notFound: err instanceof ApiClientError && err.status === 404 });
        toast.error(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id, token]);

  const reload = useCallback(() => setToken((n) => n + 1), []);
  return { booking, loading, error, reload };
}