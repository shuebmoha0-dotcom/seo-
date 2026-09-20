"use client";

import { useState, useEffect, useRef } from "react";
import { Calendar, Bell, ChevronDown, Globe, Plus, LogOut, Settings, User } from "lucide-react";
import { useWebsite } from "@/lib/context/WebsiteContext";
import { WebsiteFavicon } from "@/components/WebsiteFavicon";
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

  // Format date range (last 30 days up to today)
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const dateRangeStr = `${thirtyDaysAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
          Welcome back, {userProfile.name} 👋
        </h1>
        <p className="text-neutral-500 text-sm mt-0.5">
          {currentWebsite
            ? `SEO Autopilot is optimizing ${currentWebsite.domain} (${currentWebsite.platform || "Active"}).`
            : "Connect your website to start autonomous SEO growth."}
        </p>
      </div>

      <div className="flex items-center gap-3 self-start md:self-auto">
        {/* Active Website Pill */}
        {currentWebsite ? (
          <div className="bg-white border border-neutral-200/90 text-neutral-800 text-xs pl-1.5 pr-3 py-1 rounded-full font-semibold flex items-center gap-2 shadow-2xs">
            <WebsiteFavicon domain={currentWebsite.domain} className="w-5 h-5 rounded-full" size={32} />
            <span>{currentWebsite.domain}</span>
          </div>
        ) : (
          <button
            onClick={openAddModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect Website</span>
          </button>
        )}

        {/* Agent Active Pill */}
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Agent Active</span>
        </div>

        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications"
          className="p-2 bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-500 hover:text-neutral-800 rounded-xl relative transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full" />
        </button>

        {/* Date Selector */}
        <div className="hidden lg:flex items-center gap-2 bg-white border border-neutral-200 text-neutral-600 px-3.5 py-2 rounded-xl text-xs font-medium">
          <span>{dateRangeStr}</span>
          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
        </div>

        {/* User Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2.5 bg-white border border-neutral-200 pl-2 pr-3 py-1.5 rounded-xl hover:bg-neutral-50 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow-xs">
              {userProfile.initials}
            </div>
            <div className="text-left hidden sm:block">
              <span className="text-xs font-semibold text-neutral-900 block leading-tight max-w-[120px] truncate">
                {userProfile.name}
              </span>
              <span className="text-[10px] text-neutral-400 block leading-tight max-w-[120px] truncate">
                {userProfile.email || "Active Account"}
              </span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-neutral-200 rounded-2xl shadow-xl z-50 p-1.5 space-y-1">
              <div className="px-3 py-2 border-b border-neutral-100">
                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block">Signed in as</span>
                <span className="text-xs font-bold text-neutral-900 block truncate">{userProfile.email || userProfile.name}</span>
              </div>

              <Link
                href="/settings"
                onClick={() => setIsDropdownOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50 rounded-xl transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-neutral-500" />
                <span>Account Settings</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(false);
                  signOut();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left"
              >
                <LogOut className="w-3.5 h-3.5 text-red-500" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
