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
  title: "My Travels",
  description: "Travel media feed",
  icons: {
    icon: "/icon.png",
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
          <div className="min-h-dvh">
            {/* Mobile header (dynamic) */}
            <Suspense
              fallback={
                <div className="sticky top-0 z-50 border-b bg-background/90 px-3 py-2 lg:hidden" />
              }
            >
              <MobileHeader />
            </Suspense>

            {/* Desktop header */}
            <Suspense
              fallback={
                <div className="sticky top-0 z-40 hidden border-b bg-background/90 px-4 py-3 lg:block" />
              }
            >
              <DesktopHeader />
            </Suspense>

            <div className="grid min-h-dvh lg:grid-cols-[280px_1fr]">
              <aside className="hidden lg:block">
                <Suspense fallback={<div className="h-dvh border-r" />}>
                  <PlacesSidebar />
                </Suspense>
              </aside>
              <main className="min-w-0">{children}</main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
