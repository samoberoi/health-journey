import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Language } from "@/lib/i18n";
import { t as translate, getGreeting as greet } from "@/lib/i18n";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
  greeting: string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
  greeting: "Good morning",
});

const STORAGE_KEY = "bb_language";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      // One-time migration: default everyone back to English unless they've
      // explicitly picked a language in v2 of the picker.
      const migrated = localStorage.getItem("bb_language_v2");
      if (!migrated) {
        localStorage.setItem(STORAGE_KEY, "en");
        return "en";
      }
      return (localStorage.getItem(STORAGE_KEY) as Language) || "en";
    } catch {
      return "en";
    }
  });

  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
    localStorage.setItem("bb_language_v2", "1");
  };

  const t = (key: string) => translate(lang, key as any);
  const greeting = greet(lang);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, greeting }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
