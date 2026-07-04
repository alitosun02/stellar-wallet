"use client";

import { useEffect, useState } from "react";
import type { LivePaymentEvent } from "@/hooks/usePaymentStream";
import { explorerTxUrl } from "@/lib/stellar";

export function LiveStatusDot({ connected }: { connected: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
      <span
        className={`h-2 w-2 rounded-full ${
          connected ? "animate-pulse bg-emerald-400" : "bg-slate-600"
        }`}
      />
      {connected ? "Canlı akış aktif" : "Akış bağlantısı yok"}
    </span>
  );
}

/** Yeni ödeme geldiğinde birkaç saniyeliğine görünen bildirim. */
export function LivePaymentToast({ event }: { event: LivePaymentEvent | null }) {
  // Görünürlük türetilir: son gizlenen event id'si ile karşılaştırılır.
  const [hiddenEventId, setHiddenEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!event) return;
    const timer = setTimeout(() => setHiddenEventId(event.id), 6000);
    return () => clearTimeout(timer);
  }, [event]);

  if (!event || event.id === hiddenEventId) return null;

  const incoming = event.direction === "in";

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border p-4 shadow-xl backdrop-blur ${
        incoming
          ? "border-emerald-500/40 bg-emerald-950/90"
          : "border-cyan-500/40 bg-cyan-950/90"
      }`}
    >
      <p className={`text-sm font-semibold ${incoming ? "text-emerald-300" : "text-cyan-300"}`}>
        {incoming ? "Ödeme alındı 🎉" : "Ödeme gönderildi ✓"}
      </p>
      <p className="mt-1 text-sm text-slate-200">
        {event.amount} {event.asset}{" "}
        <span className="text-slate-400">
          {incoming ? "gönderen" : "alıcı"}: {event.counterparty.slice(0, 6)}...
          {event.counterparty.slice(-6)}
        </span>
      </p>
      <a
        href={explorerTxUrl(event.transactionHash)}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-block text-xs text-slate-400 underline hover:text-slate-300"
      >
        İşlemi görüntüle
      </a>
    </div>
  );
}
