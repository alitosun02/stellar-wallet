"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { usePaymentStream } from "@/hooks/usePaymentStream";
import { explorerAccountUrl } from "@/lib/stellar";
import { WALLET_LABELS, type WalletConnection } from "@/lib/wallets";
import { BalanceCard } from "./BalanceCard";
import { ContractPanel } from "./ContractPanel";
import { CopyField } from "./CopyField";
import { DisclaimerBanner } from "./DisclaimerBanner";
import { LivePaymentToast, LiveStatusDot } from "./LiveActivity";
import { SendPaymentForm } from "./SendPaymentForm";
import { TransactionHistory } from "./TransactionHistory";

export function WalletDashboard({ connection }: { connection: WalletConnection }) {
  const { clearConnection } = useWallet();
  const [refreshSignal, setRefreshSignal] = useState(0);
  const bumpRefresh = useCallback(() => setRefreshSignal((n) => n + 1), []);

  // Gerçek zamanlı senkronizasyon: Horizon SSE akışından yeni bir ödeme
  // geldiğinde bakiye ve geçmiş otomatik yenilenir.
  const { connected, latestEvent } = usePaymentStream(connection.publicKey, bumpRefresh);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white">Stellar Wallet</h1>
            <span className="rounded-full border border-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-300">
              {WALLET_LABELS[connection.kind]}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-4">
            <a
              href={explorerAccountUrl(connection.publicKey)}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-cyan-400 hover:text-cyan-300"
            >
              Hesabı Stellar Expert&apos;te görüntüle
            </a>
            <LiveStatusDot connected={connected} />
          </div>
        </div>
        <button
          type="button"
          onClick={clearConnection}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
        >
          Bağlantıyı Kes (Disconnect)
        </button>
      </div>

      <DisclaimerBanner />

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex flex-col gap-4">
          <CopyField label="Public Key (Adres)" value={connection.publicKey} />
          {connection.kind === "local" && connection.secretKey && (
            <CopyField
              label="Secret Key (Gizli Anahtar)"
              value={connection.secretKey}
              masked
            />
          )}
        </div>
      </div>

      <BalanceCard
        publicKey={connection.publicKey}
        refreshSignal={refreshSignal}
        onFunded={bumpRefresh}
      />

      <SendPaymentForm connection={connection} onSent={bumpRefresh} />

      <ContractPanel connection={connection} onTransferred={bumpRefresh} />

      <TransactionHistory publicKey={connection.publicKey} refreshSignal={refreshSignal} />

      <LivePaymentToast event={latestEvent} />
    </div>
  );
}
