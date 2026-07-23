"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";
import { usePaymentStream } from "@/hooks/usePaymentStream";
import { useT } from "@/i18n/useLocale";
import { trackEvent } from "@/lib/analytics";
import { mapStellarError, type MappedError } from "@/lib/errors";
import {
  AccountNotFoundError,
  buildPaymentTransaction,
  explorerAccountUrl,
  explorerTxUrl,
  fetchBalances,
  fetchRecentPayments,
  fundWithFriendbot,
  submitSignedXdr,
} from "@/lib/stellar";
import { signWithWallet, WALLET_LABELS } from "@/lib/wallets";
import type { TxStatus } from "@/lib/campaign";
import { CopyField } from "@/components/wallet/CopyField";
import {
  Button,
  Card,
  ErrorLine,
  Field,
  SectionTitle,
  Skeleton,
  TxHashLine,
  TxStatusLine,
  formatXlm,
  inputClass,
  truncateAddress,
} from "@/components/ui/primitives";

export default function WalletPage() {
  const t = useT();
  const { connection } = useWallet();
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = useCallback(() => setRefreshKey((n) => n + 1), []);

  if (!connection) {
    return (
      <Card>
        <h1 className="text-lg font-semibold text-white">{t("wallet.title")}</h1>
        <p className="mt-2 text-sm text-slate-400">{t("campaign.connectToSupport")}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">{t("wallet.title")}</h1>
          <p className="text-sm text-slate-500">
            {t("wallet.subtitle")} · {WALLET_LABELS[connection.kind]}
          </p>
        </div>
        <a
          href={explorerAccountUrl(connection.publicKey)}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-cyan-400 underline"
        >
          {t("common.viewOnExplorer")}
        </a>
      </div>

      <Card>
        <div className="flex flex-col gap-4">
          <CopyField label={t("wallet.publicKey")} value={connection.publicKey} />
          {connection.kind === "local" && connection.secretKey && (
            <CopyField label={t("wallet.secretKey")} value={connection.secretKey} masked />
          )}
        </div>
      </Card>

      <BalanceSection
        publicKey={connection.publicKey}
        refreshKey={refreshKey}
        onChange={bump}
      />
      <SendPaymentSection connection={connection} onSent={bump} />
      <HistorySection publicKey={connection.publicKey} refreshKey={refreshKey} onLive={bump} />
    </div>
  );
}

function BalanceSection({
  publicKey,
  refreshKey,
  onChange,
}: {
  publicKey: string;
  refreshKey: number;
  onChange: () => void;
}) {
  const t = useT();
  const [funding, setFunding] = useState(false);
  const [error, setError] = useState<MappedError | null>(null);

  const fetcher = useCallback(
    () => fetchBalances(publicKey).catch((err) => Promise.reject(err)),
    // refreshKey değiştiğinde yeniden çalışsın
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [publicKey, refreshKey]
  );
  const { state, reload } = useAsync(fetcher);

  const notFunded = state.status === "error" && state.error instanceof AccountNotFoundError;
  const xlm = state.data?.find((b) => b.asset === "XLM");

  async function handleFund() {
    setFunding(true);
    setError(null);
    try {
      await fundWithFriendbot(publicKey);
      trackEvent("friendbot_funded");
      reload();
      onChange();
    } catch (err) {
      setError(mapStellarError(err));
    } finally {
      setFunding(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <SectionTitle>{t("wallet.balance")}</SectionTitle>
        <button onClick={reload} className="text-xs text-cyan-400 hover:text-cyan-300">
          {t("wallet.refresh")}
        </button>
      </div>

      {state.status === "loading" && !state.data ? (
        <Skeleton className="mt-3 h-9 w-40" />
      ) : notFunded ? (
        <div className="mt-3 flex flex-col items-start gap-3">
          <p className="text-sm text-slate-400">{t("wallet.notFunded")}</p>
          <Button onClick={handleFund} disabled={funding}>
            {funding ? t("wallet.funding") : t("wallet.fundWithFriendbot")}
          </Button>
        </div>
      ) : state.status === "error" ? (
        <div className="mt-3">
          <ErrorLine {...mapStellarError(state.error)} />
        </div>
      ) : (
        <p className="mt-3 text-3xl font-semibold text-white">
          {formatXlm(xlm?.amount ?? "0")}{" "}
          <span className="text-lg font-normal text-slate-400">{t("common.xlm")}</span>
        </p>
      )}

      {error && (
        <div className="mt-2">
          <ErrorLine type={error.type} message={error.message} />
        </div>
      )}
    </Card>
  );
}

function SendPaymentSection({
  connection,
  onSent,
}: {
  connection: NonNullable<ReturnType<typeof useWallet>["connection"]>;
  onSent: () => void;
}) {
  const t = useT();
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<TxStatus>("idle");
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<MappedError | null>(null);

  const busy = status === "signing" || status === "pending";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setHash(null);
    try {
      const xdr = await buildPaymentTransaction({
        sourcePublicKey: connection.publicKey,
        destination,
        amount,
        memo: memo || undefined,
      });
      setStatus("signing");
      const signed = await signWithWallet(connection, xdr);
      setStatus("pending");
      const result = await submitSignedXdr(signed);
      setStatus("success");
      setHash(result.hash);
      trackEvent("payment_sent");
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
    <Card>
      <SectionTitle>{t("wallet.sendPayment")}</SectionTitle>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <Field label={t("wallet.destination")}>
          <input
            required
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="G…"
            className={`${inputClass} font-mono`}
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={`${t("campaign.amount")} (${t("common.xlm")})`}>
            <input
              required
              type="number"
              min="0.0000001"
              step="0.0000001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10"
              className={inputClass}
            />
          </Field>
          <Field label={t("wallet.memo")}>
            <input
              value={memo}
              maxLength={28}
              onChange={(e) => setMemo(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? t("common.loading") : t("wallet.send")}
        </Button>
        <TxStatusLine status={status} />
        {hash && <TxHashLine hash={hash} />}
        {error && <ErrorLine type={error.type} message={error.message} />}
      </form>
    </Card>
  );
}

function HistorySection({
  publicKey,
  refreshKey,
  onLive,
}: {
  publicKey: string;
  refreshKey: number;
  onLive: () => void;
}) {
  const t = useT();
  const fetcher = useCallback(
    () => fetchRecentPayments(publicKey, 10),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [publicKey, refreshKey]
  );
  const { state } = useAsync(fetcher);
  const { connected } = usePaymentStream(publicKey, onLive);

  const payments = state.data ?? [];

  return (
    <Card>
      <div className="flex items-center justify-between">
        <SectionTitle>{t("wallet.history")}</SectionTitle>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <span
            className={`h-2 w-2 rounded-full ${
              connected ? "animate-pulse bg-emerald-400" : "bg-slate-600"
            }`}
          />
          {connected ? t("wallet.liveOn") : t("wallet.liveOff")}
        </span>
      </div>

      {state.status === "loading" && !state.data ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : payments.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{t("wallet.noTransactions")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-800">
          {payments.map((payment) => {
            const outgoing = payment.from === publicKey;
            return (
              <li key={payment.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      outgoing ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {outgoing ? t("wallet.sent") : t("wallet.received")} ·{" "}
                    {formatXlm(payment.amount)} {payment.asset}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {truncateAddress(outgoing ? payment.to : payment.from)} ·{" "}
                    {new Date(payment.createdAt).toLocaleString()}
                  </p>
                </div>
                <a
                  href={explorerTxUrl(payment.transactionHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs text-cyan-400 underline"
                >
                  {t("common.viewOnExplorer")}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
