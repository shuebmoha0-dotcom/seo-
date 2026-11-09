import React from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export default function RefundPolicyPage() {
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
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Refund &amp; Cancellation Policy</h1>
          <p className="text-xs text-neutral-500">Last updated: October 8, 2026</p>
        </div>

        <div className="prose prose-neutral text-sm leading-relaxed text-neutral-700 space-y-6">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-neutral-900">1. Merchant of Record</h2>
            <p>
              Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries and handles returns for Outdart (outdart.com) subscriptions.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-neutral-900">2. 14-Day Money-Back Guarantee (Refund Policy)</h2>
            <p>
              In accordance with Paddle buyer protection standards, Outdart offers a full <strong>14-day money-back guarantee</strong> on all new subscription purchases (Starter, Growth, and Agency plans, whether billed monthly or annually).
            </p>
            <p>
              If you are not satisfied with Outdart for any reason, you may request a full refund within 14 calendar days of your initial purchase date with no questions asked. Approved refunds are returned to your original payment method.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-neutral-900">3. Subscription Cancellation</h2>
            <p>
              You may cancel your recurring monthly or annual subscription at any time directly from your Outdart account billing settings or by emailing us. When you cancel, your subscription will remain active until the end of the current paid billing period, and you will not be charged again.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-neutral-900">4. How to Request a Refund</h2>
            <p>
              To request a refund within the 14-day refund window, please contact our team at{" "}
              <a href="mailto:support@outdart.com" className="text-indigo-600 underline font-semibold">
                support@outdart.com
              </a>{" "}
              or{" "}
              <a href="mailto:admin@outdart.com" className="text-indigo-600 underline font-semibold">
                admin@outdart.com
              </a>{" "}
              with your order receipt or account email address, or use the Paddle buyer support link included in your email receipt.
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
