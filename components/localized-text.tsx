"use client";

import { usePreferences } from "@/components/preferences-provider";
import type { LocalizedText as LocalizedTextValue } from "@/lib/i18n";

export function LocalizedText({ value }: { value: LocalizedTextValue }) {
  const { text } = usePreferences();
  return <>{text(value)}</>;
}
