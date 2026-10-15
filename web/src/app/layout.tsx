import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Millennia FieldOps",
  description: "Field data dashboard for Millennia Village monitoring.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
