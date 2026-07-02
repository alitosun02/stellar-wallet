"use client";

import { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { explorerAccountUrl } from "@/lib/stellar";
import { BalanceCard } from "./BalanceCard";
import { CopyField } from "./CopyField";
import { DisclaimerBanner } from "./DisclaimerBanner";
import { SendPaymentForm } from "./SendPaymentForm";
import { TransactionHistory } from "./TransactionHistory";

export function WalletDashboard({
  publicKey,
  secretKey,
}: {
  publicKey: string;
  secretKey: string;
}) {
  const { clearWallet } = useWallet();
  const [refreshSignal, setRefreshSignal] = useState(0);
  const bumpRefresh = () => setRefreshSignal((n) => n + 1);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Stellar Wallet</h1>
          <a
            href={explorerAccountUrl(publicKey)}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            Hesabı Stellar Expert&apos;te görüntüle
          </a>
        </div>
        <button
          type="button"
          onClick={clearWallet}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
        >
          Cüzdanı Kapat
        </button>
      </div>

      <DisclaimerBanner />

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex flex-col gap-4">
          <CopyField label="Public Key (Adres)" value={publicKey} />
          <CopyField label="Secret Key (Gizli Anahtar)" value={secretKey} masked />
        </div>
      </div>

      <BalanceCard publicKey={publicKey} refreshSignal={refreshSignal} onFunded={bumpRefresh} />

      <SendPaymentForm secretKey={secretKey} onSent={bumpRefresh} />

      <TransactionHistory publicKey={publicKey} refreshSignal={refreshSignal} />
    </div>
  );
}
