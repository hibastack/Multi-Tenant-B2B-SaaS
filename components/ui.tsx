import type { BookingStatus } from "@/lib/booking-types";
import { STATUS_LABELS } from "@/lib/booking-types";

export const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 " +
  "focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

const btn =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-60";

export const btnPrimary = `${btn} bg-indigo-600 text-white hover:bg-indigo-500`;
export const btnSecondary = `${btn} border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800`;
export const btnDanger = `${btn} bg-red-600 text-white hover:bg-red-500`;

export const cardClass =
  "rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6";

const statusStyles: Record<BookingStatus, string> = {
  scheduled: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  cancelled: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Spinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-zinc-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={`${cardClass} text-center`} role="alert">
      <p className="font-medium text-red-600 dark:text-red-400">Something went wrong</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
      <button type="button" onClick={onRetry} className={`${btnSecondary} mt-4`}>
        Try again
      </button>
    </div>
  );
}