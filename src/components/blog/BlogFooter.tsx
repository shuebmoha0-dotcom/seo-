import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

export function BlogFooter() {
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
              <span>Get Started Free</span>
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
            <div className="p-1.5 bg-indigo-600 rounded-lg">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-neutral-900 tracking-tight text-base">SEO Autopilot</span>
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
            <li><Link href="/#features" className="hover:text-indigo-600 transition-colors">Autonomous Agent</Link></li>
            <li><Link href="/#features" className="hover:text-indigo-600 transition-colors">Content Planner</Link></li>
            <li><Link href="/#features" className="hover:text-indigo-600 transition-colors">Technical Auditing</Link></li>
            <li><Link href="/#features" className="hover:text-indigo-600 transition-colors">Rank Tracking</Link></li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold text-neutral-900 text-xs uppercase tracking-wider">Resources</h4>
          <ul className="space-y-2 text-xs text-neutral-600">
            <li><Link href="/blog" className="hover:text-indigo-600 transition-colors font-medium text-indigo-600">SEO Blog</Link></li>
            <li><Link href="/blog/how-autonomous-ai-agents-redefine-seo" className="hover:text-indigo-600 transition-colors">AI Agents Guide</Link></li>
            <li><Link href="/blog/the-1400-word-content-framework" className="hover:text-indigo-600 transition-colors">Content Framework</Link></li>
            <li><Link href="/blog/google-search-console-striking-distance" className="hover:text-indigo-600 transition-colors">GSC Strategy</Link></li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold text-neutral-900 text-xs uppercase tracking-wider">Platform</h4>
          <ul className="space-y-2 text-xs text-neutral-600">
            <li><Link href="/pricing" className="hover:text-indigo-600 transition-colors">Pricing</Link></li>
            <li><Link href="/login" className="hover:text-indigo-600 transition-colors">Sign In</Link></li>
            <li><Link href="/login" className="hover:text-indigo-600 transition-colors">Free Trial</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
