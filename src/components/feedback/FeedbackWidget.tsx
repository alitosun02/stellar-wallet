"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { useLocale } from "@/i18n/useLocale";
import { trackEvent, reportError } from "@/lib/analytics";
import { Button, Field, inputClass } from "@/components/ui/primitives";

type SubmitState = "idle" | "sending" | "sent" | "error";

export function FeedbackWidget() {
  const { locale, t } = useLocale();
  const { connection } = useWallet();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<SubmitState>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0 || !message.trim()) return;
    setState("sending");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating,
          message,
          contact,
          wallet: connection?.publicKey,
          locale,
          path: pathname,
        }),
      });
      if (!response.ok) throw new Error(`Feedback API responded ${response.status}`);
      setState("sent");
      trackEvent("feedback_submitted", { rating, path: pathname });
      setTimeout(() => {
        setOpen(false);
        setState("idle");
        setRating(0);
        setMessage("");
        setContact("");
      }, 2200);
    } catch (error) {
      setState("error");
      reportError(error, { where: "FeedbackWidget" });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          trackEvent("feedback_opened", { path: pathname });
        }}
        className="fixed bottom-4 right-4 z-40 rounded-full border border-slate-700 bg-slate-900/90 px-4 py-2 text-sm font-medium text-slate-200 shadow-lg backdrop-blur transition hover:border-cyan-500/50 hover:text-white"
      >
        💬 {t("feedback.button")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-white">{t("feedback.title")}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("common.cancel")}
                className="text-slate-500 transition hover:text-slate-300"
              >
                ✕
              </button>
            </div>

            {state === "sent" ? (
              <p className="mt-6 text-center text-emerald-400">✅ {t("feedback.thanks")}</p>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                <div>
                  <p className="text-sm text-slate-300">{t("feedback.rating")}</p>
                  <div className="mt-1 flex gap-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRating(value)}
                        aria-label={`${value}/5`}
                        aria-pressed={rating === value}
                        className={`text-2xl transition ${
                          value <= rating ? "opacity-100" : "opacity-30 hover:opacity-60"
                        }`}
                      >
                        ⭐
                      </button>
                    ))}
                  </div>
                </div>

                <Field label={t("feedback.message")}>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("feedback.messagePlaceholder")}
                    className={`${inputClass} resize-none`}
                  />
                </Field>

                <Field label={t("feedback.contact")}>
                  <input
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder={t("feedback.contactPlaceholder")}
                    className={inputClass}
                  />
                </Field>

                {state === "error" && (
                  <p className="text-sm text-rose-400">{t("feedback.error")}</p>
                )}

                <Button type="submit" disabled={state === "sending" || rating === 0}>
                  {state === "sending" ? t("feedback.sending") : t("feedback.submit")}
                </Button>
              </div>
            )}
          </form>
        </div>
      )}
    </>
  );
}
