"use client";

import { useCallback } from "react";
import { listCampaigns, type Campaign } from "@/lib/campaign";
import { useAsync } from "@/hooks/useAsync";
import { useT } from "@/i18n/useLocale";
import { mapStellarError } from "@/lib/errors";
import { Button, ErrorLine, Skeleton, formatXlm } from "@/components/ui/primitives";
import { CampaignCard } from "./CampaignCard";

export function CampaignStats({ campaigns }: { campaigns: Campaign[] }) {
  const t = useT();
  const totalRaised = campaigns.reduce((sum, c) => sum + Number(c.raisedXlm), 0);
  const supporters = campaigns.reduce((sum, c) => sum + c.supporters, 0);

  const items = [
    { label: t("home.statsCampaigns"), value: String(campaigns.length) },
    { label: t("home.statsRaised"), value: `${formatXlm(totalRaised)} ${t("common.xlm")}` },
    { label: t("home.statsSupporters"), value: String(supporters) },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
          <p className="mt-1 text-xl font-semibold text-white">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function CampaignList({ showStats = false }: { showStats?: boolean }) {
  const t = useT();
  const fetcher = useCallback(() => listCampaigns(24), []);
  // Kampanyalar 20 saniyede bir tazelenir — zincir üstü durum senkronizasyonu
  const { state, reload } = useAsync(fetcher, 20_000);

  if (state.status === "loading" && !state.data) {
    return (
      <div className="flex flex-col gap-4">
        {showStats && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[74px]" />
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[168px] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === "error" && !state.data) {
    const mapped = mapStellarError(state.error);
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6">
        <h3 className="font-medium text-rose-300">{t("campaigns.errorTitle")}</h3>
        <ErrorLine type={mapped.type} message={mapped.message} />
        <Button variant="secondary" onClick={reload}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  const campaigns = state.data ?? [];

  if (campaigns.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-slate-500">
        {t("campaigns.empty")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {showStats && <CampaignStats campaigns={campaigns} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {campaigns.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} />
        ))}
      </div>
    </div>
  );
}
