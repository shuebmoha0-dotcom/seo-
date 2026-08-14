"use client";

import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Bot,
  CheckCircle2,
  Zap,
  FileText,
  Wrench,
  ShieldCheck,
  TrendingUp,
  Star,
  Check,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20">

      {/* 1. Header Navigation */}
      <header className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.3)]">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-neutral-900 tracking-tight text-lg">SEO Autopilot</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-500">
          <a href="#features" className="hover:text-neutral-900 transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-neutral-900 transition-colors">How it Works</a>
          <a href="#pricing" className="hover:text-neutral-900 transition-colors">Pricing</a>
          <a href="#resources" className="hover:text-neutral-900 transition-colors">Resources</a>
          <a href="#company" className="hover:text-neutral-900 transition-colors">Company</a>
        </nav>

        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors">
            Log in
          </Link>
          <Link
            href="/login"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm"
          >
            Get Started Free
          </Link>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Autonomous AI SEO Agent
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-neutral-900 leading-none">
            Your Autonomous <br />
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-400 bg-clip-text text-transparent">
              SEO Agent.
            </span><br />
            Working 24/7.
          </h1>

          <p className="text-neutral-500 text-base md:text-lg leading-relaxed">
            SEO Autopilot finds opportunities, builds the strategy, creates content, and takes action — with you in control. More rankings. More traffic. Less manual work.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
            <Link
              href="/login"
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Link>
            <button className="w-full sm:w-auto bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-700 font-semibold px-6 py-3.5 rounded-xl transition-colors shadow-sm">
              Book a Demo
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-indigo-500" /> No credit card required</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-indigo-500" /> Setup in 60 seconds</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-indigo-500" /> Cancel anytime</span>
          </div>
        </div>

        {/* Hero Product Graphic */}
        <div className="lg:col-span-6">
          <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Live Agent Active
              </span>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-6 text-center">
              {[
                { label: "Organic Traffic", value: "18,247", color: "text-neutral-900" },
                { label: "Impressions", value: "224K", color: "text-neutral-900" },
                { label: "Avg. Position", value: "12.4", color: "text-neutral-900" },
                { label: "Opportunities", value: "31", color: "text-indigo-600" },
              ].map((m, i) => (
                <div key={i} className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                  <span className="text-[10px] text-neutral-500 block">{m.label}</span>
                  <span className={`text-lg font-bold ${m.color}`}>{m.value}</span>
                </div>
              ))}
            </div>

            <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bot className="w-5 h-5 text-indigo-500" />
                <div>
                  <h4 className="text-xs font-bold text-neutral-900">Your AI SEO agent is running</h4>
                  <p className="text-[10px] text-neutral-500">Last activity: 2 min ago</p>
                </div>
              </div>
              <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-md font-semibold">8 Pending Actions</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Trusted Logos */}
      <section className="border-y border-neutral-200 py-10 text-center bg-neutral-50">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-6">Trusted by marketers and agencies worldwide</p>
        <div className="flex flex-wrap items-center justify-center gap-10 text-neutral-400 font-bold text-lg">
          <span>loom</span>
          <span>Webflow</span>
          <span>.zapier</span>
          <span>HubSpot</span>
          <span>mailchimp</span>
          <span>ClickUp</span>
          <span>airbnb</span>
          <span>Notion</span>
        </div>
      </section>

      {/* 4. How It Works */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest block mb-2">How It Works</span>
          <h2 className="text-3xl md:text-4xl font-bold text-neutral-900">Autonomous SEO in 4 simple steps</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { n: "1", title: "Connect Your Website", desc: "Connect Google Search Console, Analytics, and add your website URL in seconds." },
            { n: "2", title: "AI Agent Analyzes Everything", desc: "Our AI agent crawls your site, analyzes competitors, and finds high-impact opportunities." },
            { n: "3", title: "Review & Approve Actions", desc: "See exactly what we'll do and approve the actions you want executed." },
            { n: "4", title: "We Execute & Grow Rankings", desc: "Your agent executes tasks, tracks results, and grows your rankings — 24/7." },
          ].map(({ n, title, desc }) => (
            <div key={n} className="bg-white border border-neutral-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <span className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center mb-4">{n}</span>
              <h3 className="font-semibold text-neutral-900 mb-2 text-base">{title}</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Features Grid */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20 bg-neutral-50 rounded-3xl border border-neutral-200 mb-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest block mb-2">Powerful Features</span>
          <h2 className="text-3xl md:text-4xl font-bold text-neutral-900">Everything you need to rank higher</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { Icon: Bot, title: "Autonomous AI Agent", desc: "Your AI agent works 24/7 to find opportunities, build strategy, and execute tasks automatically." },
            { Icon: Zap, title: "Smart Opportunity Finder", desc: "Find high-impact keywords, content gaps, technical issues, and link opportunities automatically." },
            { Icon: FileText, title: "Content That Ranks", desc: "AI creates SEO-optimized content that's engaging, helpful, and built to rank on page 1." },
            { Icon: Wrench, title: "Technical SEO Fixes", desc: "Find and fix technical issues, optimize speed, schema, and internal links automatically." },
            { Icon: ShieldCheck, title: "Human in Control", desc: "You approve every action. Full transparency and complete control at all times." },
            { Icon: TrendingUp, title: "Track & Improve", desc: "Track rankings, traffic, and results in real time. Your agent keeps improving performance." },
          ].map(({ Icon, title, desc }, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
              <Icon className="w-8 h-8 text-indigo-500 mb-4" />
              <h3 className="font-semibold text-neutral-900 text-base mb-2">{title}</h3>
              <p className="text-xs text-neutral-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Metrics Bar */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest block mb-2">Real Results from Our Users</span>
        <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-12">Better rankings. More traffic. Real growth.</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: "+115%", label: "Average increase in organic traffic" },
            { value: "+78%", label: "Increase in top 3 keyword rankings" },
            { value: "-63%", label: "Reduction in manual SEO work" },
            { value: "4.9/5", label: "Average customer rating", star: true },
          ].map(({ value, label, star }, i) => (
            <div key={i} className="bg-white border border-neutral-200 p-6 rounded-2xl shadow-sm">
              <div className="text-3xl font-bold text-indigo-600 mb-1 flex items-center justify-center gap-1">
                {value} {star && <Star className="w-4 h-4 fill-amber-400 text-amber-400" />}
              </div>
              <div className="text-xs text-neutral-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Pricing Section */}
      <section id="pricing" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest block mb-2">Simple, Transparent Pricing</span>
          <h2 className="text-3xl md:text-4xl font-bold text-neutral-900">Choose the plan that's right for you</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {/* Starter */}
          <div className="bg-white border border-neutral-200 p-8 rounded-3xl flex flex-col justify-between shadow-sm">
            <div>
              <h3 className="font-bold text-neutral-900 text-xl mb-2">Starter</h3>
              <p className="text-xs text-neutral-500 mb-6">Perfect for small websites and startups.</p>
              <div className="text-4xl font-bold text-neutral-900 mb-6">$29 <span className="text-sm font-normal text-neutral-400">/mo</span></div>
              <ul className="space-y-3 text-xs text-neutral-600 mb-8">
                {["1 Website", "AI SEO Agent", "Keyword & Competitor Research", "Content Suggestions", "Basic Reports"].map(f => (
                  <li key={f} className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-500" /> {f}</li>
                ))}
              </ul>
            </div>
            <Link href="/onboarding" className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold py-3 rounded-xl text-center text-xs transition-colors border border-neutral-200">
              Get Started Free
            </Link>
          </div>

          {/* Growth — Most Popular */}
          <div className="bg-indigo-600 border-2 border-indigo-600 p-8 rounded-3xl flex flex-col justify-between relative shadow-xl">
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-white text-indigo-600 text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full border border-indigo-200">MOST POPULAR</span>
            <div>
              <h3 className="font-bold text-white text-xl mb-2">Growth</h3>
              <p className="text-xs text-indigo-200 mb-6">Ideal for growing businesses.</p>
              <div className="text-4xl font-bold text-white mb-6">$79 <span className="text-sm font-normal text-indigo-300">/mo</span></div>
              <ul className="space-y-3 text-xs text-indigo-100 mb-8">
                {["5 Websites", "Everything in Starter", "Technical SEO Automation", "Content Creation", "Priority Support"].map(f => (
                  <li key={f} className="flex items-center gap-2"><Check className="w-4 h-4 text-white" /> {f}</li>
                ))}
              </ul>
            </div>
            <Link href="/onboarding" className="w-full bg-white hover:bg-indigo-50 text-indigo-600 font-semibold py-3 rounded-xl text-center text-xs transition-all shadow-sm">
              Get Started Free
            </Link>
          </div>

          {/* Agency */}
          <div className="bg-white border border-neutral-200 p-8 rounded-3xl flex flex-col justify-between shadow-sm">
            <div>
              <h3 className="font-bold text-neutral-900 text-xl mb-2">Agency</h3>
              <p className="text-xs text-neutral-500 mb-6">For agencies & SEO professionals.</p>
              <div className="text-4xl font-bold text-neutral-900 mb-6">$199 <span className="text-sm font-normal text-neutral-400">/mo</span></div>
              <ul className="space-y-3 text-xs text-neutral-600 mb-8">
                {["25 Websites", "Everything in Growth", "White-label Reports", "Client Management", "API Access"].map(f => (
                  <li key={f} className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-500" /> {f}</li>
                ))}
              </ul>
            </div>
            <Link href="/onboarding" className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold py-3 rounded-xl text-center text-xs transition-colors border border-neutral-200">
              Get Started Free
            </Link>
          </div>
        </div>
      </section>

      {/* 8. Bottom CTA Banner */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="bg-indigo-600 rounded-3xl p-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left shadow-lg">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Not sure yet? Start with our free plan.</h3>
              <p className="text-xs text-indigo-200 mt-1">Explore all features and upgrade anytime. No risk.</p>
            </div>
          </div>
          <Link href="/onboarding" className="bg-white hover:bg-indigo-50 text-indigo-600 font-semibold px-6 py-3.5 rounded-xl transition-all shrink-0 text-sm flex items-center gap-2 shadow-sm">
            Get Started Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-5 gap-8 text-xs text-neutral-500">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-indigo-600 rounded-lg"><Sparkles className="w-4 h-4 text-white" /></div>
              <span className="font-bold text-neutral-900 text-sm">SEO Autopilot</span>
            </div>
            <p className="text-neutral-500 leading-relaxed">Your autonomous AI SEO agent that finds opportunities, builds strategy, creates content, and grows rankings with human approval and complete control.</p>
          </div>
          {[
            { heading: "Product", links: ["Features", "How It Works", "Pricing", "Integrations", "Roadmap", "Changelog"] },
            { heading: "Resources", links: ["Blog", "Docs", "Case Studies", "Templates", "Help Center", "Webinars"] },
            { heading: "Company", links: ["About Us", "Careers", "Partners", "Affiliate Program", "Press", "Contact"] },
            { heading: "Legal", links: ["Privacy Policy", "Terms of Service", "Cookie Policy", "GDPR", "Data Processing", "Security"] },
          ].map(({ heading, links }) => (
            <div key={heading}>
              <h4 className="font-semibold text-neutral-900 mb-3">{heading}</h4>
              <ul className="space-y-2">
                {links.map(l => <li key={l}><a href="#" className="hover:text-neutral-900 transition-colors">{l}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-neutral-200 py-5 text-center text-[11px] text-neutral-400">
          © 2026 SEO Autopilot. All rights reserved. — Made with ♥ for marketers.
        </div>
      </footer>
    </div>
  );
}
