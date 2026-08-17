import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Integration Readiness Atlas",
  description: "Evidence-led research across 100 requested agent integrations."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
