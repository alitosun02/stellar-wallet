import { describe, expect, it } from "vitest";
import { dictionary, LOCALES } from "./dictionary";

describe("i18n dictionary", () => {
  it("exposes both supported locales", () => {
    expect(LOCALES).toEqual(["en", "tr"]);
  });

  it("has the same keys in every locale (no missing translations)", () => {
    const englishKeys = Object.keys(dictionary.en).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(dictionary[locale]).sort(), `locale: ${locale}`).toEqual(englishKeys);
    }
  });

  it("has no empty strings", () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(dictionary[locale])) {
        expect(String(value).trim().length, `${locale}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the brand name identical across locales", () => {
    expect(dictionary.tr["brand.name"]).toBe(dictionary.en["brand.name"]);
  });
});
