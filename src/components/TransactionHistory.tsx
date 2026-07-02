"use client";

import { useEffect, useState } from "react";
import { explorerTxUrl, fetchRecentPayments, type PaymentRecord } from "@/lib/stellar";

export function TransactionHistory({
  publicKey,
  refreshSignal,
}: {
  publicKey: string;
  refreshSignal: number;
}) {
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRecentPayments(publicKey)
      .then((records) => {
        if (!cancelled) {
          setPayments(records);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPayments([]);
          setError(err instanceof Error ? err.message : "Geçmiş yüklenemedi");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey, refreshSignal]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">
        İşlem Geçmişi
      </h2>

      {payments === null && !error && (
        <p className="mt-3 text-slate-400">Yükleniyor...</p>
      )}

      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

      {payments && payments.length === 0 && !error && (
        <p className="mt-3 text-sm text-slate-400">Henüz işlem yok.</p>
      )}

      {payments && payments.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-800">
          {payments.map((payment) => {
            const isOutgoing = payment.from === publicKey;
            return (
              <li key={payment.id} className="flex items-center justify-between py-3">
                <div className="flex flex-col">
                  <span
                    className={`text-sm font-medium ${
                      isOutgoing ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {isOutgoing ? "Gönderildi" : "Alındı"} · {payment.amount} {payment.asset}
                  </span>
                  <span className="text-xs text-slate-500">
                    {isOutgoing ? `Alıcı: ${truncate(payment.to)}` : `Gönderen: ${truncate(payment.from)}`}
                  </span>
                  <span className="text-xs text-slate-600">
                    {new Date(payment.createdAt).toLocaleString("tr-TR")}
                  </span>
                </div>
                <a
                  href={explorerTxUrl(payment.transactionHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
                >
                  Görüntüle
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function truncate(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}
