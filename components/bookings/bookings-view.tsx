"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Booking } from "@/lib/booking-types";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { dayKey, formatMonth, formatTimeRange } from "@/lib/dates";
import { BookingCalendar } from "@/components/bookings/booking-calendar";
import { ErrorState, Spinner, StatusBadge, btnPrimary, btnSecondary, cardClass } from "@/components/ui";

export function BookingsView() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const from = new Date(month.getFullYear(), month.getMonth(), 1).toISOString();
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString();

    setLoading(true);
    setError(null);
    apiFetch<{ data: Booking[] }>(`/api/bookings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=200`, {
      signal: controller.signal,
    })
      .then((res) => setBookings(res.data))
      .catch((err) => {
        if (controller.signal.aborted) return;
        const message = errorMessage(err);
        setError(message);
        toast.error(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [month, reloadToken]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      const key = dayKey(new Date(b.startsAt));
      map.set(key, [...(map.get(key) ?? []), b]);
    }
    return map;
  }, [bookings]);

  const visible = selectedDay ? (bookingsByDay.get(selectedDay) ?? []) : bookings;
  const heading = selectedDay
    ? new Date(`${selectedDay}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    : `All bookings in ${formatMonth(month)}`;

  const changeMonth = useCallback((delta: number) => {
    setSelectedDay(null);
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Bookings</h1>
          <p className="text-sm text-zinc-500">Pick a day to see its bookings.</p>
        </div>
        <Link href="/bookings/new" className={btnPrimary}>
          + New booking
        </Link>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button type="button" className={btnSecondary} onClick={() => changeMonth(-1)} aria-label="Previous month">
          &larr;<span className="hidden sm:inline">Prev</span>
        </button>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{formatMonth(month)}</h2>
        <button type="button" className={btnSecondary} onClick={() => changeMonth(1)} aria-label="Next month">
          <span className="hidden sm:inline">Next</span>&rarr;
        </button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => setReloadToken((n) => n + 1)} />
      ) : loading ? (
        <Spinner label="Loading bookings..." />
      ) : (
        <>
          <BookingCalendar
            month={month}
            bookingsByDay={bookingsByDay}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />

          <section className={cardClass} aria-live="polite">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{heading}</h3>
              {selectedDay && (
                <button type="button" className="text-sm text-indigo-600 hover:underline" onClick={() => setSelectedDay(null)}>
                  Show whole month
                </button>
              )}
            </div>

            {visible.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">
                No bookings here.{" "}
                <Link href="/bookings/new" className="text-indigo-600 hover:underline">
                  Create one
                </Link>
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {visible.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/bookings/${b.id}`}
                      className="flex flex-col gap-1 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 sm:flex-row sm:items-center sm:justify-between sm:px-2"
                    >
                      <div className="min-w-0">
                        <p className={`truncate font-medium text-zinc-900 dark:text-zinc-100 ${b.status === "cancelled" ? "line-through opacity-60" : ""}`}>
                          {b.customerName}
                        </p>
                        <p className="truncate text-sm text-zinc-500">
                          {b.service}
                          {!selectedDay && ` · ${new Date(b.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 sm:shrink-0">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">{formatTimeRange(b.startsAt, b.endsAt)}</span>
                        <StatusBadge status={b.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}