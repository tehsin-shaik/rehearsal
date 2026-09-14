import type { Metadata } from "next";
import type { ReactNode } from "react";

import { brand } from "@/config/brand";
import { RehearsalProvider } from "@/components/providers/rehearsal-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: brand.productName,
    template: `%s · ${brand.productName}`,
  },
  description: brand.tagline,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <RehearsalProvider>{children}</RehearsalProvider>
      </body>
    </html>
  );
}
