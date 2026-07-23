"use client";

import Link from "next/link";
import { useState } from "react";
import { createCampaign, type TxStatus } from "@/lib/campaign";
import { useWallet } from "@/hooks/useWallet";
import { useT } from "@/i18n/useLocale";
import { trackEvent } from "@/lib/analytics";
import { mapStellarError, type MappedError } from "@/lib/errors";
import { signWithWallet } from "@/lib/wallets";
import {
  Button,
  Card,
  ErrorLine,
  Field,
  TxHashLine,
  TxStatusLine,
  inputClass,
} from "@/components/ui/primitives";

const MAX_TITLE = 60;

export default function CreateCampaignPage() {
  const t = useT();
  const { connection } = useWallet();

  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [days, setDays] = useState("30");
  const [status, setStatus] = useState<TxStatus>("idle");
  const [error, setError] = useState<MappedError | null>(null);
  const [created, setCreated] = useState<{ id: number; hash: string } | null>(null);

  const busy = status === "building" || status === "signing" || status === "pending";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!connection) return;
    setError(null);
    setCreated(null);

    if (title.trim().length > MAX_TITLE) {
      setError({ type: "VALIDATION", message: t("create.titleTooLong") });
      return;
    }

    try {
      const result = await createCampaign({
        title,
        goalXlm: goal,
        durationDays: Number(days),
        sourcePublicKey: connection.publicKey,
        signTransaction: (xdr) => signWithWallet(connection, xdr),
        onStatus: setStatus,
      });
      setCreated({ id: result.value, hash: result.hash });
      trackEvent("campaign_created", { campaignId: result.value, goal });
      setTitle("");
      setGoal("");
    } catch (err) {
      setStatus("failed");
      setError(mapStellarError(err));
      trackEvent("campaign_create_failed");
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">{t("create.title")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("create.subtitle")}</p>
      </div>

      <Card>
        {!connection ? (
          <p className="text-sm text-slate-400">{t("create.connectFirst")}</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label={t("create.campaignTitle")} hint={`${title.length}/${MAX_TITLE}`}>
              <input
                required
                maxLength={MAX_TITLE}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("create.campaignTitlePlaceholder")}
                className={inputClass}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("create.goal")}>
                <input
                  required
                  type="number"
                  min="1"
                  step="0.0000001"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="500"
                  className={inputClass}
                />
              </Field>
              <Field label={t("create.duration")}>
                <input
                  required
                  type="number"
                  min="1"
                  max="365"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <Button type="submit" disabled={busy}>
              {busy ? t("common.loading") : t("create.submit")}
            </Button>

            <TxStatusLine status={status} />
            {error && <ErrorLine type={error.type} message={error.message} />}

            {created && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                <p className="text-sm font-medium text-emerald-300">✅ {t("create.success")}</p>
                <div className="mt-1">
                  <TxHashLine hash={created.hash} />
                </div>
                <Link
                  href={`/campaigns/${created.id}`}
                  className="mt-2 inline-block text-sm text-cyan-400 underline"
                >
                  {t("create.viewCampaign")} →
                </Link>
              </div>
            )}
          </form>
        )}
      </Card>
    </div>
  );
}
