import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Autonomous AI SEO Agent",
  description: "Your autonomous SEO employee that understands, researches, and executes.",
};

import { Providers } from "@/components/Providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white text-neutral-900 antialiased min-h-screen selection:bg-indigo-500/20`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
