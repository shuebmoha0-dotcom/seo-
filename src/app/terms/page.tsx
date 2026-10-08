import React from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export default function TermsOfServicePage() {
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
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Terms of Service</h1>
          <p className="text-xs text-neutral-500">Last updated: October 8, 2026</p>
        </div>

        <div className="prose prose-neutral text-sm leading-relaxed text-neutral-700 space-y-6">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-neutral-900">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Outdart ("Platform", "Service"), provided via outdart.com, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-neutral-900">2. Service Description</h2>
            <p>
              Outdart provides automated SEO diagnostics, rank tracking, internal linking recommendations, and AI content planning tools for digital publishers and business websites.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-neutral-900">3. Third-Party Integrations</h2>
            <p>
              When connecting third-party services such as Google Search Console, Google Analytics, WordPress, or GitHub, you confirm that you have the requisite authority to manage those accounts and grant Outdart access to the respective APIs on your behalf.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-neutral-900">4. User Responsibilities & Acceptable Use</h2>
            <p>
              You agree not to use the platform to violate applicable search engine guidelines, generate automated spam, or infringe upon the intellectual property rights of third parties.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-neutral-900">5. Limitation of Liability</h2>
            <p>
              While Outdart provides algorithmic recommendations based on official search engine documentation and historical performance signals, we do not guarantee specific ranking positions or traffic levels. Search algorithms are controlled entirely by third-party search engines.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-neutral-900">6. Contact</h2>
            <p>
              Questions regarding these Terms of Service can be directed to{' '}
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
