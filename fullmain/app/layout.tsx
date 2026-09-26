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

export const metadata: Metadata = {
  title: "KawaiiPay — Verified Attention Commerce",
  description: "Shop products. Share what you love. Get rewarded for genuine attention, settled on Sui.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* Some browser extensions inject attributes into <body> before React hydrates
          (e.g. a CAPTCHA/anti-bot helper) — harmless, but without this it logs a scary
          hydration-mismatch warning that has nothing to do with the app's own code. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
