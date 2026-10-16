import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#ffffff",
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://outdart.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Outdart — Autonomous AI SEO Agent & Organic Growth Engine",
    template: "%s | Outdart",
  },
  description: "Autonomous AI SEO platform that tracks live Search Console rankings, executes keyword gap clusters, writes editorial long-form articles, and auto-publishes to your CMS 24/7.",
  keywords: [
    "autonomous seo agent",
    "ai seo software",
    "automated seo platform",
    "ai keyword research",
    "programmatic seo engine",
    "zero touch seo",
    "google search console automation",
  ],
  authors: [{ name: "Outdart Engineering" }],
  creator: "Outdart",
  publisher: "Outdart",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    title: "Outdart — Autonomous AI SEO Agent & Organic Growth Engine",
    description: "24/7 autonomous SEO execution: ranking tracking, topical authority clustering, automatic publishing, and technical audits on complete autopilot.",
    siteName: "Outdart",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Outdart Autonomous SEO Growth Engine",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Outdart — Autonomous AI SEO Agent & Organic Growth Engine",
    description: "Autonomous SEO platform that tracks rankings, reverses competitor content gaps, and auto-publishes high-ROI articles.",
    images: ["/og-image.png"],
    creator: "@outdart",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
  verification: {
    google: "6ZJvr1JSEEJ8eX9ew3NEnOMKJoi5sZrO9oLhyZbnNIc",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Outdart",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "url": "https://outdart.com",
      "description": "Autonomous AI SEO platform that tracks live Google rankings, uncovers competitor content gaps, and drafts high-ranking articles on complete autopilot.",
      "offers": {
        "@type": "Offer",
        "price": "49.00",
        "priceCurrency": "USD",
      },
    },
    {
      "@type": "Organization",
      "name": "Outdart",
      "url": "https://outdart.com",
      "logo": "https://outdart.com/icon.svg",
      "sameAs": [
        "https://twitter.com/outdart",
        "https://github.com/shuebmoha0-dotcom/seo-",
      ],
    },
    {
      "@type": "WebSite",
      "name": "Outdart",
      "url": "https://outdart.com",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://outdart.com/blog?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans bg-white text-neutral-900 antialiased min-h-screen">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
