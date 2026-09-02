import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PlacesSidebar } from "@/features/places/ui/places-sidebar";
import { Suspense } from "react";
import { MobileHeader } from "@/features/layout/ui/mobile-header";
import { Providers } from "./providers";
import { DesktopHeader } from "@/features/layout/ui/desktop-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://travel-coral-five-50.vercel.app"),
  title: "Tapir Travel",
  description: "Личный журнал путешествий, фото и историй.",
  icons: {
    icon: "/icon.png",
  },
  openGraph: {
    title: "Tapir Travel",
    description: "Личный журнал путешествий, фото и историй.",
    url: "/",
    siteName: "Tapir Travel",
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1419,
        height: 1109,
        alt: "Tapir Travel mascot",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tapir Travel",
    description: "Личный журнал путешествий, фото и историй.",
    images: [
      {
        url: "/twitter-image.png",
        alt: "Tapir Travel mascot",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <div className="min-h-dvh bg-background/20 text-foreground">
            {/* Mobile header (dynamic) */}
            <Suspense
              fallback={
                <div className="sticky top-0 z-50 border-b border-white/10 bg-background/90 px-3 py-2 lg:hidden" />
              }
            >
              <MobileHeader />
            </Suspense>

            {/* Desktop header */}
            <Suspense
              fallback={
                <div className="sticky top-0 z-40 hidden border-b border-white/10 bg-background/90 px-4 py-3 lg:block" />
              }
            >
              <DesktopHeader />
            </Suspense>

            <div className="grid min-h-dvh lg:grid-cols-[320px_1fr]">
              <aside className="hidden lg:block">
                <Suspense
                  fallback={<div className="h-dvh border-r border-white/10" />}
                >
                  <PlacesSidebar />
                </Suspense>
              </aside>
              <main className="min-w-0 overflow-x-hidden">{children}</main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
