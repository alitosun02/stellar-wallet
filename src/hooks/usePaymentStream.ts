"use client";

import { useEffect, useRef, useState } from "react";
import { server } from "@/lib/stellar";

export interface LivePaymentEvent {
  id: string;
  direction: "in" | "out";
  amount: string;
  asset: string;
  counterparty: string;
  transactionHash: string;
  receivedAt: number;
}

/**
 * Horizon'un Server-Sent Events (SSE) akışıyla hesabın payment operasyonlarını
 * gerçek zamanlı dinler. Yeni bir ödeme geldiğinde `latestEvent` güncellenir ve
 * `onEvent` çağrılır (bakiye/geçmiş yenilemeyi tetiklemek için).
 */
export function usePaymentStream(
  publicKey: string,
  onEvent: (event: LivePaymentEvent) => void
) {
  const [connected, setConnected] = useState(true);
  const [latestEvent, setLatestEvent] = useState<LivePaymentEvent | null>(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let closed = false;

    const closeStream = server
      .payments()
      .forAccount(publicKey)
      .cursor("now")
      .stream({
        onmessage: (record) => {
          if (closed) return;
          setConnected(true);
          // Yalnızca payment tipini işle (create_account vb. hariç)
          if (record.type !== "payment") return;

          const isOutgoing = record.from === publicKey;
          const event: LivePaymentEvent = {
            id: record.id,
            direction: isOutgoing ? "out" : "in",
            amount: record.amount,
            asset:
              record.asset_type === "native" ? "XLM" : record.asset_code ?? "unknown",
            counterparty: isOutgoing ? record.to : record.from,
            transactionHash: record.transaction_hash,
            receivedAt: Date.now(),
          };
          setLatestEvent(event);
          onEventRef.current(event);
        },
        onerror: () => {
          if (!closed) setConnected(false);
        },
      });

    return () => {
      closed = true;
      closeStream();
    };
  }, [publicKey]);

  return { connected, latestEvent };
}
