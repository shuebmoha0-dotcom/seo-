"use client";

import { Sidebar } from "@/components/Sidebar";
import { Check, Sparkles, Zap, ShieldCheck } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-100 selection:bg-indigo-500/30">
      <Sidebar />

      <div className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">
        <header className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" /> Simple, Transparent Pricing
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-4">
            Choose the plan that's right for your SaaS
          </h1>
          <p className="text-neutral-400 text-sm">
            Scale your organic rankings with an autonomous AI agent working for you 24/7.
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="inline-flex items-center bg-neutral-900 border border-neutral-800 p-1 rounded-xl mt-6">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${!annual ? "bg-indigo-600 text-white shadow-md" : "text-neutral-400 hover:text-neutral-200"}`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${annual ? "bg-indigo-600 text-white shadow-md" : "text-neutral-400 hover:text-neutral-200"}`}
            >
              <span>Annual Billing</span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded font-bold">Save 20%</span>
            </button>
          </div>
        </header>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto mb-16">
          {/* Starter */}
          <div className="bg-neutral-900/60 border border-neutral-900 p-8 rounded-3xl flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-white text-xl mb-2">Starter</h3>
              <p className="text-xs text-neutral-400 mb-6">Perfect for small SaaS websites and early stage startups.</p>
              <div className="text-4xl font-bold text-white mb-6">
                ${annual ? "24" : "29"} <span className="text-sm font-normal text-neutral-500">/mo</span>
              </div>
              <ul className="space-y-3 text-xs text-neutral-300 mb-8">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-400" /> 1 Website</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-400" /> AI SEO Agent (24/7)</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-400" /> 100 Automated PRs/month</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-400" /> Keyword &amp; Competitor Research</li>
              </ul>
            </div>
            <Link href="/onboarding" className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-semibold py-3 rounded-xl text-center text-xs transition-colors">
              Get Started Free
            </Link>
          </div>

          {/* Growth */}
          <div className="bg-gradient-to-b from-indigo-900/40 to-neutral-900 border-2 border-indigo-500/60 p-8 rounded-3xl flex flex-col justify-between relative shadow-[0_0_40px_rgba(79,70,229,0.3)]">
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full">MOST POPULAR</span>
            <div>
              <h3 className="font-bold text-white text-xl mb-2">Growth</h3>
              <p className="text-xs text-neutral-400 mb-6">Ideal for growing SaaS companies scaling traffic.</p>
              <div className="text-4xl font-bold text-white mb-6">
                ${annual ? "63" : "79"} <span className="text-sm font-normal text-neutral-500">/mo</span>
              </div>
              <ul className="space-y-3 text-xs text-neutral-300 mb-8">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-400" /> 5 Websites</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-400" /> Everything in Starter</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-400" /> Technical SEO Automation</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-400" /> AI Content Generation</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-400" /> Priority Support</li>
              </ul>
            </div>
            <Link href="/onboarding" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl text-center text-xs transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)]">
              Get Started Free
            </Link>
          </div>

          {/* Agency */}
          <div className="bg-neutral-900/60 border border-neutral-900 p-8 rounded-3xl flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-white text-xl mb-2">Agency</h3>
              <p className="text-xs text-neutral-400 mb-6">For agencies managing multiple client accounts.</p>
              <div className="text-4xl font-bold text-white mb-6">
                ${annual ? "159" : "199"} <span className="text-sm font-normal text-neutral-500">/mo</span>
              </div>
              <ul className="space-y-3 text-xs text-neutral-300 mb-8">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-400" /> 25 Websites</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-400" /> Everything in Growth</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-400" /> White-label Reports</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-400" /> Custom GitHub Integrations</li>
              </ul>
            </div>
            <Link href="/onboarding" className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-semibold py-3 rounded-xl text-center text-xs transition-colors">
              Get Started Free
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
