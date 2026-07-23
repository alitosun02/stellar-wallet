"use client";

import Link from "next/link";
import { useT } from "@/i18n/useLocale";
import { CampaignList } from "@/components/campaigns/CampaignList";

export default function HomePage() {
  const t = useT();

  const steps = [
    { title: t("home.step1Title"), body: t("home.step1Body") },
    { title: t("home.step2Title"), body: t("home.step2Body") },
    { title: t("home.step3Title"), body: t("home.step3Body") },
  ];

  return (
    <div className="flex flex-col gap-12">
      <section className="pt-4 text-center sm:pt-10">
        <h1 className="mx-auto max-w-2xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
          {t("home.heroTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-400">{t("home.heroSubtitle")}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="#campaigns"
            className="rounded-lg bg-cyan-500 px-5 py-2.5 font-medium text-slate-950 transition hover:bg-cyan-400"
          >
            {t("home.ctaBrowse")}
          </Link>
          <Link
            href="/create"
            className="rounded-lg border border-slate-700 px-5 py-2.5 font-medium text-slate-200 transition hover:bg-slate-800"
          >
            {t("home.ctaCreate")}
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.title}
            className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5"
          >
            <h2 className="font-medium text-white">{step.title}</h2>
            <p className="mt-2 text-sm text-slate-400">{step.body}</p>
          </div>
        ))}
      </section>

      <section id="campaigns" className="scroll-mt-20">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white">{t("campaigns.title")}</h2>
          <p className="text-sm text-slate-500">{t("campaigns.subtitle")}</p>
        </div>
        <CampaignList showStats />
      </section>
    </div>
  );
}
