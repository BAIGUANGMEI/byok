"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  defaultLanguage,
  resolveLocalizedText,
  translations,
  type Language,
  type LocalizedText,
  type TranslationKey,
} from "@/lib/i18n";

type Theme = "dark" | "light";

type PreferencesContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  text: (value: LocalizedText) => string;
  t: (key: TranslationKey) => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function detectLanguage(): Language {
  if (typeof navigator === "undefined") return defaultLanguage;
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function detectTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyPreferences(language: Language, theme: Theme) {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.documentElement.dataset.language = language;
  document.documentElement.dataset.theme = theme;
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem("app-language");
    const savedTheme = window.localStorage.getItem("app-theme");
    const nextLanguage = savedLanguage === "zh" || savedLanguage === "en" ? savedLanguage : detectLanguage();
    const nextTheme = savedTheme === "light" || savedTheme === "dark" ? savedTheme : detectTheme();
    setLanguageState(nextLanguage);
    setThemeState(nextTheme);
    applyPreferences(nextLanguage, nextTheme);
  }, []);

  const value = useMemo<PreferencesContextValue>(() => {
    function setLanguage(nextLanguage: Language) {
      setLanguageState(nextLanguage);
      window.localStorage.setItem("app-language", nextLanguage);
      applyPreferences(nextLanguage, theme);
    }

    function setTheme(nextTheme: Theme) {
      setThemeState(nextTheme);
      window.localStorage.setItem("app-theme", nextTheme);
      applyPreferences(language, nextTheme);
    }

    return {
      language,
      setLanguage,
      theme,
      setTheme,
      text: (localizedText) => resolveLocalizedText(localizedText, language),
      t: (key) => resolveLocalizedText(translations[key], language),
    };
  }, [language, theme]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used inside PreferencesProvider");
  return context;
}
