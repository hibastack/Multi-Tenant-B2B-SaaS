export type Subscription = {
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type Invoice = {
  id: string;
  number: string | null;
  status: string;
  amountDue: number; // in cents
  amountPaid: number; // in cents
  currency: string;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  createdAt: string;
};

export type BillingSummary = {
  subscription: Subscription | null;
  invoices: Invoice[];
};

/** Statuses in which the customer still has access to the product. */
export const LIVE_STATUSES = ["active", "trialing", "past_due"];

export function isLive(status: string): boolean {
  return LIVE_STATUSES.includes(status);
}

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}