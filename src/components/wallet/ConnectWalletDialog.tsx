"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useT } from "@/i18n/useLocale";
import { mapStellarError } from "@/lib/errors";
import { generateWallet, isValidSecretKey, walletFromSecret } from "@/lib/stellar";
import { connectAlbedo, connectFreighter } from "@/lib/wallets";
import { Button, ErrorLine, Field, inputClass } from "@/components/ui/primitives";

export function ConnectWalletDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { setConnection } = useWallet();
  const [mode, setMode] = useState<"choose" | "import">("choose");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<{ type?: string; message: string } | null>(null);
  const [connecting, setConnecting] = useState<"freighter" | "albedo" | null>(null);

  function finish(connection: Parameters<typeof setConnection>[0]) {
    setConnection(connection);
    onClose();
  }

  async function handleConnect(kind: "freighter" | "albedo") {
    setError(null);
    setConnecting(kind);
    try {
      finish(kind === "freighter" ? await connectFreighter() : await connectAlbedo());
    } catch (err) {
      const mapped = mapStellarError(err);
      setError({ type: mapped.type, message: mapped.message });
    } finally {
      setConnecting(null);
    }
  }

  function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidSecretKey(secret)) {
      setError({ message: t("connect.invalidSecret") });
      return;
    }
    finish({ kind: "local", ...walletFromSecret(secret) });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">{t("connect.title")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="text-slate-500 transition hover:text-slate-300"
          >
            ✕
          </button>
        </div>

        {mode === "choose" ? (
          <div className="mt-5 flex flex-col gap-3">
            <Button disabled={connecting !== null} onClick={() => handleConnect("freighter")}>
              {connecting === "freighter" ? t("connect.freighterConnecting") : `🚀 ${t("connect.freighter")}`}
            </Button>
            <button
              type="button"
              disabled={connecting !== null}
              onClick={() => handleConnect("albedo")}
              className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2 font-medium text-violet-200 transition hover:bg-violet-500/20 disabled:opacity-50"
            >
              {t("connect.albedo")}
            </button>

            <div className="my-1 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-500">
              <span className="h-px flex-1 bg-slate-800" />
              {t("connect.orLocal")}
              <span className="h-px flex-1 bg-slate-800" />
            </div>

            <Button
              variant="secondary"
              onClick={() => finish({ kind: "local", ...generateWallet() })}
            >
              {t("connect.create")}
            </Button>
            <Button variant="secondary" onClick={() => setMode("import")}>
              {t("connect.import")}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleImport} className="mt-5 flex flex-col gap-3">
            <Field label={t("connect.importLabel")}>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="S…"
                className={`${inputClass} font-mono`}
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                {t("connect.importSubmit")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setMode("choose");
                  setError(null);
                }}
              >
                {t("common.back")}
              </Button>
            </div>
          </form>
        )}

        {error && (
          <div className="mt-3">
            <ErrorLine type={error.type} message={error.message} />
          </div>
        )}

        <p className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {t("connect.disclaimer")}
        </p>
      </div>
    </div>
  );
}
