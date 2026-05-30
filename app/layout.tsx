import type { Metadata } from "next";
import "./globals.css";
import { PreferencesProvider } from "@/components/preferences-provider";
import { getOptionalAppName } from "@/lib/env";

export const metadata: Metadata = {
  title: getOptionalAppName(),
  description: "BYOK API relay gateway",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const preferenceScript = `
try {
  var language = localStorage.getItem("app-language") || (navigator.language.toLowerCase().indexOf("zh") === 0 ? "zh" : "en");
  var theme = localStorage.getItem("app-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.documentElement.dataset.language = language;
  document.documentElement.dataset.theme = theme;
} catch (_) {}
`;

  return (
    <html lang="en" data-language="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferenceScript }} />
      </head>
      <body>
        <PreferencesProvider>{children}</PreferencesProvider>
      </body>
    </html>
  );
}
