import type { Metadata } from "next";
import type { ReactNode } from "react";

import { brand } from "@/config/brand";

import "./globals.css";

export const metadata: Metadata = {
  title: brand.productName,
  description: brand.tagline,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
