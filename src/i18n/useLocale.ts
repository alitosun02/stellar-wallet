"use client";

import { useCallback, useSyncExternalStore } from "react";
import { createPersistentStore } from "@/lib/persistentStore";
import { dictionary, LOCALES, type Locale, type TranslationKey } from "./dictionary";

const localeStore = createPersistentStore<Locale>({
  key: "fanfuel-locale",
  fallback: "en",
  parse: (raw) => ((LOCALES as string[]).includes(raw) ? (raw as Locale) : null),
  serialize: (value) => value,
  // Kayıt yoksa tarayıcı dilinden tahmin et
  detect: () =>
    typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("tr")
      ? "tr"
      : "en",
});

export interface UseLocaleResult {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

export function useLocale(): UseLocaleResult {
  const locale = useSyncExternalStore(
    localeStore.subscribe,
    localeStore.getSnapshot,
    localeStore.getServerSnapshot
  );

  const t = useCallback(
    (key: TranslationKey) => dictionary[locale][key] ?? dictionary.en[key] ?? key,
    [locale]
  );

  const setLocale = useCallback((next: Locale) => {
    localeStore.set(next);
    if (typeof document !== "undefined") document.documentElement.lang = next;
  }, []);

  return { locale, setLocale, t };
}

/** Kısayol: yalnızca çeviri fonksiyonu gerektiğinde. */
export function useT(): (key: TranslationKey) => string {
  return useLocale().t;
}
