import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { PlacesSidebar } from "@/components/places-sidebar";
import { Suspense } from "react";

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
          <div className="grid min-h-dvh grid-cols-[280px_1fr]">
            <Suspense fallback={<div className="h-dvh border-r" />}>
              <PlacesSidebar />
            </Suspense>
            <main className="min-w-0">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
