"use client";

import type { ReactNode } from "react";
import type { TxStatus } from "@/lib/campaign";
import { useT } from "@/i18n/useLocale";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">{children}</h2>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const styles = {
    primary:
      "bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-50 font-medium",
    secondary:
      "border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-50 font-medium",
    ghost: "text-slate-300 hover:text-white disabled:opacity-50",
  }[variant];

  return (
    <button
      className={`rounded-lg px-4 py-2 transition ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-300">
      {label}
      {children}
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-800/60 ${className}`} />;
}

/** İşlem yaşam döngüsü göstergesi: hazırlanıyor → imza → pending → başarılı/başarısız. */
export function TxStatusLine({ status }: { status: TxStatus }) {
  const t = useT();
  if (status === "idle") return null;

  const labels: Record<Exclude<TxStatus, "idle">, string> = {
    building: t("tx.building"),
    signing: t("tx.signing"),
    pending: t("tx.pending"),
    success: `✅ ${t("tx.success")}`,
    failed: `❌ ${t("tx.failed")}`,
  };

  const tone =
    status === "success"
      ? "text-emerald-400"
      : status === "failed"
        ? "text-rose-400"
        : "text-amber-300";

  return (
    <p className={`text-sm ${tone}`} role="status" aria-live="polite">
      {status !== "success" && status !== "failed" && (
        <span className="mr-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-300 border-t-transparent align-[-2px]" />
      )}
      {labels[status]}
    </p>
  );
}

export function ErrorLine({ type, message }: { type?: string; message: string }) {
  return (
    <p className="text-sm text-rose-400" role="alert">
      {type && <span className="font-mono text-xs text-rose-500">[{type}] </span>}
      {message}
    </p>
  );
}

export function TxHashLine({ hash }: { hash: string }) {
  const t = useT();
  return (
    <p className="break-all font-mono text-xs text-slate-400">
      Tx: {hash}{" "}
      <a
        href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
        target="_blank"
        rel="noreferrer"
        className="text-cyan-400 underline"
      >
        ({t("common.viewOnExplorer")})
      </a>
    </p>
  );
}

export function truncateAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

export function formatXlm(value: string | number): string {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 7 });
}
