"use client";

import { toast } from "sonner";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }

  get isServerResponse() {
    return this.status > 0;
  }
}

type FetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  retries?: number;
  signal?: AbortSignal;
};

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const RETRY_TOAST_ID = "api-retry";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, idempotencyKey, retries = 3, signal } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  let attempt = 0;
  try {
    while (true) {
      try {
        const res = await fetch(path, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal,
        });

        if (res.ok) {
          return (res.status === 204 ? undefined : await res.json()) as T;
        }

        const payload = await res.json().catch(() => null);
        const err = new ApiClientError(
          res.status,
          payload?.error?.code ?? "HTTP_ERROR",
          payload?.error?.message ?? `Request failed (${res.status})`,
          payload?.error?.details,
          payload?.error?.requestId,
        );
        if (RETRYABLE_STATUS.has(res.status) && attempt < retries) throw err;
        throw Object.assign(err, { final: true });
      } catch (caught) {
        if (signal?.aborted || (caught instanceof DOMException && caught.name === "AbortError")) throw caught;
        if (caught instanceof ApiClientError && (caught as { final?: boolean }).final) throw caught;

        if (attempt >= retries) {
          if (caught instanceof ApiClientError) throw caught;
          throw new ApiClientError(0, "NETWORK_ERROR", "Can't reach the server. Check your connection and try again.");
        }
        attempt++;
        toast.loading(`Connection problem. Retrying (${attempt}/${retries})...`, { id: RETRY_TOAST_ID });
        await sleep(400 * 2 ** (attempt - 1) + Math.random() * 200);
      }
    }
  } finally {
    if (attempt > 0) toast.dismiss(RETRY_TOAST_ID);
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}