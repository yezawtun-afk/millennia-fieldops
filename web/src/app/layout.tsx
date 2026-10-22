import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { I18nProvider } from "@/i18n";
import { getLocale } from "@/i18n/server";
import "./globals.css";

// The dealt type: one grotesk for the product, a mono for coordinates and keys.
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-mono",
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
    <html lang={locale} className={`${plex.variable} ${plexMono.variable}`}>
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
