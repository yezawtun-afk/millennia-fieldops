import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { I18nProvider } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getTheme } from "@/lib/theme-server";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
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
  // Reading the cookies here makes the language and the theme part of the first
  // HTML, so there is no flash of English or of a white page before either
  // choice applies.
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);

  return (
    <html
      lang={locale}
      className={inter.variable}
      // For "system" the attribute is left to the inline script; the preference
      // itself is exposed so the script knows what it is resolving.
      data-theme={theme === "system" ? undefined : theme}
      data-theme-pref={theme}
      suppressHydrationWarning
    >
      <head>
        {theme === "system" ? (
          <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        ) : null}
      </head>
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
