"use client";

import { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { generateWallet, isValidSecretKey, walletFromSecret } from "@/lib/stellar";
import { DisclaimerBanner } from "./DisclaimerBanner";

type Mode = "choose" | "create" | "import";

export function WalletOnboarding() {
  const { setWallet } = useWallet();
  const [mode, setMode] = useState<Mode>("choose");
  const [secretInput, setSecretInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    const wallet = generateWallet();
    setWallet(wallet);
  }

  function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidSecretKey(secretInput)) {
      setError("Geçersiz gizli anahtar. 'S' ile başlayan 56 karakterlik bir anahtar girin.");
      return;
    }
    setWallet(walletFromSecret(secretInput));
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-white">Stellar Wallet</h1>
        <p className="mt-1 text-sm text-slate-400">
          White Belt · Level 1 — Cüzdan oluştur, bakiye gör, testnet üzerinde işlem gönder.
        </p>
      </div>

      <DisclaimerBanner />

      {mode === "choose" && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-lg bg-cyan-500 px-4 py-3 font-medium text-slate-950 transition hover:bg-cyan-400"
          >
            Yeni Cüzdan Oluştur
          </button>
          <button
            type="button"
            onClick={() => setMode("import")}
            className="rounded-lg border border-slate-700 px-4 py-3 font-medium text-slate-200 transition hover:bg-slate-800"
          >
            Mevcut Cüzdanı İçe Aktar
          </button>
        </div>
      )}

      {mode === "import" && (
        <form onSubmit={handleImport} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Gizli Anahtar (Secret Key)
            <input
              type="password"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              placeholder="S..."
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-cyan-500"
            />
          </label>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-cyan-500 px-4 py-2 font-medium text-slate-950 transition hover:bg-cyan-400"
            >
              İçe Aktar
            </button>
            <button
              type="button"
              onClick={() => setMode("choose")}
              className="rounded-lg border border-slate-700 px-4 py-2 font-medium text-slate-200 transition hover:bg-slate-800"
            >
              Geri
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
