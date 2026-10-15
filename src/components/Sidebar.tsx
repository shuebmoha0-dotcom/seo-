"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isPlatformAdmin } from "@/lib/auth/admin";
import {
  LayoutDashboard,
  Zap,
  FileText,
  Compass,
  Key,
  TrendingUp,
  Link as LinkIcon,
  Wrench,
  Settings,
  Brain,
  Search,
  Image as ImageIcon,
  Plug2,
  Clock,
  Users,
  BookOpen,
  Gauge,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import { WebsiteSwitcher } from "@/components/WebsiteSwitcher";
import { useWebsite } from "@/lib/context/WebsiteContext";
import { BrandLogo } from "@/components/BrandLogo";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  tag?: string;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

export function Sidebar() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { websites, planLimit } = useWebsite();

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (user) {
          let admin = isPlatformAdmin(user.email, user.user_metadata?.role || (user as any).role);
          if (!admin) {
            const { data: dbUser } = await supabase
              .from("users")
              .select("role")
              .eq("id", user.id)
              .single();
            admin = isPlatformAdmin(user.email, dbUser?.role || (user as any).role);
          }
          setIsAdmin(admin);
        }
      });
    } catch {
      // Fallback
    }
  }, []);

  const groups: NavGroup[] = [
    {
      items: [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Autopilot", href: "/autopilot", icon: Clock },
      ],
    },
    {
      label: "Strategy",
      items: [
        { name: "Strategy", href: "/strategy", icon: Compass },
        { name: "Opportunities", href: "/opportunities", icon: Zap },
        { name: "Competitors", href: "/competitors", icon: Users },
        { name: "Project Memory", href: "/memory", icon: Brain },
      ],
    },
    {
      label: "Content",
      items: [
        { name: "Content Planner", href: "/content-planner", icon: FileText },
        { name: "On-Page SEO", href: "/on-page-seo", icon: Search },
        { name: "Internal Links", href: "/internal-linking", icon: LinkIcon },
        { name: "Images", href: "/image-agent", icon: ImageIcon },
        ...(isAdmin ? [{ name: "Platform Blog", href: "/blog/admin", icon: BookOpen, tag: "Admin" }] : []),
      ],
    },
    {
      label: "Research",
      items: [
        { name: "Keywords", href: "/keywords", icon: Key },
        { name: "Rank Tracking", href: "/rank-tracking", icon: TrendingUp },
        { name: "Backlinks", href: "/backlinks", icon: LinkIcon },
        { name: "Site Explorer", href: "/site-explorer", icon: Compass },
      ],
    },
    {
      label: "Technical",
      items: [{ name: "Technical SEO", href: "/technical-seo", icon: Wrench }],
    },
  ];

  const workspace: NavItem[] = [
    { name: "Integrations", href: "/integrations", icon: Plug2 },
    { name: isAdmin ? "Token Controls" : "Usage", href: "/usage", icon: Gauge, ...(isAdmin ? { tag: "Admin" } : {}) },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const isActiveRoute = (href: string) =>
    pathname === href || (href === "/dashboard" && pathname === "/") || (href !== "/" && pathname?.startsWith(href + "/"));

  const renderItem = (item: NavItem, isMobile = false) => {
    const active = isActiveRoute(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => {
          if (isMobile) setMobileOpen(false);
        }}
        className="relative block group"
        aria-current={active ? "page" : undefined}
      >
        {active && (
          <motion.div
            layoutId={isMobile ? "sidebarActiveMobile" : "sidebarActive"}
            className="absolute inset-0 rounded-md bg-neutral-200/60"
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
          />
        )}
        <div
          className={`relative z-10 flex h-8 items-center justify-between rounded-md px-2.5 text-[13px] transition-colors ${
            active
              ? "text-neutral-900 font-medium"
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          }`}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <Icon
              className={`h-4 w-4 shrink-0 ${active ? "text-neutral-900" : "text-neutral-400 group-hover:text-neutral-600"}`}
              strokeWidth={1.75}
            />
            <span className="truncate">{item.name}</span>
          </span>
          {item.tag && <span className="text-[11px] font-medium text-neutral-400">{item.tag}</span>}
        </div>
      </Link>
    );
  };

  const planName = planLimit?.plan_name || (isAdmin ? "Enterprise" : "Pro");
  const siteCount = planLimit?.current_count ?? websites.length;
  const maxSites = planLimit?.max_websites ?? (isAdmin ? 999 : 5);
  const isUnlimited = isAdmin || maxSites >= 999;
  const percent = isUnlimited ? 0 : Math.min(100, Math.round((siteCount / Math.max(1, maxSites)) * 100));

  const renderNavContent = (isMobile = false) => (
    <>
      {/* Website switcher */}
      <div className="px-3 py-3">
        <WebsiteSwitcher />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Primary">
        {groups.map((group, i) => (
          <div key={group.label ?? `g-${i}`} className={i === 0 ? "" : "mt-5"}>
            {group.label && (
              <div className="mb-1 px-2.5 text-xs font-medium text-neutral-400">{group.label}</div>
            )}
            <div className="space-y-0.5">{group.items.map((item) => renderItem(item, isMobile))}</div>
          </div>
        ))}

        <div className="mt-5 border-t border-neutral-200 pt-4 space-y-0.5">
          {workspace.map((item) => renderItem(item, isMobile))}
        </div>
      </nav>

      {/* Plan footer */}
      <div className="border-t border-neutral-200 px-4 py-3 bg-neutral-50/50">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-neutral-800">{planName}</span>
          <Link
            href="/pricing"
            onClick={() => {
              if (isMobile) setMobileOpen(false);
            }}
            className="text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            {isAdmin ? "Plans" : planLimit?.upgrade_required ? "Upgrade" : "Manage"}
          </Link>
        </div>
        <div className="mt-2 flex items-center gap-2">
          {!isUnlimited && (
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full bg-neutral-800 transition-[width] duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
          <span className="text-xs tabular-nums text-neutral-500">
            {isUnlimited ? `${siteCount} sites` : `${siteCount} / ${maxSites} sites`}
          </span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ── MOBILE TOP NAVIGATION BAR (Visible strictly on screens < md) ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-neutral-200 bg-white/95 px-4 backdrop-blur-md">
        <BrandLogo size="sm" href="/" />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* ── MOBILE SLIDE-OVER DRAWER WITH BACKDROP ── */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs"
              aria-hidden="true"
            />

            {/* Slide-out drawer panel */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="fixed inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl select-none"
            >
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-neutral-100">
                <BrandLogo size="sm" href="/" />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation menu"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {renderNavContent(true)}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── DESKTOP PERSISTENT SIDEBAR (Hidden on mobile, flex on desktop) ── */}
      <aside className="hidden md:flex sticky top-0 z-20 h-screen w-60 shrink-0 select-none flex-col self-start border-r border-neutral-200 bg-neutral-50/70">
        <div className="px-4 pt-4 pb-1">
          <BrandLogo size="md" href="/" />
        </div>
        {renderNavContent(false)}
      </aside>
    </>
  );
}
