"use client";

import { useState } from "react";
import { useT } from "@/i18n/useLocale";

export function CopyField({
  label,
  value,
  masked = false,
}: {
  label: string;
  value: string;
  masked?: boolean;
}) {
  const t = useT();
  const [revealed, setRevealed] = useState(!masked);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
        <code className="flex-1 truncate font-mono text-sm text-slate-200">
          {revealed ? value : "•".repeat(24)}
        </code>
        {masked && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="shrink-0 text-xs font-medium text-cyan-400 hover:text-cyan-300"
          >
            {revealed ? t("common.hide") : t("common.show")}
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 text-xs font-medium text-cyan-400 hover:text-cyan-300"
        >
          {copied ? t("common.copied") : t("common.copy")}
        </button>
      </div>
    </div>
  );
}
