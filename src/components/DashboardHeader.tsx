"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Plus, LogOut, Settings } from "lucide-react";
import { useWebsite } from "@/lib/context/WebsiteContext";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/auth/actions";
import Link from "next/link";

export function DashboardHeader() {
  const { currentWebsite, openAddModal } = useWebsite();
  const [userProfile, setUserProfile] = useState<{ name: string; email: string; initials: string }>({
    name: "there",
    email: "",
    initials: "U",
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          const rawName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "there";
          const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
          const email = user.email || "";
          const initials = (formattedName.slice(0, 2) || email.slice(0, 2) || "U").toUpperCase();

          setUserProfile({
            name: formattedName,
            email,
            initials,
          });
        }
      });
    } catch {
      // Fallback
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Telegram Bot Self-Healing Watchdog Heartbeat
  useEffect(() => {
    const pingWatchdog = () => {
      fetch('/api/telegram/health').catch(() => {});
    };
    // Ping on load
    pingWatchdog();
    // Ping every 3 minutes while dashboard is open
    const interval = setInterval(pingWatchdog, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Format date range (last 30 days up to today)
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const dateRangeStr = `${thirtyDaysAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-7 font-semibold text-neutral-900">
          {userProfile.name && userProfile.name !== "there" ? `Welcome back, ${userProfile.name}` : "Overview"}
        </h1>
        <p className="text-neutral-500 text-sm mt-1">
          {currentWebsite
            ? `Showing ${currentWebsite.domain} · ${dateRangeStr}`
            : "Connect a website to start tracking and improving its search performance."}
        </p>
      </div>

      <div className="flex items-center gap-2 self-start md:self-auto">
        {!currentWebsite && (
          <button
            onClick={openAddModal}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect website</span>
          </button>
        )}

        {/* User menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-haspopup="menu"
            aria-expanded={isDropdownOpen}
            className="flex h-8 items-center gap-2 rounded-lg border border-neutral-200 bg-white pl-1 pr-2 shadow-xs transition-colors hover:bg-neutral-50"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-900 text-[11px] font-semibold text-white">
              {userProfile.initials}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {isDropdownOpen && (
            <div role="menu" className="absolute right-0 mt-2 w-60 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 p-1">
              <div className="px-3 py-2 border-b border-neutral-100 mb-1">
                <span className="text-sm font-medium text-neutral-900 block truncate">{userProfile.name}</span>
                <span className="text-xs text-neutral-500 block truncate">{userProfile.email}</span>
              </div>

              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setIsDropdownOpen(false)}
                className="w-full flex items-center gap-2 px-3 h-8 text-[13px] text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-neutral-500" />
                <span>Settings</span>
              </Link>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsDropdownOpen(false);
                  signOut();
                }}
                className="w-full flex items-center gap-2 px-3 h-8 text-[13px] text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors text-left"
              >
                <LogOut className="w-3.5 h-3.5 text-neutral-500" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
