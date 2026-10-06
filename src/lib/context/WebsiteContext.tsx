"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface WebsiteData {
  id: string;
  user_id: string;
  project_id?: string;
  domain: string;
  url: string;
  name?: string;
  platform?: string;
  status: string;
  created_at: string;
  integrations: Array<{
    id: string;
    provider: string;
    display_name: string;
    status: string;
    capabilities: string[];
    config: Record<string, any>;
  }>;
}

export interface PlanLimitInfo {
  allowed: boolean;
  current_count: number;
  max_websites: number;
  plan_name: string;
  upgrade_required: boolean;
  message?: string;
}

interface WebsiteContextType {
  websites: WebsiteData[];
  currentWebsite: WebsiteData | null;
  setCurrentWebsite: (site: WebsiteData) => void;
  loading: boolean;
  planLimit: PlanLimitInfo | null;
  refreshWebsites: () => Promise<void>;
  openAddModal: () => void;
  closeAddModal: () => void;
  isAddModalOpen: boolean;
}

const WebsiteContext = createContext<WebsiteContextType | undefined>(undefined);

export function WebsiteProvider({ children }: { children: React.ReactNode }) {
  const [websites, setWebsites] = useState<WebsiteData[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("seo_cached_websites");
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });

  const [currentWebsite, setCurrentWebsiteState] = useState<WebsiteData | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cachedCurrent = localStorage.getItem("seo_cached_current_website");
        if (cachedCurrent) return JSON.parse(cachedCurrent);

        const storedId = localStorage.getItem("seo_active_website_id");
        const cachedWebsites = localStorage.getItem("seo_cached_websites");
        if (cachedWebsites) {
          const list: WebsiteData[] = JSON.parse(cachedWebsites);
          if (Array.isArray(list) && list.length > 0) {
            const matched = list.find(s => s.id === storedId);
            return matched || list[0];
          }
        }
      } catch {}
    }
    return null;
  });

  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const cachedCurrent = localStorage.getItem("seo_cached_current_website");
        const cachedWebsites = localStorage.getItem("seo_cached_websites");
        if (cachedCurrent || cachedWebsites) return false;
      } catch {}
    }
    return true;
  });

  const [planLimit, setPlanLimit] = useState<PlanLimitInfo | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("seo_cached_plan_limit");
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return null;
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const refreshWebsites = async () => {
    try {
      // Only set loading if there is zero cached data (cold start)
      const hasCached = typeof window !== "undefined" && (localStorage.getItem("seo_cached_current_website") || localStorage.getItem("seo_cached_websites"));
      if (!currentWebsite && websites.length === 0 && !hasCached) {
        setLoading(true);
      }
      const res = await fetch(`/api/websites?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
      if (res.ok) {
        const data = await res.json();
        const siteList: WebsiteData[] = data.websites || [];
        setWebsites(siteList);
        setPlanLimit(data.plan_limit || null);

        if (typeof window !== "undefined") {
          localStorage.setItem("seo_cached_websites", JSON.stringify(siteList));
          if (data.plan_limit) {
            localStorage.setItem("seo_cached_plan_limit", JSON.stringify(data.plan_limit));
          }
        }

        // Retrieve stored active website ID from localStorage
        const storedId = typeof window !== "undefined" ? localStorage.getItem("seo_active_website_id") : null;
        const matched = siteList.find(s => s.id === storedId);

        let activeSite: WebsiteData | null = null;
        if (matched) {
          activeSite = matched;
        } else if (siteList.length > 0) {
          const preferredSite = siteList.find(s => s.integrations && s.integrations.some(i => i.status === 'connected')) || siteList[0];
          activeSite = preferredSite;
        }

        setCurrentWebsiteState(activeSite);
        if (typeof window !== "undefined") {
          if (activeSite) {
            localStorage.setItem("seo_active_website_id", activeSite.id);
            localStorage.setItem("seo_cached_current_website", JSON.stringify(activeSite));
          } else {
            localStorage.removeItem("seo_active_website_id");
            localStorage.removeItem("seo_cached_current_website");
          }
        }
      }
    } catch (err) {
      console.error("[WebsiteProvider] Error loading websites:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Synchronously hydrate from localStorage on client mount (0ms display on refresh)
    try {
      const cachedWebsites = localStorage.getItem("seo_cached_websites");
      const cachedCurrent = localStorage.getItem("seo_cached_current_website");
      const storedId = localStorage.getItem("seo_active_website_id");
      const cachedLimit = localStorage.getItem("seo_cached_plan_limit");

      let siteList: WebsiteData[] = [];
      if (cachedWebsites) {
        siteList = JSON.parse(cachedWebsites);
        if (Array.isArray(siteList) && siteList.length > 0) {
          setWebsites(siteList);
        }
      }

      let activeSite: WebsiteData | null = null;
      if (cachedCurrent) {
        activeSite = JSON.parse(cachedCurrent);
      } else if (siteList.length > 0) {
        activeSite = siteList.find(s => s.id === storedId) || siteList[0];
      }

      if (activeSite) {
        setCurrentWebsiteState(activeSite);
        setLoading(false);
      } else if (siteList.length > 0) {
        setCurrentWebsiteState(siteList[0]);
        setLoading(false);
      }

      if (cachedLimit) {
        setPlanLimit(JSON.parse(cachedLimit));
      }
    } catch (e) {
      console.warn("[WebsiteProvider] Error hydrating cached website:", e);
    }

    // 2. Fetch fresh data in the background (stale-while-revalidate)
    refreshWebsites();

    // Listen to Supabase auth state changes to isolate user sessions
    try {
      const { createClient } = require("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
        if (event === "SIGNED_OUT") {
          setWebsites([]);
          setCurrentWebsiteState(null);
          setPlanLimit(null);
          if (typeof window !== "undefined") {
            localStorage.removeItem("seo_active_website_id");
            localStorage.removeItem("seo_cached_websites");
            localStorage.removeItem("seo_cached_current_website");
            localStorage.removeItem("seo_cached_plan_limit");
          }
        } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
          refreshWebsites();
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } catch {
      // Fallback
    }
  }, []);

  const setCurrentWebsite = (site: WebsiteData) => {
    setCurrentWebsiteState(site);
    if (typeof window !== "undefined") {
      localStorage.setItem("seo_active_website_id", site.id);
      localStorage.setItem("seo_cached_current_website", JSON.stringify(site));
    }
  };

  const openAddModal = () => setIsAddModalOpen(true);
  const closeAddModal = () => setIsAddModalOpen(false);

  return (
    <WebsiteContext.Provider
      value={{
        websites,
        currentWebsite,
        setCurrentWebsite,
        loading,
        planLimit,
        refreshWebsites,
        openAddModal,
        closeAddModal,
        isAddModalOpen,
      }}
    >
      {children}
    </WebsiteContext.Provider>
  );
}

export function useWebsite() {
  const context = useContext(WebsiteContext);
  if (!context) {
    throw new Error("useWebsite must be used within a WebsiteProvider");
  }
  return context;
}
