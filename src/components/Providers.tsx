"use client";

import React from "react";
import { WebsiteProvider } from "@/lib/context/WebsiteContext";
import { AddWebsiteModal } from "@/components/AddWebsiteModal";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WebsiteProvider>
      {children}
      <AddWebsiteModal />
    </WebsiteProvider>
  );
}
