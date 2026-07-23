import { NextResponse } from "next/server";

/**
 * İstemci hata/olay toplama uç noktası.
 *
 * Yapılandırılmış JSON olarak sunucu loglarına yazar — Vercel Logs üzerinden
 * izlenir ve uyarı kuralları kurulabilir. `MONITORING_WEBHOOK_URL` tanımlıysa
 * (ör. Discord/Slack webhook) kritik hatalar oraya da iletilir.
 */
export const runtime = "nodejs";

interface LogPayload {
  level?: "error" | "warn" | "info";
  message?: string;
  stack?: string;
  context?: Record<string, unknown>;
  url?: string;
  userAgent?: string;
  timestamp?: string;
}

export async function POST(request: Request) {
  let payload: LogPayload;
  try {
    payload = (await request.json()) as LogPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const entry = {
    source: "client",
    level: payload.level ?? "error",
    message: String(payload.message ?? "").slice(0, 500),
    stack: payload.stack?.slice(0, 2000),
    context: payload.context ?? {},
    url: payload.url,
    userAgent: payload.userAgent?.slice(0, 200),
    timestamp: payload.timestamp ?? new Date().toISOString(),
  };

  // Vercel Logs'ta yapılandırılmış satır olarak görünür
  console.error("[client-error]", JSON.stringify(entry));

  const webhook = process.env.MONITORING_WEBHOOK_URL;
  if (webhook && entry.level === "error") {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: `🚨 FanFuel client error\n\`${entry.message}\`\nurl: ${entry.url ?? "?"}`,
        }),
      });
    } catch (error) {
      console.error("[monitoring-webhook-failed]", String(error));
    }
  }

  return NextResponse.json({ ok: true });
}
