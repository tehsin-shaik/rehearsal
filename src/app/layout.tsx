import type { Metadata } from "next";
import type { ReactNode } from "react";
import { brand } from "@/config/brand";
import "./globals.css";
export const metadata: Metadata = { title: { default: brand.productName, template: `%s · ${brand.productName}` }, description: brand.description, icons: { icon: "/icon.svg" } };
export default function RootLayout({ children }: {
    children: ReactNode;
}) { return <html lang="en"><body><a href="#main-content" className="skip-link">Skip to content</a><div id="main-content">{children}</div></body></html>; }
