import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import de from "./locales/de.json";
import en from "./locales/en.json";
import ar from "./locales/ar.json";

export const SUPPORTED_LANGUAGES = ["de", "en", "ar"];
export const RTL_LANGUAGES = ["ar"];

// Apply text direction + lang attribute on <html> for the active language.
export function applyDirection(lng) {
  const base = (lng || "de").split("-")[0];
  const dir = RTL_LANGUAGES.includes(base) ? "rtl" : "ltr";
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("lang", base);
    document.documentElement.setAttribute("dir", dir);
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en },
      ar: { translation: ar },
    },
    // German is the default/primary language.
    fallbackLng: "de",
    supportedLngs: SUPPORTED_LANGUAGES,
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    interpolation: { escapeValue: false },
    detection: {
      // Only honor a previously saved preference; otherwise fall back to German.
      order: ["localStorage"],
      lookupLocalStorage: "rb_lang",
      caches: ["localStorage"],
    },
  });

applyDirection(i18n.resolvedLanguage || i18n.language || "de");
i18n.on("languageChanged", (lng) => applyDirection(lng));

export default i18n;
