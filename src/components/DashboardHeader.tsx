"use client";

import { Calendar, Bell, ChevronDown, Globe, Plus } from "lucide-react";
import { useWebsite } from "@/lib/context/WebsiteContext";

export function DashboardHeader() {
  const { currentWebsite, openAddModal } = useWebsite();

  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
          Welcome back, Alex 👋
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
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-600" />
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
        <button className="p-2 bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-500 hover:text-neutral-800 rounded-xl relative transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full" />
        </button>

        {/* Date Selector */}
        <button className="flex items-center gap-2 bg-white border border-neutral-200 text-neutral-600 px-3.5 py-2 rounded-xl text-xs font-medium hover:bg-neutral-50 transition-colors">
          <span>May 12 – Jun 12, 2025</span>
          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-2.5 bg-white border border-neutral-200 pl-2 pr-3 py-1.5 rounded-xl cursor-pointer hover:bg-neutral-50 transition-colors">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xs">
            AJ
          </div>
          <div className="text-left hidden sm:block">
            <span className="text-xs font-semibold text-neutral-900 block leading-tight">Alex Johnson</span>
            <span className="text-[10px] text-neutral-500 block leading-tight">Pro Plan</span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
        </div>
      </div>
    </header>
  );
}
