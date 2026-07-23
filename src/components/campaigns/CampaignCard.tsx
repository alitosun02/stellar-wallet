"use client";

import Link from "next/link";
import type { Campaign } from "@/lib/campaign";
import { useT } from "@/i18n/useLocale";
import { formatXlm, truncateAddress } from "@/components/ui/primitives";

export function StatusBadge({ status }: { status: Campaign["status"] }) {
  const t = useT();
  const styles: Record<Campaign["status"], string> = {
    active: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
    succeeded: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    failed: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    withdrawn: "border-slate-600 bg-slate-800/60 text-slate-300",
  };
  const labels: Record<Campaign["status"], string> = {
    active: t("status.active"),
    succeeded: t("status.succeeded"),
    failed: t("status.failed"),
    withdrawn: t("status.withdrawn"),
  };

  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all"
        style={{ width: `${Math.max(percent, 1)}%` }}
      />
    </div>
  );
}

export function timeLeftLabel(
  deadline: Date,
  t: (key: "campaigns.daysLeft" | "campaigns.hoursLeft" | "campaigns.ended") => string
): string {
  const ms = deadline.getTime() - Date.now();
  if (ms <= 0) return t("campaigns.ended");
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 48) return `${hours} ${t("campaigns.hoursLeft")}`;
  return `${Math.floor(hours / 24)} ${t("campaigns.daysLeft")}`;
}

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const t = useT();

  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 transition hover:border-slate-700 hover:bg-slate-900/70"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-white transition group-hover:text-cyan-300">
          {campaign.title}
        </h3>
        <StatusBadge status={campaign.status} />
      </div>

      <ProgressBar percent={campaign.progressPercent} />

      <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-semibold text-white">{formatXlm(campaign.raisedXlm)}</span>
        <span className="text-slate-500">
          {t("campaigns.raisedOf")} {formatXlm(campaign.goalXlm)} {t("common.xlm")}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>
          {campaign.supporters} {t("campaigns.supporters")}
        </span>
        <span aria-hidden>·</span>
        <span>{timeLeftLabel(campaign.deadline, t)}</span>
        <span aria-hidden>·</span>
        <span className="font-mono">{truncateAddress(campaign.creator)}</span>
      </div>
    </Link>
  );
}
