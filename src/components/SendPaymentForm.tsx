"use client";

import { useState } from "react";
import { explorerTxUrl, sendPayment } from "@/lib/stellar";

export function SendPaymentForm({
  secretKey,
  onSent,
}: {
  secretKey: string;
  onSent: () => void;
}) {
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successHash, setSuccessHash] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessHash(null);
    setSubmitting(true);
    try {
      const result = await sendPayment({
        secretKey,
        destination,
        amount,
        memo: memo || undefined,
      });
      setSuccessHash(result.hash);
      setDestination("");
      setAmount("");
      setMemo("");
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem gönderilemedi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">
        Ödeme Gönder
      </h2>

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
          disabled={submitting}
          className="mt-1 rounded-lg bg-cyan-500 px-4 py-2 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
        >
          {submitting ? "Gönderiliyor..." : "Gönder"}
        </button>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        {successHash && (
          <p className="text-sm text-emerald-400">
            İşlem başarılı!{" "}
            <a
              href={explorerTxUrl(successHash)}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Stellar Expert&apos;te görüntüle
            </a>
          </p>
        )}
      </form>
    </div>
  );
}
