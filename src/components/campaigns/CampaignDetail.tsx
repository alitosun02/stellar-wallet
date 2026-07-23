"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  claimRefund,
  donateToCampaign,
  fetchCampaignEvents,
  getCampaign,
  getContribution,
  withdrawCampaign,
  type TxStatus,
} from "@/lib/campaign";
import { useAsync } from "@/hooks/useAsync";
import { useWallet } from "@/hooks/useWallet";
import { useT } from "@/i18n/useLocale";
import { mapStellarError, type MappedError } from "@/lib/errors";
import { explorerTxUrl } from "@/lib/stellar";
import { signWithWallet } from "@/lib/wallets";
import { trackEvent } from "@/lib/analytics";
import {
  Button,
  Card,
  ErrorLine,
  Field,
  Skeleton,
  TxHashLine,
  TxStatusLine,
  formatXlm,
  inputClass,
  truncateAddress,
} from "@/components/ui/primitives";
import { ProgressBar, StatusBadge, timeLeftLabel } from "./CampaignCard";

export function CampaignDetail({ campaignId }: { campaignId: number }) {
  const t = useT();
  const { connection } = useWallet();

  const fetchCampaign = useCallback(() => getCampaign(campaignId), [campaignId]);
  const { state, reload } = useAsync(fetchCampaign, 15_000);

  const fetchEvents = useCallback(
    () => fetchCampaignEvents({ campaignId, limit: 8 }),
    [campaignId]
  );
  const { state: eventsState, reload: reloadEvents } = useAsync(fetchEvents, 20_000);

  const fetchContribution = useCallback(
    () => (connection ? getContribution(campaignId, connection.publicKey) : Promise.resolve("0")),
    [campaignId, connection]
  );
  const { state: contributionState, reload: reloadContribution } = useAsync(fetchContribution);

  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<MappedError | null>(null);
  const [copied, setCopied] = useState(false);

  const campaign = state.data;
  const busy = txStatus === "building" || txStatus === "signing" || txStatus === "pending";

  function refreshAll() {
    reload();
    reloadEvents();
    reloadContribution();
  }

  async function runAction(
    action: "donate" | "withdraw" | "refund",
    fn: () => Promise<{ hash: string }>
  ) {
    setError(null);
    setTxHash(null);
    try {
      const result = await fn();
      setTxHash(result.hash);
      trackEvent(`campaign_${action}`, { campaignId, hash: result.hash });
      refreshAll();
    } catch (err) {
      setTxStatus("failed");
      setError(mapStellarError(err));
      trackEvent(`campaign_${action}_failed`, { campaignId });
    }
  }

  if (state.status === "loading" && !campaign) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (!campaign) {
    const mapped = state.error ? mapStellarError(state.error) : null;
    return (
      <Card>
        <h1 className="text-lg font-semibold text-white">{t("campaign.notFound")}</h1>
        {mapped && (
          <div className="mt-2">
            <ErrorLine type={mapped.type} message={mapped.message} />
          </div>
        )}
        <Link href="/" className="mt-4 inline-block text-sm text-cyan-400 underline">
          {t("common.back")}
        </Link>
      </Card>
    );
  }

  const isCreator = connection?.publicKey === campaign.creator;
  const contribution = contributionState.data ?? "0";
  const hasContribution = Number(contribution) > 0;
  const canWithdraw = isCreator && campaign.status === "succeeded";
  const canRefund = campaign.status === "failed" && hasContribution;
  const canDonate = campaign.status === "active" || campaign.status === "succeeded";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold text-white">{campaign.title}</h1>
          <StatusBadge status={campaign.status} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
          <span>
            {t("campaign.creator")}:{" "}
            <a
              href={`https://stellar.expert/explorer/testnet/account/${campaign.creator}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono underline transition hover:text-slate-300"
            >
              {truncateAddress(campaign.creator)}
            </a>
          </span>
          <span aria-hidden>·</span>
          <span>
            {t("campaign.deadline")}: {campaign.deadline.toLocaleDateString()} (
            {timeLeftLabel(campaign.deadline, t)})
          </span>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true);
              trackEvent("campaign_share", { campaignId });
              setTimeout(() => setCopied(false), 2000);
            }}
            className="text-cyan-400 underline transition hover:text-cyan-300"
          >
            {copied ? t("campaign.linkCopied") : t("campaign.share")}
          </button>
        </div>
      </div>

      <Card>
        <ProgressBar percent={campaign.progressPercent} />
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label={t("campaign.raised")} value={`${formatXlm(campaign.raisedXlm)}`} />
          <Stat label={t("campaign.goal")} value={`${formatXlm(campaign.goalXlm)}`} />
          <Stat label={t("campaigns.supporters")} value={String(campaign.supporters)} />
          <Stat
            label={t("campaign.yourContribution")}
            value={connection ? formatXlm(contribution) : "—"}
          />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">
          {t("campaign.support")}
        </h2>

        {!connection ? (
          <p className="mt-3 text-sm text-slate-400">{t("campaign.connectToSupport")}</p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {canDonate && (
              <form
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  runAction("donate", () =>
                    donateToCampaign({
                      campaignId,
                      amountXlm: amount,
                      sourcePublicKey: connection.publicKey,
                      signTransaction: (xdr) => signWithWallet(connection, xdr),
                      onStatus: setTxStatus,
                    })
                  ).then(() => setAmount(""));
                }}
              >
                <div className="flex-1">
                  <Field label={`${t("campaign.amount")} (${t("common.xlm")})`}>
                    <input
                      required
                      type="number"
                      min="0.0000001"
                      step="0.0000001"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="25"
                      className={inputClass}
                    />
                  </Field>
                </div>
                <Button type="submit" disabled={busy} className="sm:mb-0.5">
                  {busy ? t("common.loading") : `💛 ${t("campaign.donate")}`}
                </Button>
              </form>
            )}

            {isCreator && (
              <p className="text-xs text-slate-500">{t("campaign.selfDonateHint")}</p>
            )}

            {canWithdraw && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                <p className="text-sm text-emerald-300">{t("campaign.withdrawHint")}</p>
                <Button
                  className="mt-2"
                  disabled={busy}
                  onClick={() =>
                    runAction("withdraw", () =>
                      withdrawCampaign({
                        campaignId,
                        sourcePublicKey: connection.publicKey,
                        signTransaction: (xdr) => signWithWallet(connection, xdr),
                        onStatus: setTxStatus,
                      })
                    )
                  }
                >
                  {t("campaign.withdraw")}
                </Button>
              </div>
            )}

            {canRefund && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-sm text-amber-300">{t("campaign.refundHint")}</p>
                <Button
                  variant="secondary"
                  className="mt-2"
                  disabled={busy}
                  onClick={() =>
                    runAction("refund", () =>
                      claimRefund({
                        campaignId,
                        sourcePublicKey: connection.publicKey,
                        signTransaction: (xdr) => signWithWallet(connection, xdr),
                        onStatus: setTxStatus,
                      })
                    )
                  }
                >
                  {t("campaign.claimRefund")}
                </Button>
              </div>
            )}

            <TxStatusLine status={txStatus} />
            {txHash && <TxHashLine hash={txHash} />}
            {error && <ErrorLine type={error.type} message={error.message} />}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">
          {t("campaign.recentSupport")}
        </h2>
        {eventsState.status === "loading" && !eventsState.data ? (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (eventsState.data ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{t("campaign.noSupportYet")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-800">
            {(eventsState.data ?? []).map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm text-slate-300">
                  <span className="font-mono text-xs text-slate-500">
                    {truncateAddress(event.actor)}
                  </span>{" "}
                  {event.kind === "donation" && (
                    <span className="text-emerald-400">
                      +{formatXlm(event.amountXlm ?? "0")} {t("common.xlm")}
                    </span>
                  )}
                  {event.kind === "refund" && (
                    <span className="text-amber-400">
                      ↩ {formatXlm(event.amountXlm ?? "0")} {t("common.xlm")}
                    </span>
                  )}
                  {event.kind === "withdrawal" && (
                    <span className="text-cyan-400">
                      ⇢ {formatXlm(event.amountXlm ?? "0")} {t("common.xlm")}
                    </span>
                  )}
                  {event.kind === "created" && (
                    <span className="text-slate-400">{t("home.step1Title")}</span>
                  )}
                </span>
                <a
                  href={explorerTxUrl(event.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs text-cyan-400 underline"
                >
                  {t("common.viewOnExplorer")}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
