import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { I18nProvider } from "@/i18n";
import { getLocale } from "@/i18n/server";
import "./globals.css";

// One grotesk for the product. Numbers use the same face with tabular figures,
// so a column of values still lines up without a dotted-zero monospace.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Millennia FieldOps",
  description: "Field data dashboard for Millennia Village monitoring.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the cookie here makes the language part of the first HTML, so
  // there is no flash of English before a client-side switch.
  const locale = await getLocale();

  return (
    <html lang={locale} className={inter.variable}>
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
