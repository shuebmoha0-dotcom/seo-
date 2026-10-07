import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="bg-neutral-50 border-t border-neutral-200 mt-20">
      {/* Pre-Footer Conversion Banner */}
      <div className="max-w-7xl mx-auto px-6 pt-16 pb-12">
        <div className="bg-gradient-to-br from-indigo-900 to-neutral-900 rounded-3xl p-8 md:p-12 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl text-center md:text-left z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-semibold backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>Zero-Touch Autopilot</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Ready to automate your website's organic growth?
            </h2>
            <p className="text-neutral-300 text-sm leading-relaxed">
              Connect your domain, let our autonomous AI agents discover high-ROI keywords, publish authoritative content, and repair technical SEO on autopilot.
            </p>
          </div>

          <div className="z-10 shrink-0">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-white text-neutral-900 hover:bg-neutral-100 font-bold px-6 py-3.5 rounded-xl transition-all shadow-lg hover:shadow-white/20 text-sm"
            >
              <span>Start 14-Day Free Trial</span>
              <ArrowRight className="w-4 h-4 text-indigo-600" />
            </Link>
          </div>

          {/* Background decorative gradient orb */}
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-6 py-12 border-t border-neutral-200 grid grid-cols-2 md:grid-cols-5 gap-8 text-sm">
        <div className="col-span-2 space-y-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#00102A] border border-[#0A2540] flex items-center justify-center overflow-hidden">
              <svg viewBox="0 0 32 32" fill="none" className="w-4 h-4">
                <path d="M7 25L13 19L11 15L6 19L7 25Z" fill="#FF642D" opacity="0.85" />
                <path d="M10 26L16 19L14 14L8 21L10 26Z" fill="#FF8A00" />
                <path d="M12 18L15 21L17 17L13 15L12 18Z" fill="#1C3D6E" />
                <path d="M18 12L21 15L17 17L15 13L18 12Z" fill="#1C3D6E" />
                <path d="M14 17L24 7L25 8L17 18L14 17Z" fill="#FF642D" />
                <path d="M22 6L26 6L26 10L24 7L22 6Z" fill="#FF4500" />
                <polygon points="17,14 23,8 20,17 17,14" fill="#FFA143" />
              </svg>
            </div>
            <span className="font-extrabold text-neutral-950 tracking-tight text-base">Outdart<span className="text-[#FF642D]">.</span></span>
          </Link>
          <p className="text-neutral-500 text-xs leading-relaxed max-w-sm">
            Autonomous enterprise AI SEO engine. Continuously mines search intent, drafts long-form editorial content, resolves technical debt, and accelerates Page 1 rankings.
          </p>
          <p className="text-xs text-neutral-400">
            © {new Date().getFullYear()} SEO Autopilot. All rights reserved.
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold text-neutral-900 text-xs uppercase tracking-wider">Product</h4>
          <ul className="space-y-2 text-xs text-neutral-600">
            <li><Link href="/#how-it-works" className="hover:text-indigo-600 transition-colors">How It Works</Link></li>
            <li><Link href="/#capabilities" className="hover:text-indigo-600 transition-colors">Capabilities</Link></li>
            <li><Link href="/pricing" className="hover:text-indigo-600 transition-colors">Pricing</Link></li>
            <li><Link href="/blog" className="hover:text-indigo-600 transition-colors">Engineering Blog</Link></li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold text-neutral-900 text-xs uppercase tracking-wider">Connectors</h4>
          <ul className="space-y-2 text-xs text-neutral-600">
            <li><span className="text-neutral-500">WordPress Connector</span></li>
            <li><span className="text-neutral-500">GitHub (Next.js / React)</span></li>
            <li><span className="text-neutral-500">Custom Webhook API</span></li>
            <li><span className="text-neutral-500">Universal Web Crawler</span></li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold text-neutral-900 text-xs uppercase tracking-wider">Legal</h4>
          <ul className="space-y-2 text-xs text-neutral-600">
            <li><Link href="/privacy" className="hover:text-indigo-600 transition-colors">Privacy Policy</Link></li>
            <li><Link href="/terms" className="hover:text-indigo-600 transition-colors">Terms of Service</Link></li>
            <li><Link href="/security" className="hover:text-indigo-600 transition-colors">Security Architecture</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
