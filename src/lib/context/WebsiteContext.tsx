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
      const res = await fetch("/api/websites");
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
          setCurrentWebsiteState(siteList[0]);
          if (typeof window !== "undefined") {
            localStorage.setItem("seo_active_website_id", siteList[0].id);
          }
        } else {
          setCurrentWebsiteState(null);
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
