"use client";

import { useParams } from "next/navigation";
import { CampaignDetail } from "@/components/campaigns/CampaignDetail";
import { useT } from "@/i18n/useLocale";

export default function CampaignPage() {
  const params = useParams<{ id: string }>();
  const t = useT();
  const id = Number(params.id);

  if (!Number.isInteger(id) || id < 0) {
    return (
      <p className="rounded-2xl border border-slate-800 p-6 text-slate-400">
        {t("campaign.notFound")}
      </p>
    );
  }

  return <CampaignDetail campaignId={id} />;
}
