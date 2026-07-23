"use client";

import Link from "next/link";
import { useT } from "@/i18n/useLocale";
import { CAMPAIGN_CONTRACT_ID, explorerContractUrl } from "@/lib/campaign";

export function Footer() {
  const t = useT();

  return (
    <footer className="mt-16 border-t border-slate-800 px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-slate-400">
            {t("brand.name")} — {t("brand.tagline")}
          </p>
          <p className="mt-1 text-xs">{t("footer.builtWith")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-300">
            {t("common.testnetOnly")}
          </span>
          <a
            href={explorerContractUrl(CAMPAIGN_CONTRACT_ID)}
            target="_blank"
            rel="noreferrer"
            className="underline transition hover:text-slate-300"
          >
            {t("footer.contracts")}
          </a>
          <a
            href="https://github.com/alitosun02/stellar-wallet"
            target="_blank"
            rel="noreferrer"
            className="underline transition hover:text-slate-300"
          >
            {t("footer.source")}
          </a>
          <Link href="/playground" className="underline transition hover:text-slate-300">
            {t("nav.playground")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
