import React from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20">
      {/* Header */}
      <header className="border-b border-neutral-200 py-4 px-6 max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/">
          <BrandLogo size="md" />
        </Link>
        <Link
          href="/login"
          className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-200 hover:border-neutral-300 transition-colors"
        >
          Sign In
        </Link>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-16 space-y-8">
        <div className="space-y-2">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Legal</span>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Privacy Policy</h1>
          <p className="text-xs text-neutral-500">Last updated: October 8, 2026</p>
        </div>

        <div className="prose prose-neutral text-sm leading-relaxed text-neutral-700 space-y-6">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-neutral-900">1. Introduction</h2>
            <p>
              Welcome to <strong>Outdart</strong> ("we", "our", or "us"). Outdart is an autonomous search engine optimization platform accessible via outdart.com. We are committed to protecting your privacy and ensuring your business data and website metrics remain secure and private.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-neutral-900">2. Information We Collect</h2>
            <p>When you register and connect your website to Outdart, we collect:</p>
            <ul className="list-disc pl-5 space-y-1 text-neutral-600">
              <li><strong>Account Information:</strong> Your name, email address, and authentication credentials.</li>
              <li><strong>Website & Domain Data:</strong> Connected domain URLs, sitemaps, and technical website structure.</li>
              <li><strong>Google API & Search Console Data:</strong> When you connect Google Search Console via OAuth, we access search queries, clicks, impressions, and ranking positions solely to deliver SEO analytics and keyword recommendations.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-neutral-900">3. Google User Data Policy & Limited Use</h2>
            <p>
              Outdart’s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 underline font-medium"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <p>
              Specifically:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-neutral-600">
              <li>We only request <strong>read-only access</strong> (<code>webmasters.readonly</code>) to fetch performance metrics.</li>
              <li>We never sell, rent, or transfer your Google Search Console data to third parties.</li>
              <li>Your data is never used to train generalized AI models without your consent.</li>
              <li>Tokens are encrypted server-side with AES-256 encryption.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-neutral-900">4. How We Use Information</h2>
            <p>We use the collected information exclusively to:</p>
            <ul className="list-disc pl-5 space-y-1 text-neutral-600">
              <li>Monitor search impressions, query rankings, and page click-through rates.</li>
              <li>Identify content decay, technical SEO regressions, and growth opportunities.</li>
              <li>Generate targeted SEO content plans and optimizations tailored to your domain.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-neutral-900">5. Data Retention & Deletion</h2>
            <p>
              You maintain full ownership of your data. You may disconnect Google Search Console or delete your Outdart account at any time from your account settings. Upon disconnection, stored OAuth access tokens and cached metrics are permanently deleted from our servers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-neutral-900">6. Contact Us</h2>
            <p>
              For questions regarding this Privacy Policy or your data, contact our data protection team at:{' '}
              <a href="mailto:support@outdart.com" className="text-indigo-600 underline font-semibold">
                support@outdart.com
              </a>.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-8 px-6 text-center text-xs text-neutral-500">
        <p>© {new Date().getFullYear()} Outdart Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
