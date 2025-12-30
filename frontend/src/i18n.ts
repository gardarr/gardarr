import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

const resources = {
  "en-US": {
    translation: enUS,
  },
  "pt-BR": {
    translation: ptBR,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en-US",
    supportedLngs: ["en-US", "pt-BR"],
    defaultNS: "translation",
    interpolation: {
      escapeValue: false, // React already handles escaping
    },
    detection: {
      order: ["localStorage"],
      caches: ["localStorage"],
      lookupLocalStorage: "app_language",
    },
  });

export default i18n;

