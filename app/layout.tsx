import type { Metadata } from "next";
import "./globals.css";
import { getOptionalAppName } from "@/lib/env";

export const metadata: Metadata = {
  title: getOptionalAppName(),
  description: "Personal AI API relay gateway",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
