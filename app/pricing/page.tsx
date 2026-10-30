import { PricingView } from "@/components/billing/pricing-view";

export const metadata = { title: "Pricing | SaaS Booking" };

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  return <PricingView canceled={checkout === "canceled"} />;
}