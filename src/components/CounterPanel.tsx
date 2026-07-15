"use client";

import { useCallback, useEffect, useState } from "react";
import {
  COUNTER_CONTRACT_ID,
  explorerContractUrl,
  fetchIncrementEvents,
  incrementCounter,
  readCount,
  type IncrementEventRecord,
  type TxStatus,
} from "@/lib/counter";
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

export function CounterPanel({ connection }: { connection: WalletConnection }) {
  const [count, setCount] = useState<number | null>(null);
  const [events, setEvents] = useState<IncrementEventRecord[]>([]);
  const [status, setStatus] = useState<TxStatus>("idle");
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [error, setError] = useState<MappedError | null>(null);

  const refresh = useCallback(() => {
    return Promise.all([readCount(connection.publicKey), fetchIncrementEvents(5)])
      .then(([current, recentEvents]) => {
        setCount(current);
        setEvents(recentEvents);
        setError(null);
      })
      .catch((err) => {
        setError(mapStellarError(err));
      });
  }, [connection.publicKey]);

  useEffect(() => {
    refresh();
    // Basit event senkronizasyonu: panel açıkken kontrat olaylarını periyodik çek
    const interval = setInterval(refresh, 12_000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function handleIncrement() {
    setError(null);
    setLastHash(null);
    try {
      const result = await incrementCounter({
        sourcePublicKey: connection.publicKey,
        signTransaction: (xdr) => signWithWallet(connection, xdr),
        onStatus: setStatus,
      });
      setLastHash(result.hash);
      setCount(result.newCount);
      refresh();
    } catch (err) {
      setStatus("failed");
      setError(mapStellarError(err));
    }
  }

  const busy = status === "building" || status === "signing" || status === "pending";

  return (
    <div className="rounded-2xl border border-cyan-800/50 bg-cyan-950/20 p-6">
      <h2 className="text-sm font-medium uppercase tracking-wide text-cyan-400">
        Counter dApp — Deploy Ettiğimiz Kontrat
      </h2>
      <p className="mt-2 text-xs text-slate-400">
        Bu panel, bu proje kapsamında yazılıp testnet&apos;e deploy edilen{" "}
        <code className="text-cyan-300">counter</code> kontratıyla konuşur:{" "}
        <code className="text-cyan-300">get_count</code> simulate ile okunur,{" "}
        <code className="text-cyan-300">increment</code> bağlı cüzdanın imzasıyla invoke
        edilir. Kaynak: <code className="text-cyan-300">contracts/counter</code>
      </p>
      <a
        href={explorerContractUrl(COUNTER_CONTRACT_ID)}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-block break-all font-mono text-[10px] text-slate-500 underline hover:text-slate-400"
      >
        {COUNTER_CONTRACT_ID}
      </a>

      <div className="mt-4 flex items-center gap-4">
        <div className="rounded-xl border border-cyan-500/30 bg-slate-950 px-6 py-3 text-center">
          <p className="text-xs uppercase tracking-wide text-slate-500">Sayaç</p>
          <p className="text-3xl font-semibold text-white">{count ?? "—"}</p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleIncrement}
            disabled={busy}
            className="rounded-lg bg-cyan-500 px-4 py-2 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
          >
            {busy ? "İşleniyor..." : "Artır (increment)"}
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={busy}
            className="rounded-lg border border-slate-700 px-4 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
          >
            Yenile
          </button>
        </div>
      </div>

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
            className="text-cyan-400 underline"
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

      {events.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Kontrat Olayları (Increment)
          </h3>
          <ul className="mt-2 space-y-1">
            {events.map((event) => (
              <li key={event.id} className="text-xs text-slate-400">
                <span className="text-cyan-300">count → {event.count}</span>{" "}
                <span className="text-slate-500">
                  çağıran: {event.caller.slice(0, 6)}...{event.caller.slice(-6)} · ledger{" "}
                  {event.ledger}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
