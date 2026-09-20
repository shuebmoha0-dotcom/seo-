"use client";

import Link from "next/link";
import { useState } from "react";
import { Sparkles, Menu, X, ArrowRight } from "lucide-react";

export function BlogNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="p-2 bg-indigo-600 rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.25)] group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-neutral-900 tracking-tight text-lg">SEO Autopilot</span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-600">
          <Link href="/#features" className="hover:text-neutral-900 transition-colors">
            Features
          </Link>
          <Link href="/#how-it-works" className="hover:text-neutral-900 transition-colors">
            How it Works
          </Link>
          <Link href="/pricing" className="hover:text-neutral-900 transition-colors">
            Pricing
          </Link>
          <Link href="/blog" className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors">
            Blog
          </Link>
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-indigo-500/20"
          >
            <span>Start Free Trial</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-neutral-600 hover:text-neutral-900 focus:outline-none"
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-neutral-200 bg-white px-6 py-5 space-y-4">
          <nav className="flex flex-col gap-3.5 text-base font-medium text-neutral-700">
            <Link
              href="/#features"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-indigo-600 transition-colors"
            >
              Features
            </Link>
            <Link
              href="/#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-indigo-600 transition-colors"
            >
              How it Works
            </Link>
            <Link
              href="/pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-indigo-600 transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/blog"
              onClick={() => setMobileMenuOpen(false)}
              className="text-indigo-600 font-semibold"
            >
              Blog
            </Link>
          </nav>
          <div className="pt-4 border-t border-neutral-100 flex flex-col gap-3">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="text-center text-sm font-semibold py-2.5 text-neutral-700 hover:text-neutral-900 border border-neutral-200 rounded-xl"
            >
              Log in
            </Link>
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="text-center text-sm font-semibold py-2.5 bg-indigo-600 text-white rounded-xl shadow-sm hover:bg-indigo-700"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
