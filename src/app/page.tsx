"use client";

import dynamic from "next/dynamic";

// Wallet secrets must never touch server rendering, so the whole wallet UI
// is loaded client-only.
const WalletApp = dynamic(() => import("@/components/WalletApp"), { ssr: false });

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <WalletApp />
    </main>
  );
}
