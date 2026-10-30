import { BillingView } from "@/components/billing/billing-view";

export const metadata = { title: "Billing | SaaS Booking" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  return (
    <div className="mx-auto max-w-3xl">
      <BillingView justCheckedOut={checkout === "success"} />
    </div>
  );
}