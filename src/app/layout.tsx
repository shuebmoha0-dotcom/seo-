import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Outdart — Autonomous SEO Growth Engine",
  description: "Autonomous SEO platform powered by Semrush search intelligence. Continuously tracks rankings, reverses competitor keyword gaps, and automates high-ROI organic growth.",
  icons: {
    icon: "/icon.svg",
  },
  verification: {
    google: "6ZJvr1JSEEJ8eX9ew3NEnOMKJoi5sZrO9oLhyZbnNIc",
  },
};

import { Providers } from "@/components/Providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans bg-white text-neutral-900 antialiased min-h-screen">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
