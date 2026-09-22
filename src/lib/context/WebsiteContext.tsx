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
  const [websites, setWebsites] = useState<WebsiteData[]>([]);
  const [currentWebsite, setCurrentWebsiteState] = useState<WebsiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [planLimit, setPlanLimit] = useState<PlanLimitInfo | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const refreshWebsites = async () => {
    try {
      setLoading(true);
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

        // Retrieve stored active website ID from localStorage
        const storedId = typeof window !== "undefined" ? localStorage.getItem("seo_active_website_id") : null;
        const matched = siteList.find(s => s.id === storedId);

        if (matched) {
          setCurrentWebsiteState(matched);
        } else if (siteList.length > 0) {
          const preferredSite = siteList.find(s => s.integrations && s.integrations.some(i => i.status === 'connected')) || siteList[0];
          setCurrentWebsiteState(preferredSite);
          if (typeof window !== "undefined") {
            localStorage.setItem("seo_active_website_id", preferredSite.id);
          }
        } else {
          setCurrentWebsiteState(null);
          if (typeof window !== "undefined") {
            localStorage.removeItem("seo_active_website_id");
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
