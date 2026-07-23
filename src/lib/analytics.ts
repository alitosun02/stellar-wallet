"use client";

import { track } from "@vercel/analytics";

/**
 * Ürün analitiği ve hata izleme için ince bir sarmalayıcı.
 *
 * - Sayfa görüntüleme / Web Vitals: `@vercel/analytics` + `@vercel/speed-insights`
 *   (layout'ta mount edilir, otomatik toplanır).
 * - Ürün olayları: `trackEvent` → Vercel Analytics custom events.
 * - Hatalar: `reportError` → `/api/log` (sunucu tarafında yapılandırılmış log,
 *   Vercel Logs üzerinden izlenebilir) + analytics olayı.
 */
export type AnalyticsProps = Record<string, string | number | boolean | null>;

function sanitize(props?: Record<string, unknown>): AnalyticsProps {
  const result: AnalyticsProps = {};
  if (!props) return result;
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      result[key] = value;
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

export function trackEvent(name: string, props?: Record<string, unknown>): void {
  try {
    track(name, sanitize(props));
  } catch {
    // Analitik hiçbir zaman uygulamayı bozmamalı
  }
}

export function reportError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  trackEvent("client_error", { message: message.slice(0, 120), ...context });

  try {
    const body = JSON.stringify({
      level: "error",
      message,
      stack: stack?.slice(0, 2000),
      context: sanitize(context),
      url: typeof window !== "undefined" ? window.location.pathname : undefined,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      timestamp: new Date().toISOString(),
    });

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/log", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      });
    }
  } catch {
    // yut — raporlama hatası kullanıcıyı etkilemesin
  }
}
