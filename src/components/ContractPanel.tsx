"use client";

import { useState } from "react";
import { explorerTxUrl, isValidPublicKey } from "@/lib/stellar";
import {
  NATIVE_SAC_CONTRACT_ID,
  readBalanceViaContract,
  transferViaContract,
} from "@/lib/soroban";
import { signWithWallet, type WalletConnection } from "@/lib/wallets";

export function ContractPanel({
  connection,
  onTransferred,
}: {
  connection: WalletConnection;
  onTransferred: () => void;
}) {
  const [contractBalance, setContractBalance] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successHash, setSuccessHash] = useState<string | null>(null);

  async function handleReadBalance() {
    setReading(true);
    setError(null);
    try {
      const balance = await readBalanceViaContract(connection.publicKey);
      setContractBalance(balance);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kontrat okuması başarısız");
    } finally {
      setReading(false);
    }
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessHash(null);

    if (!isValidPublicKey(destination)) {
      setError("Alıcı adresi geçerli bir Stellar public key değil.");
      return;
    }

    setTransferring(true);
    try {
      const result = await transferViaContract({
        sourcePublicKey: connection.publicKey,
        destination,
        amountXlm: amount,
        signTransaction: (xdr) => signWithWallet(connection, xdr),
      });
      setSuccessHash(result.hash);
      setDestination("");
      setAmount("");
      onTransferred();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kontrat transferi başarısız");
    } finally {
      setTransferring(false);
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-800/50 bg-emerald-950/20 p-6">
      <h2 className="text-sm font-medium uppercase tracking-wide text-emerald-400">
        Smart Contract (Soroban)
      </h2>
      <p className="mt-2 text-xs text-slate-400">
        XLM&apos;in Stellar Asset Contract&apos;ı (SAC) ile doğrudan etkileşim: bakiye,
        kontratın <code className="text-emerald-300">balance</code> fonksiyonundan okunur;
        transfer, <code className="text-emerald-300">transfer</code> fonksiyonu invoke
        edilerek yapılır.
      </p>
      <p className="mt-1 break-all font-mono text-[10px] text-slate-600">
        Kontrat: {NATIVE_SAC_CONTRACT_ID}
      </p>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleReadBalance}
          disabled={reading}
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
        >
          {reading ? "Okunuyor..." : "Kontrattan Bakiye Oku"}
        </button>
        {contractBalance !== null && (
          <span className="text-sm text-emerald-300">
            {Number(contractBalance).toLocaleString("tr-TR", {
              maximumFractionDigits: 7,
            })}{" "}
            XLM
          </span>
        )}
      </div>

      <form onSubmit={handleTransfer} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Alıcı Adresi
          <input
            required
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="G..."
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-emerald-500"
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
            placeholder="5"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
          />
        </label>
        <button
          type="submit"
          disabled={transferring}
          className="rounded-lg bg-emerald-500 px-4 py-2 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {transferring ? "Kontrat çağrısı yürütülüyor..." : "Kontrat ile Transfer Et"}
        </button>

        {error && <p className="text-sm text-rose-400">{error}</p>}
        {successHash && (
          <p className="text-sm text-emerald-400">
            Kontrat transferi başarılı!{" "}
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
