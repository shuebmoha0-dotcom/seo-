"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  Sparkles,
  Zap,
  ShieldCheck,
  ArrowRight,
  HelpCircle,
  CheckCircle2,
  ChevronDown,
  Layers,
  Globe,
  Bot,
} from "lucide-react";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "How does the autonomous AI SEO Agent work?",
      a: "The agent monitors your website, Google Search Console, and competitor movements 24/7. It diagnoses technical errors, discovers high-intent keywords, produces rank-ready content, and submits Pull Requests or WordPress drafts for your review before publishing.",
    },
    {
      q: "Does the agent publish directly to my website without approval?",
      a: "No. Safety is our top priority. Every single code change, meta tag update, or article draft requires your explicit approval via our dashboard or your connected Telegram bot. You maintain 100% control.",
    },
    {
      q: "Can I cancel, upgrade, or downgrade anytime?",
      a: "Yes, you can upgrade, downgrade, or cancel your subscription at any time directly from your billing settings. Changes take effect at the end of the current billing cycle.",
    },
    {
      q: "Which platforms and CMS are supported?",
      a: "SEO Autopilot supports WordPress (via Application Passwords or connector plugin), Next.js / GitHub repositories, Webflow, Shopify, and custom websites via our secure Content & Execution API.",
    },
    {
      q: "Is there a free trial available?",
      a: "Yes! Every plan includes a 14-day free trial so you can run your first technical crawl, discover keyword opportunities, and review the agent's work with zero upfront commitment.",
    },
  ];

  return (
    <div className="min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20 font-sans">
      {/* 1. Public Marketing Header */}
      <PublicNavbar />

      {/* 2. Hero Section */}
      <main className="max-w-7xl mx-auto px-6 pt-16 pb-24">
        <header className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-semibold mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
            <span>Simple, Transparent Pricing</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-neutral-900 leading-[1.1] mb-4">
            Predictable Plans for Every Stage of Growth
          </h1>
          <p className="text-neutral-600 text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
            Scale your organic search rankings, fix technical debts, and produce cornerstone content with an autonomous AI agent working 24/7.
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="inline-flex items-center bg-neutral-100 border border-neutral-200 p-1.5 rounded-2xl mt-8 shadow-inner">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                !annual
                  ? "bg-white text-neutral-900 shadow-sm border border-neutral-200"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                annual
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              <span>Annual Billing</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold tracking-wide uppercase ${
                annual ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
              }`}>
                Save 20%
              </span>
            </button>
          </div>
        </header>

        {/* 3. Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto mb-24">
          {/* Starter Plan */}
          <div className="bg-white border border-neutral-200 p-8 rounded-3xl flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow relative">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold tracking-wider uppercase text-neutral-500 bg-neutral-100 px-3 py-1 rounded-full">Starter</span>
              </div>
              <h3 className="font-extrabold text-neutral-900 text-2xl mb-2">Early Stage</h3>
              <p className="text-xs text-neutral-500 mb-6 leading-relaxed">
                Perfect for single-product SaaS founders and startups launching their organic search engine.
              </p>
              <div className="text-5xl font-extrabold text-neutral-900 mb-6 flex items-baseline gap-1">
                ${annual ? "24" : "29"}
                <span className="text-sm font-medium text-neutral-500">/month</span>
              </div>

              <div className="space-y-3 pt-6 border-t border-neutral-100 mb-8">
                <div className="flex items-center gap-3 text-xs text-neutral-700">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>1 Connected Website</strong></span>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-700">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Autonomous AI Agent (24/7 Monitoring)</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-700">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>50 Automated PRs &amp; Drafts / mo</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-700">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Weekly Technical SEO Crawl</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-700">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Google Search Console Integration</span>
                </div>
              </div>
            </div>

            <Link
              href="/login"
              className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-bold py-3.5 rounded-2xl text-center text-xs transition-colors flex items-center justify-center gap-2"
            >
              Start 14-Day Free Trial <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Growth Plan (Most Popular) */}
          <div className="bg-white border-2 border-indigo-600 p-8 rounded-3xl flex flex-col justify-between shadow-xl relative scale-105 z-10">
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] uppercase font-extrabold tracking-widest px-3.5 py-1 rounded-full shadow">
              Most Popular
            </span>
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold tracking-wider uppercase text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full">Growth</span>
              </div>
              <h3 className="font-extrabold text-neutral-900 text-2xl mb-2">Scaling SaaS</h3>
              <p className="text-xs text-neutral-500 mb-6 leading-relaxed">
                Ideal for high-growth tech companies scaling revenue, traffic, and multi-page directories.
              </p>
              <div className="text-5xl font-extrabold text-neutral-900 mb-6 flex items-baseline gap-1">
                ${annual ? "63" : "79"}
                <span className="text-sm font-medium text-neutral-500">/month</span>
              </div>

              <div className="space-y-3 pt-6 border-t border-neutral-100 mb-8">
                <div className="flex items-center gap-3 text-xs text-neutral-800">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span><strong>5 Connected Websites</strong></span>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-800">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Everything in Starter</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-800">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Full Autonomous Content Planner &amp; Engine</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-800">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Automated WordPress &amp; GitHub Publishing</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-800">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Competitor Keyword Gap Analysis</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-800">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Telegram Approval Bot Integration</span>
                </div>
              </div>
            </div>

            <Link
              href="/login"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl text-center text-xs transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              Start 14-Day Free Trial <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Agency Plan */}
          <div className="bg-white border border-neutral-200 p-8 rounded-3xl flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow relative">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold tracking-wider uppercase text-neutral-500 bg-neutral-100 px-3 py-1 rounded-full">Agency</span>
              </div>
              <h3 className="font-extrabold text-neutral-900 text-2xl mb-2">Agency &amp; Portfolio</h3>
              <p className="text-xs text-neutral-500 mb-6 leading-relaxed">
                For growth marketing agencies and media portfolios managing multiple client domains.
              </p>
              <div className="text-5xl font-extrabold text-neutral-900 mb-6 flex items-baseline gap-1">
                ${annual ? "159" : "199"}
                <span className="text-sm font-medium text-neutral-500">/month</span>
              </div>

              <div className="space-y-3 pt-6 border-t border-neutral-100 mb-8">
                <div className="flex items-center gap-3 text-xs text-neutral-700">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>25 Connected Websites</strong></span>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-700">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Everything in Growth</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-700">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Multi-Tenant Client Workspaces</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-700">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>White-Label Scheduled Executive Reports</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-700">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Dedicated Agent Execution Queues</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-700">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Custom Webhook &amp; REST API Access</span>
                </div>
              </div>
            </div>

            <Link
              href="/login"
              className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-bold py-3.5 rounded-2xl text-center text-xs transition-colors flex items-center justify-center gap-2"
            >
              Start 14-Day Free Trial <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* 4. Feature Comparison */}
        <section className="max-w-4xl mx-auto mb-24 border border-neutral-200 rounded-3xl p-8 bg-neutral-50/50">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Compare Capabilities</h2>
            <p className="text-xs text-neutral-500">Every plan includes enterprise grade security, automated backups, and 99.9% uptime.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500">
                  <th className="py-3 px-4 font-semibold">Features</th>
                  <th className="py-3 px-4 font-semibold text-center">Starter</th>
                  <th className="py-3 px-4 font-semibold text-center text-indigo-600">Growth</th>
                  <th className="py-3 px-4 font-semibold text-center">Agency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-700">
                <tr>
                  <td className="py-3.5 px-4 font-medium text-neutral-900">Connected Websites</td>
                  <td className="py-3.5 px-4 text-center">1</td>
                  <td className="py-3.5 px-4 text-center font-bold text-indigo-700 bg-indigo-50/40">5</td>
                  <td className="py-3.5 px-4 text-center">25</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-medium text-neutral-900">Autonomous Technical Crawler</td>
                  <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">Weekly</td>
                  <td className="py-3.5 px-4 text-center text-emerald-600 font-bold bg-indigo-50/40">Daily</td>
                  <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">Continuous</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-medium text-neutral-900">AI Content Writing Engine</td>
                  <td className="py-3.5 px-4 text-center">Standard</td>
                  <td className="py-3.5 px-4 text-center font-bold text-indigo-700 bg-indigo-50/40">Cornerstone Long-Form</td>
                  <td className="py-3.5 px-4 text-center font-bold">Cornerstone Long-Form</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-medium text-neutral-900">Execution Approvals</td>
                  <td className="py-3.5 px-4 text-center">Dashboard</td>
                  <td className="py-3.5 px-4 text-center font-bold text-indigo-700 bg-indigo-50/40">Dashboard &amp; Telegram</td>
                  <td className="py-3.5 px-4 text-center font-bold">Dashboard &amp; Telegram</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-medium text-neutral-900">Automated GitHub PRs</td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center bg-indigo-50/40"><Check className="w-4 h-4 text-indigo-600 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-medium text-neutral-900">Multi-User Client Access</td>
                  <td className="py-3.5 px-4 text-center text-neutral-300">—</td>
                  <td className="py-3.5 px-4 text-center text-neutral-300 bg-indigo-50/40">—</td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 5. FAQ Section */}
        <section className="max-w-3xl mx-auto mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-neutral-900 mb-3">Frequently Asked Questions</h2>
            <p className="text-sm text-neutral-500">Everything you need to know about our plans, safety, and integrations.</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="border border-neutral-200 rounded-2xl p-5 hover:border-neutral-300 transition-colors cursor-pointer bg-white"
                onClick={() => toggleFaq(idx)}
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-sm font-bold text-neutral-900">{faq.q}</h3>
                  <ChevronDown
                    className={`w-4 h-4 text-neutral-400 transition-transform ${
                      openFaq === idx ? "rotate-180 text-indigo-600" : ""
                    }`}
                  />
                </div>
                {openFaq === idx && (
                  <p className="mt-3 text-xs text-neutral-600 leading-relaxed border-t border-neutral-100 pt-3">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* Public Marketing Footer */}
      <PublicFooter />
    </div>
  );
}
