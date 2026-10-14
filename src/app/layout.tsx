import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { DisclaimerBanner } from "@/components/compliance/DisclaimerBanner";

export const metadata: Metadata = {
  title: "NEXSTORM — AI Heavy-Rainfall & Urban Waterlogging Early Warning",
  description:
    "AI-powered heavy-rainfall forecasting and urban waterlogging early-warning system for Indian cities (BuildFest 2.0 PS-18).",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col font-sans">
        <DisclaimerBanner />
        {children}
      </body>
    </html>
  );
}
