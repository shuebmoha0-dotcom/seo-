import React from 'react';

export interface PlatformLogoProps {
  provider: string;
  className?: string;
  size?: number;
}

export function PlatformLogo({ provider, className = 'w-7 h-7', size = 28 }: PlatformLogoProps) {
  const norm = (provider || '').toLowerCase().replace(/[\s-_]/g, '');

  // 1. Google Search Console (Official GSC Logo)
  if (norm.includes('searchconsole') || norm.includes('gsc')) {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107" />
        <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00" />
        <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50" />
        <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2" />
        <circle cx="34" cy="34" r="9" fill="#0288D1" />
        <path d="M37.5 37.5L42 42" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="33" cy="33" r="4.5" stroke="#FFFFFF" strokeWidth="2" />
      </svg>
    );
  }

  // 2. Google Analytics 4 (Official GA4 Logo)
  if (norm.includes('analytics') || norm.includes('ga4')) {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21.5 19.5c0 1.38-1.12 2.5-2.5 2.5s-2.5-1.12-2.5-2.5 1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5z" fill="#F4511E" />
        <path d="M12 22c-1.38 0-2.5-1.12-2.5-2.5V11c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v8.5c0 1.38-1.12 2.5-2.5 2.5z" fill="#FBBC04" />
        <path d="M4.5 22C3.12 22 2 20.88 2 19.5V16c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v3.5C7 20.88 5.88 22 4.5 22z" fill="#FBBC04" />
        <path d="M19 14.5c-1.38 0-2.5-1.12-2.5-2.5V4.5C16.5 3.12 17.62 2 19 2s2.5 1.12 2.5 2.5V12c0 1.38-1.12 2.5-2.5 2.5z" fill="#F4511E" />
      </svg>
    );
  }

  // 3. GitHub (Official GitHub Invertocat Mark)
  if (norm.includes('github')) {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
      </svg>
    );
  }

  // 4. WordPress (Official WordPress Circular "W" Logo)
  if (norm.includes('wordpress') || norm.includes('wp')) {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 122.5 122.5" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M61.25 0C27.42 0 0 27.42 0 61.25s27.42 61.25 61.25 61.25 61.25-27.42 61.25-61.25S95.08 0 61.25 0z" fill="#21759B" />
        <path d="M9.82 61.25c0 20.35 12.14 37.86 29.56 45.74L16.27 43.15C12.16 48.51 9.82 54.63 9.82 61.25zm77.34-3.13c0-5.75-2.06-9.74-3.83-12.83-2.36-3.83-4.57-7.08-4.57-10.91 0-4.28 3.24-8.26 7.82-8.26.36 0 .7.04 1.05.08C77.49 19.34 69.83 15.68 61.25 15.68c-14.77 0-27.87 7.55-35.6 19.04 1.03.03 2 .05 2.82.05 4.57 0 11.65-.59 11.65-.59 2.36-.15 2.65 3.24.3 3.54 0 0-2.39.29-5.04.44l16.03 47.68 9.63-28.89-6.86-18.79c-2.36-.15-4.6-.44-4.6-.44-2.36-.15-2.06-3.69.3-3.54 0 0 7.23.59 11.5.59 4.57 0 11.65-.59 11.65-.59 2.36-.15 2.65 3.24.3 3.54 0 0-2.39.29-5.04.44l15.84 47.1 4.36-14.59c2.53-8.23 4.45-14.15 4.45-19.32zM62.38 69.4l-13.14 38.2c3.84 1.13 7.89 1.76 12.01 1.76 4.97 0 9.77-.9 14.21-2.52L62.38 69.4zm39.73-31.81c.54 2.45.84 5.17.84 8.21 0 8.11-1.52 17.23-6.09 28.71l13.62 39.41c7.43-9.06 11.92-20.67 11.92-33.27 0-16.14-7.7-30.49-19.64-39.73l-.65-3.33z" fill="#FFFFFF" />
      </svg>
    );
  }

  // 5. Custom Website API / Webhook (REST API Vector)
  return (
    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xs">
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
        <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="2 2" />
      </svg>
    </div>
  );
}
