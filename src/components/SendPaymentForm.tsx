"use client";

import { useState } from "react";
import { mapStellarError, type MappedError } from "@/lib/errors";
import { buildPaymentTransaction, explorerTxUrl, submitSignedXdr } from "@/lib/stellar";
import { signWithWallet, WALLET_LABELS, type WalletConnection } from "@/lib/wallets";

type PaymentStatus = "idle" | "signing" | "pending" | "success" | "failed";

const STATUS_LABELS: Record<PaymentStatus, string> = {
  idle: "",
  signing: "✍️ Cüzdan imzası bekleniyor...",
  pending: "🔄 İşlem gönderildi, onay bekleniyor (pending)...",
  success: "✅ Başarılı (success)",
  failed: "❌ Başarısız (failed)",
};

export function SendPaymentForm({
  connection,
  onSent,
}: {
  connection: WalletConnection;
  onSent: () => void;
}) {
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [error, setError] = useState<MappedError | null>(null);
  const [successHash, setSuccessHash] = useState<string | null>(null);

  const busy = status === "signing" || status === "pending";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessHash(null);
    try {
      const xdr = await buildPaymentTransaction({
        sourcePublicKey: connection.publicKey,
        destination,
        amount,
        memo: memo || undefined,
      });
      setStatus("signing");
      const signedXdr = await signWithWallet(connection, xdr);
      setStatus("pending");
      const result = await submitSignedXdr(signedXdr);
      setStatus("success");
      setSuccessHash(result.hash);
      setDestination("");
      setAmount("");
      setMemo("");
      onSent();
    } catch (err) {
      setStatus("failed");
      setError(mapStellarError(err));
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">
          Ödeme Gönder
        </h2>
        <span className="text-xs text-slate-500">
          İmza: {WALLET_LABELS[connection.kind]}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Alıcı Adresi
          <input
            required
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="G..."
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-cyan-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Miktar (XLM)
          <input
            required
            type="number"
            min="0.0000001"
            step="0.0000001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="10"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Not (opsiyonel, en fazla 28 karakter)
          <input
            value={memo}
            maxLength={28}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Örn: kahve parası"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="mt-1 rounded-lg bg-cyan-500 px-4 py-2 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
        >
          {busy ? "İşleniyor..." : "Gönder"}
        </button>

        {status !== "idle" && (
          <p
            className={`text-sm ${
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

        {error && (
          <p className="text-sm text-rose-400">
            <span className="font-mono text-xs text-rose-500">[{error.type}]</span>{" "}
            {error.message}
          </p>
        )}

        {successHash && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            <p className="font-medium">✅ İşlem başarılı! (Testnet&apos;e yazıldı)</p>
            <p className="mt-1 break-all font-mono text-xs text-emerald-200/80">
              Hash: {successHash}
            </p>
            <a
              href={explorerTxUrl(successHash)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs underline"
            >
              Stellar Expert&apos;te görüntüle
            </a>
          </div>
        )}
      </form>
    </div>
  );
}
