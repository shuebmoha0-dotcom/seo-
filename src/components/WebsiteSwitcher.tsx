"use client";

import React, { useState, useRef, useEffect } from "react";
import { useWebsite, WebsiteData } from "@/lib/context/WebsiteContext";
import { Globe, ChevronDown, Plus, Check, ExternalLink, Settings, ShieldCheck } from "lucide-react";
import { WebsiteFavicon } from "@/components/WebsiteFavicon";

export function WebsiteSwitcher() {
  const { websites, currentWebsite, setCurrentWebsite, openAddModal, loading, planLimit } = useWebsite();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [cachedSite, setCachedSite] = useState<WebsiteData | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("seo_cached_current_website");
        if (raw) return JSON.parse(raw);
        const rawList = localStorage.getItem("seo_cached_websites");
        if (rawList) {
          const list: WebsiteData[] = JSON.parse(rawList);
          if (Array.isArray(list) && list.length > 0) return list[0];
        }
      } catch {}
    }
    return null;
  });

  useEffect(() => {
    if (currentWebsite) {
      setCachedSite(currentWebsite);
    } else {
      try {
        const raw = localStorage.getItem("seo_cached_current_website");
        if (raw) setCachedSite(JSON.parse(raw));
      } catch {}
    }
  }, [currentWebsite]);

  const activeSite = currentWebsite || cachedSite;

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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading && !activeSite}
        className="w-full flex items-center justify-between gap-2 h-10 px-2.5 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg shadow-xs transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {activeSite ? (
            <>
              <WebsiteFavicon domain={activeSite.domain} className="w-5 h-5 shrink-0 rounded" size={64} />
              <span className="text-[13px] font-medium text-neutral-900 truncate">
                {activeSite.domain}
              </span>
            </>
          ) : loading ? (
            <div className="flex items-center gap-2.5 w-full animate-pulse">
              <div className="w-5 h-5 rounded bg-neutral-200 shrink-0" />
              <div className="h-3.5 bg-neutral-200 rounded w-28" />
            </div>
          ) : (
            <>
              <div className="w-5 h-5 rounded bg-neutral-100 flex items-center justify-center text-neutral-400 shrink-0 text-xs">
                🌐
              </div>
              <span className="text-[13px] font-medium text-neutral-500 truncate">
                Connect a website
              </span>
            </>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform shrink-0 ml-1 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-72 bg-white border border-neutral-200 rounded-2xl shadow-xl z-50 p-2 space-y-1">
          <div className="px-2.5 py-1.5 border-b border-neutral-100 flex items-center justify-between text-[10px] text-neutral-400">
            <span className="font-semibold uppercase tracking-wider">Your Websites ({websites.length})</span>
            <span className="font-medium text-indigo-600">Testing Mode</span>
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
                  <div className="flex items-center gap-2.5 min-w-0">
                    <WebsiteFavicon domain={site.domain} className="w-5 h-5 shrink-0" size={48} />
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
