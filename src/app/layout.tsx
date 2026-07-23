import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FanFuel — Goal-based creator funding on Stellar",
  description:
    "Fund creators in seconds with on-chain escrow. Goal-based campaigns on Stellar: reach the goal and the creator withdraws, miss it and every supporter claims a full refund.",
  openGraph: {
    title: "FanFuel — Goal-based creator funding on Stellar",
    description:
      "Goal-based crowdfunding with on-chain escrow and automatic refunds, built on Stellar.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-slate-950 text-slate-100">
        <AppShell>{children}</AppShell>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
