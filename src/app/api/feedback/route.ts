import { NextResponse } from "next/server";

/**
 * Kullanıcı geri bildirimi toplama uç noktası.
 *
 * Geri bildirimler yapılandırılmış JSON olarak sunucu loglarına yazılır
 * (Vercel Logs üzerinden okunabilir/dışa aktarılabilir). `FEEDBACK_WEBHOOK_URL`
 * ortam değişkeni tanımlıysa (Discord/Slack webhook) anlık bildirim de gönderilir.
 *
 * Bilinçli olarak veritabanı kullanılmıyor: MVP aşamasında geri bildirim hacmi
 * düşük ve loglar + webhook, ek altyapı yükü olmadan yeterli.
 */
export const runtime = "nodejs";

const MAX_MESSAGE = 2000;
const MAX_CONTACT = 200;

export interface FeedbackPayload {
  rating?: number;
  message?: string;
  contact?: string;
  wallet?: string;
  locale?: string;
  path?: string;
}

/** Geri bildirimi doğrular ve normalize eder; hata varsa `error` döner. */
export function normalizeFeedback(payload: FeedbackPayload): {
  value?: Required<Pick<FeedbackPayload, "rating" | "message">> & FeedbackPayload;
  error?: string;
} {
  const message = (payload.message ?? "").trim();
  const rating = Number(payload.rating);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "invalid_rating" };
  }
  if (message.length === 0) {
    return { error: "empty_message" };
  }

  return {
    value: {
      rating,
      message: message.slice(0, MAX_MESSAGE),
      contact: (payload.contact ?? "").trim().slice(0, MAX_CONTACT) || undefined,
      wallet: payload.wallet?.slice(0, 60),
      locale: payload.locale?.slice(0, 5),
      path: payload.path?.slice(0, 200),
    },
  };
}

export async function POST(request: Request) {
  let payload: FeedbackPayload;
  try {
    payload = (await request.json()) as FeedbackPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { value, error } = normalizeFeedback(payload);
  if (error || !value) {
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  const entry = { ...value, timestamp: new Date().toISOString() };
  console.log("[feedback]", JSON.stringify(entry));

  const webhook = process.env.FEEDBACK_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: [
            `📝 **FanFuel feedback** — ${"⭐".repeat(entry.rating)} (${entry.rating}/5)`,
            entry.message,
            entry.contact ? `contact: ${entry.contact}` : null,
            entry.wallet ? `wallet: \`${entry.wallet}\`` : null,
            `page: ${entry.path ?? "?"} · locale: ${entry.locale ?? "?"}`,
          ]
            .filter(Boolean)
            .join("\n"),
        }),
      });
    } catch (webhookError) {
      console.error("[feedback-webhook-failed]", String(webhookError));
    }
  }

  return NextResponse.json({ ok: true });
}
