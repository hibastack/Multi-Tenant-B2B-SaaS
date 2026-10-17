"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { BOOKING_STATUSES, STATUS_LABELS, type Booking } from "@/lib/booking-types";
import { ApiClientError, apiFetch, errorMessage } from "@/lib/api-client";
import { formatDuration, minutesBetween, toLocalInput } from "@/lib/dates";
import { btnPrimary, btnSecondary, cardClass, inputClass } from "@/components/ui";

const formSchema = z
  .object({
    customerName: z.string().trim().min(2, "Enter the customer's name (at least 2 characters)").max(100),
    customerEmail: z.string().trim().email("Enter a valid email address"),
    service: z.string().trim().min(2, "Enter the service (at least 2 characters)").max(100),
    startsAt: z.string().min(1, "Pick a start date and time"),
    durationMinutes: z.string().min(1),
    status: z.enum(BOOKING_STATUSES),
    notes: z.string().max(1000, "Notes must be 1000 characters or fewer"),
  })
  .refine((d) => !Number.isNaN(new Date(d.startsAt).getTime()), {
    path: ["startsAt"],
    message: "Pick a valid date and time",
  });

type FormValues = z.infer<typeof formSchema>;

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];

const FIELD_FOR_PATH: Record<string, keyof FormValues> = {
  customerName: "customerName",
  customerEmail: "customerEmail",
  service: "service",
  startsAt: "startsAt",
  endsAt: "durationMinutes",
  notes: "notes",
  status: "status",
};

type Props = { booking?: Booking };

export function BookingForm({ booking }: Props) {
  const router = useRouter();
  const isEdit = Boolean(booking);

  // Network drop par wahi key dobara use hoti hai (duplicate booking nahi banti).
  const idempotencyKey = useRef(crypto.randomUUID());
  const [submitError, setSubmitError] = useState<string | null>(null);

  const currentDuration = booking ? minutesBetween(booking.startsAt, booking.endsAt) : 60;
  const durationOptions = DURATIONS.includes(currentDuration)
    ? DURATIONS
    : [...DURATIONS, currentDuration].sort((a, b) => a - b);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: booking?.customerName ?? "",
      customerEmail: booking?.customerEmail ?? "",
      service: booking?.service ?? "",
      startsAt: booking ? toLocalInput(booking.startsAt) : "",
      durationMinutes: String(currentDuration),
      status: booking?.status ?? "scheduled",
      notes: booking?.notes ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    const start = new Date(values.startsAt);
    const end = new Date(start.getTime() + Number(values.durationMinutes) * 60_000);
    const payload = {
      customerName: values.customerName,
      customerEmail: values.customerEmail,
      service: values.service,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      notes: values.notes.trim(),
    };

    try {
      const res = booking
        ? await apiFetch<{ data: Booking }>(`/api/bookings/${booking.id}`, {
            method: "PATCH",
            body: { ...payload, status: values.status },
          })
        : await apiFetch<{ data: Booking }>("/api/bookings", {
            method: "POST",
            body: payload.notes ? payload : { ...payload, notes: undefined },
            idempotencyKey: idempotencyKey.current,
          });

      toast.success(isEdit ? "Booking updated" : "Booking created");
      router.push(`/bookings/${res.data.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.isServerResponse) {
        idempotencyKey.current = crypto.randomUUID();

        if (err.code === "VALIDATION_ERROR" && Array.isArray(err.details)) {
          for (const issue of err.details as { path: string; message: string }[]) {
            const field = FIELD_FOR_PATH[issue.path];
            if (field) setError(field, { message: issue.message });
          }
        }
      }
      const message = errorMessage(err);
      setSubmitError(message);
      toast.error(message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className={`${cardClass} space-y-5`}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Customer name" error={errors.customerName?.message}>
          <input {...register("customerName")} className={inputClass} placeholder="Maryam Ali" autoComplete="off" />
        </Field>
        <Field label="Customer email" error={errors.customerEmail?.message}>
          <input {...register("customerEmail")} type="email" className={inputClass} placeholder="maryam@example.com" autoComplete="off" />
        </Field>
      </div>

      <Field label="Service" error={errors.service?.message}>
        <input {...register("service")} className={inputClass} placeholder="Haircut & Styling" />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Start" error={errors.startsAt?.message}>
          <input {...register("startsAt")} type="datetime-local" className={inputClass} />
        </Field>
        <Field label="Duration" error={errors.durationMinutes?.message}>
          <select {...register("durationMinutes")} className={inputClass}>
            {durationOptions.map((m) => (
              <option key={m} value={m}>
                {formatDuration(m)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {isEdit && (
        <Field label="Status" error={errors.status?.message}>
          <select {...register("status")} className={inputClass}>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Notes (optional)" error={errors.notes?.message}>
        <textarea {...register("notes")} rows={3} className={inputClass} placeholder="Anything the team should know" />
      </Field>

      {submitError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {submitError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href={booking ? `/bookings/${booking.id}` : "/bookings"} className={btnSecondary}>
          Cancel
        </Link>
        <button type="submit" className={btnPrimary} disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : isEdit ? "Save changes" : "Create booking"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      {children}
      {error && (
        <span role="alert" className="mt-1 block text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </label>
  );
}