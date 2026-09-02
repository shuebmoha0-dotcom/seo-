"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Zap,
  FileText,
  Compass,
  Key,
  TrendingUp,
  Link as LinkIcon,
  Wrench,
  Layers,
  Settings,
  Sparkles,
  Bot,
  Crown,
  Search,
  Brain,
  Image as ImageIcon,
  Plug2,
  Clock,
  Users,
  Network,
} from "lucide-react";

import { WebsiteSwitcher } from "@/components/WebsiteSwitcher";

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Autopilot", href: "/autopilot", icon: Clock, badge: "New" },
    { name: "Project Memory", href: "/memory", icon: Brain },
    { name: "Strategy Agent", href: "/strategy", icon: Compass, badge: "AI" },
    { name: "Competitors", href: "/competitors", icon: Users, badge: "AI" },
    { name: "Opportunities", href: "/opportunities", icon: Zap, badge: "8" },
    { name: "Content Planner", href: "/content-planner", icon: FileText },
    { name: "On-Page SEO", href: "/on-page-seo", icon: Search, badge: "AI" },
    { name: "Internal Links", href: "/internal-linking", icon: LinkIcon, badge: "AI" },
    { name: "Image Agent", href: "/image-agent", icon: ImageIcon, badge: "AI" },
    { name: "Site Explorer", href: "/site-explorer", icon: Compass },
    { name: "Keywords", href: "/keywords", icon: Key },
    { name: "Rank Tracking", href: "/rank-tracking", icon: TrendingUp },
    { name: "Backlinks", href: "/backlinks", icon: LinkIcon },
    { name: "Technical SEO", href: "/technical-seo", icon: Wrench },
    { name: "Integrations", href: "/integrations", icon: Plug2 },
    { name: "Usage", href: "/usage", icon: Zap },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col justify-between min-h-screen p-4 select-none shrink-0">
      <div>
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 px-3 py-2 mb-4 group">
          <div className="p-2 bg-indigo-600 rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.3)] group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-neutral-900 tracking-tight leading-none text-base">SEO Autopilot</h1>
            <span className="text-[10px] text-neutral-500 font-medium tracking-wide">Autonomous SEO Agent</span>
          </div>
        </Link>

        {/* Central Website Switcher */}
        <div className="mb-4">
          <WebsiteSwitcher />
        </div>

        {/* Navigation */}
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href === "/dashboard" && pathname === "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)]"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-neutral-400"}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                    isActive
                      ? "bg-white/20 text-white border-white/30"
                      : "bg-indigo-50 text-indigo-600 border-indigo-200"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 pt-4 border-t border-neutral-200">
        {/* Usage Card */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-500 font-medium">Usage This Month</span>
            <span className="text-neutral-900 font-bold">78%</span>
          </div>
          <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full w-[78%]" />
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-500">
            <span>234 / 300 Credits used</span>
          </div>
          <span className="text-[10px] text-neutral-400 block">Renews in 18 days</span>

          <button className="w-full mt-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 rounded-xl transition-all flex items-center justify-center gap-1.5">
            <Crown className="w-3.5 h-3.5" /> Upgrade Plan
          </button>
        </div>

        {/* Footer Agent Status */}
        <div className="flex items-center justify-between px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Bot className="w-4 h-4 text-indigo-500" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            </div>
            <span className="text-xs font-medium text-neutral-700">AI Agent</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            Active 24/7
          </span>
        </div>
      </div>
    </aside>
  );
}
