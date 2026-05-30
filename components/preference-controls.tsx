"use client";

import { usePreferences } from "@/components/preferences-provider";
import type { Language } from "@/lib/i18n";

const languageOptions: Array<{ value: Language; label: string }> = [
  { value: "en", label: "EN" },
  { value: "zh", label: "中" },
];

const themeOptions = [
  { value: "dark" as const, labelKey: "dark" as const },
  { value: "light" as const, labelKey: "light" as const },
];

export function PreferenceControls() {
  const { language, setLanguage, theme, setTheme, t } = usePreferences();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-md border border-zinc-700 bg-zinc-900 p-1" aria-label={t("language")}>
        {languageOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setLanguage(option.value)}
            className={`min-w-9 rounded px-2 py-1 text-xs font-semibold transition ${
              language === option.value ? "codex-selected" : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="flex rounded-md border border-zinc-700 bg-zinc-900 p-1" aria-label={t("theme")}>
        {themeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            className={`rounded px-2 py-1 text-xs font-semibold transition ${
              theme === option.value ? "codex-selected" : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {t(option.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
