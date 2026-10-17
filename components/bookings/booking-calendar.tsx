"use client";

import { useMemo } from "react";
import type { Booking } from "@/lib/booking-types";
import { dayKey, formatTime } from "@/lib/dates";

type Props = {
  month: Date;
  bookingsByDay: Map<string, Booking[]>;
  selectedDay: string | null;
  onSelectDay: (key: string | null) => void;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function BookingCalendar({ month, bookingsByDay, selectedDay, onSelectDay }: Props) {
  const todayKey = dayKey(new Date());

  const cells = useMemo(() => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const leading = new Date(year, m, 1).getDay();
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const list: (Date | null)[] = Array.from({ length: leading }, () => null);
    for (let d = 1; d <= daysInMonth; d++) list.push(new Date(year, m, d));
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [month]);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-center text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          if (!date) {
            return <div key={`empty-${i}`} className="min-h-14 border-b border-r border-zinc-100 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-950/40 sm:min-h-28" />;
          }
          const key = dayKey(date);
          const items = bookingsByDay.get(key) ?? [];
          const active = items.filter((b) => b.status !== "cancelled");
          const isToday = key === todayKey;
          const isSelected = key === selectedDay;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(isSelected ? null : key)}
              aria-pressed={isSelected}
              aria-label={`${date.toDateString()}, ${active.length} booking${active.length === 1 ? "" : "s"}`}
              className={`flex min-h-14 flex-col items-stretch border-b border-r border-zinc-100 p-1 text-left transition hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:border-zinc-800 dark:hover:bg-indigo-950/40 sm:min-h-28 sm:p-2 ${
                isSelected ? "bg-indigo-50 dark:bg-indigo-950/50" : ""
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center self-center rounded-full text-xs sm:self-start sm:text-sm ${
                  isToday ? "bg-indigo-600 font-semibold text-white" : "text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {date.getDate()}
              </span>

              {active.length > 0 && (
                <span className="mx-auto mt-1 rounded-full bg-indigo-600 px-1.5 text-[10px] font-semibold text-white sm:hidden">
                  {active.length}
                </span>
              )}
              <div className="mt-1 hidden space-y-1 sm:block">
                {items.slice(0, 2).map((b) => (
                  <div
                    key={b.id}
                    className={`truncate rounded px-1.5 py-0.5 text-xs ${
                      b.status === "cancelled"
                        ? "bg-zinc-100 text-zinc-500 line-through dark:bg-zinc-800"
                        : "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200"
                    }`}
                  >
                    {formatTime(b.startsAt)} {b.customerName}
                  </div>
                ))}
                {items.length > 2 && <div className="px-1 text-xs text-zinc-500">+{items.length - 2} more</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}