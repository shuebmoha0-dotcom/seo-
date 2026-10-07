"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sparkles, ArrowRight, Menu, X } from "lucide-react";

export function PublicNavbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isPricing = pathname === "/pricing";
  const isBlog = pathname?.startsWith("/blog");

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-neutral-200/80">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF642D] to-[#FF4500] flex items-center justify-center shadow-sm group-hover:scale-105 group-hover:shadow-md transition-all">
            {/* Bold High-Contrast White + Navy Vector Dart */}
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 drop-shadow-xs">
              {/* Outer Speed Fin */}
              <path d="M4 19L9 15L6 11L3 14L4 19Z" fill="#FFF" fillOpacity="0.85" />
              {/* Main Supersonic Dart Body */}
              <path d="M8 15L19 4L20 5L12 16L8 15Z" fill="#FFFFFF" />
              {/* Dark Navy Shadow Wing for depth */}
              <path d="M12 16L15 19L19 19L16 14L12 16Z" fill="#00102A" />
              {/* Sharp Dart Tip */}
              <path d="M17 3L21 3L21 7L19 4L17 3Z" fill="#FFFFFF" />
            </svg>
          </div>
          <span className="font-black text-lg tracking-tight text-neutral-950">
            Outdart<span className="text-[#FF642D]">.</span>
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-neutral-600">
          <Link
            href="/#how-it-works"
            className="hover:text-neutral-900 transition-colors"
          >
            How It Works
          </Link>
          <Link
            href="/#capabilities"
            className="hover:text-neutral-900 transition-colors"
          >
            Capabilities
          </Link>
          <Link
            href="/pricing"
            className={`transition-colors ${
              isPricing
                ? "text-indigo-600 font-bold"
                : "hover:text-neutral-900"
            }`}
          >
            Pricing
          </Link>
          <Link
            href="/blog"
            className={`transition-colors ${
              isBlog
                ? "text-indigo-600 font-bold"
                : "hover:text-neutral-900"
            }`}
          >
            Blog
          </Link>
        </nav>

        {/* Right Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 px-3 py-2 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/login"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs hover:shadow-sm flex items-center gap-1.5"
          >
            <span>Start Free Trial</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-neutral-600 hover:text-neutral-900 focus:outline-none"
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-b border-neutral-200 bg-white px-6 py-4 space-y-3">
          <Link
            href="/#how-it-works"
            onClick={() => setMobileOpen(false)}
            className="block text-sm font-semibold text-neutral-700 py-1.5"
          >
            How It Works
          </Link>
          <Link
            href="/#capabilities"
            onClick={() => setMobileOpen(false)}
            className="block text-sm font-semibold text-neutral-700 py-1.5"
          >
            Capabilities
          </Link>
          <Link
            href="/pricing"
            onClick={() => setMobileOpen(false)}
            className={`block text-sm font-semibold py-1.5 ${
              isPricing ? "text-indigo-600 font-bold" : "text-neutral-700"
            }`}
          >
            Pricing
          </Link>
          <Link
            href="/blog"
            onClick={() => setMobileOpen(false)}
            className={`block text-sm font-semibold py-1.5 ${
              isBlog ? "text-indigo-600 font-bold" : "text-neutral-700"
            }`}
          >
            Blog
          </Link>
          <div className="pt-3 border-t border-neutral-100 flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="text-center text-sm font-semibold text-neutral-700 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="text-center bg-indigo-600 text-white font-bold text-sm py-2.5 rounded-xl shadow-xs"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
