"use client";

import { useCallback, useEffect, useState } from "react";
import type { TxStatus } from "@/lib/counter";
import {
  DONATION_CONTRACT_ID,
  donate,
  fetchDonationEvents,
  readDonationStats,
  type DonationEventRecord,
  type DonationStats,
} from "@/lib/donation";
import { mapStellarError, type MappedError } from "@/lib/errors";
import { explorerTxUrl } from "@/lib/stellar";
import { signWithWallet, type WalletConnection } from "@/lib/wallets";

const STATUS_LABELS: Record<TxStatus, string> = {
  idle: "",
  building: "⏳ İşlem hazırlanıyor...",
  signing: "✍️ Cüzdan imzası bekleniyor...",
  pending: "🔄 İşlem zincirde onay bekliyor (pending)...",
  success: "✅ Başarılı (success)",
  failed: "❌ Başarısız (failed)",
};

function formatXlm(value: string): string {
  return Number(value).toLocaleString("tr-TR", { maximumFractionDigits: 7 });
}

export function TipJarPanel({ connection }: { connection: WalletConnection }) {
  const [stats, setStats] = useState<DonationStats | null>(null);
  const [events, setEvents] = useState<DonationEventRecord[] | null>(null);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<TxStatus>("idle");
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [error, setError] = useState<MappedError | null>(null);

  const refresh = useCallback(() => {
    return Promise.all([readDonationStats(connection.publicKey), fetchDonationEvents(5)])
      .then(([nextStats, nextEvents]) => {
        setStats(nextStats);
        setEvents(nextEvents);
        setError(null);
      })
      .catch((err) => {
        setError(mapStellarError(err));
      });
  }, [connection.publicKey]);

  useEffect(() => {
    // Gerçek zamanlı senkronizasyon: kontrat event'lerini periyodik çek
    const interval = setInterval(refresh, 12_000);
    refresh();
    return () => clearInterval(interval);
  }, [refresh]);

  async function handleDonate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLastHash(null);
    try {
      const result = await donate({
        sourcePublicKey: connection.publicKey,
        amountXlm: amount,
        signTransaction: (xdr) => signWithWallet(connection, xdr),
        onStatus: setStatus,
      });
      setLastHash(result.hash);
      setAmount("");
      refresh();
    } catch (err) {
      setStatus("failed");
      setError(mapStellarError(err));
    }
  }

  const busy = status === "building" || status === "signing" || status === "pending";
  const loading = stats === null && error === null;

  return (
    <div className="rounded-2xl border border-amber-700/50 bg-amber-950/15 p-4 sm:p-6">
      <h2 className="text-sm font-medium uppercase tracking-wide text-amber-400">
        Bağış Kavanozu (Tip Jar) — Inter-Contract dApp
      </h2>
      <p className="mt-2 text-xs text-slate-400">
        Bağışlar, bu proje için yazılan <code className="text-amber-300">donation</code>{" "}
        kontratının XLM token kontratına (SAC) yaptığı{" "}
        <strong className="text-amber-200">cross-contract transfer</strong> çağrısıyla
        tahsil edilir. Kaynak: <code className="text-amber-300">contracts/donation</code>
      </p>
      <a
        href={`https://stellar.expert/explorer/testnet/contract/${DONATION_CONTRACT_ID}`}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-block break-all font-mono text-[10px] text-slate-500 underline hover:text-slate-400"
      >
        {DONATION_CONTRACT_ID}
      </a>

      {loading ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="yükleniyor">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-800/60" />
          ))}
        </div>
      ) : (
        stats && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-amber-500/30 bg-slate-950 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Toplam Bağış</p>
              <p className="text-xl font-semibold text-white">
                {formatXlm(stats.totalXlm)} <span className="text-sm text-slate-400">XLM</span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Bağış Sayısı</p>
              <p className="text-xl font-semibold text-white">{stats.count}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Senin Bağışın</p>
              <p className="text-xl font-semibold text-white">
                {formatXlm(stats.donorTotalXlm)}{" "}
                <span className="text-sm text-slate-400">XLM</span>
              </p>
            </div>
          </div>
        )
      )}

      <form onSubmit={handleDonate} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-sm text-slate-300">
          Bağış Tutarı (XLM)
          <input
            required
            type="number"
            min="0.0000001"
            step="0.0000001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="10"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-amber-500 px-6 py-2 font-medium text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? "İşleniyor..." : "Bağış Yap 💛"}
        </button>
      </form>

      {status !== "idle" && (
        <p
          className={`mt-3 text-sm ${
            status === "success"
              ? "text-emerald-400"
              : status === "failed"
                ? "text-rose-400"
                : "text-amber-300"
          }`}
        >
          {STATUS_LABELS[status]}
        </p>
      )}

      {lastHash && (
        <p className="mt-1 break-all font-mono text-xs text-slate-400">
          Tx: {lastHash}{" "}
          <a
            href={explorerTxUrl(lastHash)}
            target="_blank"
            rel="noreferrer"
            className="text-amber-400 underline"
          >
            (görüntüle)
          </a>
        </p>
      )}

      {error && (
        <p className="mt-2 text-sm text-rose-400">
          <span className="font-mono text-xs text-rose-500">[{error.type}]</span>{" "}
          {error.message}
        </p>
      )}

      <div className="mt-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Bağış Olayları (Donation)
        </h3>
        {events === null ? (
          <div className="mt-2 space-y-2" aria-label="yükleniyor">
            {[0, 1].map((i) => (
              <div key={i} className="h-4 w-2/3 animate-pulse rounded bg-slate-800/60" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Son pencerede bağış olayı yok.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {events.map((event) => (
              <li key={event.id} className="text-xs text-slate-400">
                <span className="text-amber-300">+{formatXlm(event.amountXlm)} XLM</span>{" "}
                <span className="text-slate-500">
                  bağışçı: {event.donor.slice(0, 6)}...{event.donor.slice(-6)} · toplam:{" "}
                  {formatXlm(event.totalXlm)} XLM · ledger {event.ledger}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
