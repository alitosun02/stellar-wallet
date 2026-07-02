"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AccountNotFoundError,
  fetchBalances,
  fundWithFriendbot,
  type WalletBalance,
} from "@/lib/stellar";

export function BalanceCard({
  publicKey,
  refreshSignal,
  onFunded,
}: {
  publicKey: string;
  refreshSignal: number;
  onFunded: () => void;
}) {
  const [balances, setBalances] = useState<WalletBalance[] | null>(null);
  const [status, setStatus] = useState<"loading" | "not-found" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [funding, setFunding] = useState(false);

  const load = useCallback(() => {
    return fetchBalances(publicKey)
      .then((result) => {
        setBalances(result);
        setStatus("ready");
        setErrorMessage(null);
      })
      .catch((error) => {
        if (error instanceof AccountNotFoundError) {
          setStatus("not-found");
          setErrorMessage(null);
        } else {
          setStatus("error");
          setErrorMessage(error instanceof Error ? error.message : "Bilinmeyen hata");
        }
      });
  }, [publicKey]);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  async function handleFund() {
    setFunding(true);
    setErrorMessage(null);
    try {
      await fundWithFriendbot(publicKey);
      await load();
      onFunded();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Fonlama başarısız oldu");
    } finally {
      setFunding(false);
    }
  }

  const xlmBalance = balances?.find((b) => b.asset === "XLM");

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">
          Bakiye
        </h2>
        <button
          type="button"
          onClick={load}
          className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
        >
          Yenile
        </button>
      </div>

      {status === "loading" && (
        <p className="mt-3 text-slate-400">Yükleniyor...</p>
      )}

      {status === "not-found" && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm text-slate-400">
            Bu hesap testnet üzerinde henüz aktive edilmemiş. Testnet XLM ile
            fonlamak için Friendbot&apos;u kullanabilirsiniz.
          </p>
          <button
            type="button"
            onClick={handleFund}
            disabled={funding}
            className="self-start rounded-lg bg-cyan-500 px-4 py-2 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
          >
            {funding ? "Fonlanıyor..." : "Friendbot ile Fonla (Testnet)"}
          </button>
        </div>
      )}

      {status === "ready" && (
        <div className="mt-3">
          <p className="text-3xl font-semibold text-white">
            {xlmBalance ? Number(xlmBalance.amount).toLocaleString("tr-TR", { maximumFractionDigits: 7 }) : "0"}{" "}
            <span className="text-lg font-normal text-slate-400">XLM</span>
          </p>
          {balances && balances.length > 1 && (
            <ul className="mt-3 space-y-1 text-sm text-slate-400">
              {balances
                .filter((b) => b.asset !== "XLM")
                .map((b) => (
                  <li key={b.asset}>
                    {b.amount} {b.asset}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {status === "error" && (
        <p className="mt-3 text-sm text-rose-400">{errorMessage}</p>
      )}
      {errorMessage && status === "not-found" && (
        <p className="mt-2 text-sm text-rose-400">{errorMessage}</p>
      )}
    </div>
  );
}
