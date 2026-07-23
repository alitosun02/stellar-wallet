"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useLocale } from "@/i18n/useLocale";
import { WALLET_LABELS } from "@/lib/wallets";
import { ConnectWalletDialog } from "@/components/wallet/ConnectWalletDialog";
import { truncateAddress } from "@/components/ui/primitives";

const NAV = [
  { href: "/", key: "nav.campaigns" },
  { href: "/create", key: "nav.create" },
  { href: "/wallet", key: "nav.wallet" },
] as const;

export function Header() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useLocale();
  const { connection, clearConnection } = useWallet();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-white">
          <span aria-hidden className="text-lg">⚡</span>
          <span>{t("brand.name")}</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                isActive(item.href)
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-800">
            {(["en", "tr"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                aria-pressed={locale === code}
                className={`px-2 py-1 text-xs font-medium uppercase transition ${
                  locale === code
                    ? "bg-slate-800 text-white"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          {connection ? (
            <div className="flex items-center gap-2">
              <span className="hidden rounded-lg border border-slate-800 px-2.5 py-1.5 text-xs text-slate-300 md:inline">
                <span className="text-slate-500">{WALLET_LABELS[connection.kind]}</span>{" "}
                <span className="font-mono">{truncateAddress(connection.publicKey)}</span>
              </span>
              <button
                type="button"
                onClick={clearConnection}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
              >
                {t("nav.disconnect")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="rounded-lg bg-cyan-500 px-3 py-1.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
            >
              {t("nav.connect")}
            </button>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className="rounded-lg border border-slate-800 px-2.5 py-1.5 text-slate-300 sm:hidden"
          >
            ☰
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-slate-800 px-4 py-2 sm:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={`block rounded-lg px-3 py-2 text-sm transition ${
                isActive(item.href) ? "bg-slate-800 text-white" : "text-slate-300"
              }`}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>
      )}

      {dialogOpen && <ConnectWalletDialog onClose={() => setDialogOpen(false)} />}
    </header>
  );
}
