import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { PlacesSidebar } from "@/components/places-sidebar";
import { Suspense } from "react";
import { MobileHeader } from "@/components/mobile-header";

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
            <Suspense fallback={<div className="sticky top-0 z-50 border-b bg-background/90 px-3 py-2 lg:hidden" />}>
              <MobileHeader />
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
