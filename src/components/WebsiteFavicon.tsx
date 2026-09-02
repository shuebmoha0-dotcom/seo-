"use client";

import React, { useState } from "react";

export interface WebsiteFaviconProps {
  domain?: string;
  className?: string;
  size?: number;
  fallbackText?: string;
}

export function WebsiteFavicon({
  domain,
  className = "w-6 h-6",
  size = 64,
  fallbackText,
}: WebsiteFaviconProps) {
  const [errorLevel, setErrorLevel] = useState(0);

  const cleanDomain = (domain || "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .trim();

  if (!cleanDomain) {
    return (
      <div className={`rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs uppercase shrink-0 ${className}`}>
        🌐
      </div>
    );
  }

  // Level 0: Google High-Res Favicon CDN
  if (errorLevel === 0) {
    return (
      <div className={`rounded-lg bg-white border border-neutral-200/90 shadow-2xs flex items-center justify-center p-1 overflow-hidden shrink-0 ${className}`}>
        <img
          src={`https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=${size}`}
          alt={`${cleanDomain} logo`}
          className="w-full h-full object-contain rounded-xs"
          onError={() => setErrorLevel(1)}
        />
      </div>
    );
  }

  // Level 1: DuckDuckGo Favicon CDN
  if (errorLevel === 1) {
    return (
      <div className={`rounded-lg bg-white border border-neutral-200/90 shadow-2xs flex items-center justify-center p-1 overflow-hidden shrink-0 ${className}`}>
        <img
          src={`https://icons.duckduckgo.com/ip3/${cleanDomain}.ico`}
          alt={`${cleanDomain} logo`}
          className="w-full h-full object-contain rounded-xs"
          onError={() => setErrorLevel(2)}
        />
      </div>
    );
  }

  // Level 2: Direct /favicon.ico on domain
  if (errorLevel === 2) {
    return (
      <div className={`rounded-lg bg-white border border-neutral-200/90 shadow-2xs flex items-center justify-center p-1 overflow-hidden shrink-0 ${className}`}>
        <img
          src={`https://${cleanDomain}/favicon.ico`}
          alt={`${cleanDomain} logo`}
          className="w-full h-full object-contain rounded-xs"
          onError={() => setErrorLevel(3)}
        />
      </div>
    );
  }

  // Level 3: Elegant fallback letter badge
  const initial = (fallbackText || cleanDomain).charAt(0).toUpperCase();
  return (
    <div className={`rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-black flex items-center justify-center text-xs shadow-2xs shrink-0 ${className}`}>
      {initial}
    </div>
  );
}
