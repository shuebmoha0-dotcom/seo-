"use client";

import React, { useState, useRef, useEffect } from "react";
import { useWebsite, WebsiteData } from "@/lib/context/WebsiteContext";
import { Globe, ChevronDown, Plus, Check, ExternalLink, Settings, ShieldCheck } from "lucide-react";

export function WebsiteSwitcher() {
  const { websites, currentWebsite, setCurrentWebsite, openAddModal, loading, planLimit } = useWebsite();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getPlatformIcon = (site: WebsiteData) => {
    const mainInt = site.integrations?.find(i => i.status === "connected");
    if (mainInt?.provider === "wordpress" || site.platform === "wordpress") return "🟦";
    if (mainInt?.provider === "github" || site.platform === "nextjs") return "🐙";
    if (mainInt?.provider === "custom_api" || site.platform === "custom_saas") return "⚡";
    return "🌐";
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="w-full flex items-center justify-between p-2.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl transition-all text-left group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-base shrink-0">{currentWebsite ? getPlatformIcon(currentWebsite) : "🌐"}</span>
          <div className="truncate">
            <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider leading-none mb-1">
              Active Website
            </span>
            <span className="text-xs font-bold text-neutral-900 truncate block leading-tight">
              {currentWebsite ? currentWebsite.domain : loading ? "Loading..." : "No Website Connected"}
            </span>
          </div>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform shrink-0 ml-1 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-72 bg-white border border-neutral-200 rounded-2xl shadow-xl z-50 p-2 space-y-1">
          <div className="px-2.5 py-1.5 border-b border-neutral-100 flex items-center justify-between text-[10px] text-neutral-400">
            <span className="font-semibold uppercase tracking-wider">Your Websites ({websites.length}/{planLimit?.max_websites || 5})</span>
            {planLimit && <span className="font-medium text-indigo-600">{planLimit.plan_name}</span>}
          </div>

          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {websites.map(site => {
              const isSelected = currentWebsite?.id === site.id;
              const hasConnectedInt = site.integrations?.some(i => i.status === "connected");

              return (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => {
                    setCurrentWebsite(site);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors ${
                    isSelected ? "bg-indigo-50 text-indigo-900 font-semibold" : "hover:bg-neutral-50 text-neutral-700"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span>{getPlatformIcon(site)}</span>
                    <div className="truncate">
                      <span className="block truncate font-medium">{site.domain}</span>
                      <span className="text-[10px] text-neutral-400 block">
                        {site.name || site.platform || "Active"}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>

          {/* Add Website CTA */}
          <div className="pt-1 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                openAddModal();
              }}
              className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Connect New Website</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
