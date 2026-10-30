import "@/lib/env";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaaS Booking",
  description: "Multi-tenant B2B booking platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/bookings" className="font-semibold text-indigo-600">
              SaaS Booking
            </Link>
            <nav className="flex gap-4 text-sm text-zinc-600 dark:text-zinc-400">
              <Link href="/bookings" className="hover:text-indigo-600">
                Bookings
              </Link>
              <Link href="/pricing" className="hover:text-indigo-600">
                Pricing
              </Link>
              <Link href="/billing" className="hover:text-indigo-600">
                Billing
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        <Toaster richColors closeButton position="top-center" />
      </body>
    </html>
  );
}