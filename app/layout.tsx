@'
import "@/lib/env";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaaS Booking",
  description: "Multi-tenant B2B booking platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
'@ | Set-Content -Encoding utf8 app/layout.tsx

@'
export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">SaaS Booking</h1>
    </main>
  );
}
'@ | Set-Content -Encoding utf8 app/page.tsx

Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev