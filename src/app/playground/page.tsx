"use client";

import { useCallback, useState } from "react";
import { useAsync } from "@/hooks/useAsync";
import { useWallet } from "@/hooks/useWallet";
import { useT } from "@/i18n/useLocale";
import { mapStellarError } from "@/lib/errors";
import { signWithWallet } from "@/lib/wallets";
import {
  COUNTER_CONTRACT_ID,
  fetchIncrementEvents,
  incrementCounter,
  readCount,
  type TxStatus,
} from "@/lib/counter";
import { DONATION_CONTRACT_ID, readDonationStats } from "@/lib/donation";
import { CAMPAIGN_CONTRACT_ID, explorerContractUrl } from "@/lib/campaign";
import { NATIVE_SAC_CONTRACT_ID } from "@/lib/soroban";
import {
  Button,
  Card,
  ErrorLine,
  SectionTitle,
  Skeleton,
  TxHashLine,
  TxStatusLine,
  formatXlm,
  truncateAddress,
} from "@/components/ui/primitives";

const CONTRACTS = [
  { name: "campaign (FanFuel escrow)", id: CAMPAIGN_CONTRACT_ID, level: "Level 4" },
  { name: "donation (TipJar)", id: DONATION_CONTRACT_ID, level: "Level 3" },
  { name: "counter", id: COUNTER_CONTRACT_ID, level: "Level 2" },
  { name: "XLM Stellar Asset Contract", id: NATIVE_SAC_CONTRACT_ID, level: "native" },
];

export default function PlaygroundPage() {
  const t = useT();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">{t("playground.title")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("playground.subtitle")}</p>
      </div>

      <Card>
        <SectionTitle>Deployed contracts (Testnet)</SectionTitle>
        <ul className="mt-3 divide-y divide-slate-800">
          {CONTRACTS.map((contract) => (
            <li
              key={contract.id}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm text-slate-200">{contract.name}</p>
                <p className="text-xs text-slate-500">{contract.level}</p>
              </div>
              <a
                href={explorerContractUrl(contract.id)}
                target="_blank"
                rel="noreferrer"
                className="break-all font-mono text-xs text-cyan-400 underline"
              >
                {contract.id}
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <DonationStatsCard />
      <CounterCard />
    </div>
  );
}

function DonationStatsCard() {
  const { connection } = useWallet();
  const source = connection?.publicKey;
  const fetcher = useCallback(
    () =>
      source
        ? readDonationStats(source)
        : Promise.resolve(null as Awaited<ReturnType<typeof readDonationStats>> | null),
    [source]
  );
  const { state } = useAsync(fetcher);

  return (
    <Card>
      <SectionTitle>TipJar contract (Level 3) — read-only</SectionTitle>
      <p className="mt-2 text-xs text-slate-500">
        Donations were collected through a cross-contract call to the XLM Stellar Asset
        Contract. Superseded by the campaign contract, kept live for reference.
      </p>
      {!source ? (
        <p className="mt-3 text-sm text-slate-500">Connect a wallet to read contract state.</p>
      ) : state.status === "loading" && !state.data ? (
        <Skeleton className="mt-3 h-8 w-40" />
      ) : state.status === "error" ? (
        <div className="mt-3">
          <ErrorLine {...mapStellarError(state.error)} />
        </div>
      ) : (
        state.data && (
          <p className="mt-3 text-2xl font-semibold text-white">
            {formatXlm(state.data.totalXlm)}{" "}
            <span className="text-base font-normal text-slate-400">
              XLM · {state.data.count} donations
            </span>
          </p>
        )
      )}
    </Card>
  );
}

function CounterCard() {
  const { connection } = useWallet();
  const source = connection?.publicKey;

  const fetcher = useCallback(
    () =>
      source
        ? Promise.all([readCount(source), fetchIncrementEvents(5)]).then(([count, events]) => ({
            count,
            events,
          }))
        : Promise.resolve(null),
    [source]
  );
  const { state, reload } = useAsync(fetcher);

  const [status, setStatus] = useState<TxStatus>("idle");
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<ReturnType<typeof mapStellarError> | null>(null);

  const busy = status === "building" || status === "signing" || status === "pending";

  async function handleIncrement() {
    if (!connection) return;
    setError(null);
    setHash(null);
    try {
      const result = await incrementCounter({
        sourcePublicKey: connection.publicKey,
        signTransaction: (xdr) => signWithWallet(connection, xdr),
        onStatus: setStatus,
      });
      setHash(result.hash);
      reload();
    } catch (err) {
      setStatus("failed");
      setError(mapStellarError(err));
    }
  }

  return (
    <Card>
      <SectionTitle>Counter contract (Level 2)</SectionTitle>
      <p className="mt-2 text-xs text-slate-500">
        <code className="text-cyan-300">get_count</code> is read via simulation;{" "}
        <code className="text-cyan-300">increment</code> is a signed{" "}
        <code className="text-cyan-300">InvokeHostFunction</code> transaction that publishes an
        event.
      </p>

      {!connection ? (
        <p className="mt-3 text-sm text-slate-500">Connect a wallet to interact.</p>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-4">
            <div className="rounded-xl border border-cyan-500/30 bg-slate-950 px-6 py-3 text-center">
              <p className="text-xs uppercase tracking-wide text-slate-500">Counter</p>
              {state.status === "loading" && !state.data ? (
                <Skeleton className="mt-1 h-8 w-10" />
              ) : (
                <p className="text-3xl font-semibold text-white">{state.data?.count ?? "—"}</p>
              )}
            </div>
            <Button onClick={handleIncrement} disabled={busy}>
              {busy ? "Working…" : "increment()"}
            </Button>
          </div>

          <div className="mt-3 flex flex-col gap-1">
            <TxStatusLine status={status} />
            {hash && <TxHashLine hash={hash} />}
            {error && <ErrorLine type={error.type} message={error.message} />}
          </div>

          {(state.data?.events.length ?? 0) > 0 && (
            <ul className="mt-4 space-y-1">
              {state.data?.events.map((event) => (
                <li key={event.id} className="text-xs text-slate-400">
                  <span className="text-cyan-300">count → {event.count}</span>{" "}
                  <span className="text-slate-500">
                    by {truncateAddress(event.caller)} · ledger {event.ledger}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
