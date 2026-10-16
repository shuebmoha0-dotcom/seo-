/**
 * Paddle Billing v2 Configuration and Helpers
 * 
 * Supports both Paddle Sandbox (development/testing) and Production.
 * Uses Paddle.js for seamless overlay checkout (Apple Pay, Google Pay, Credit Card, PayPal).
 */

export interface PaddlePlan {
  id: 'starter' | 'growth' | 'agency';
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  monthlyPriceId: string;
  annualPriceId: string;
  maxWebsites: number;
  features: string[];
}

export const PADDLE_PLANS: Record<string, PaddlePlan> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 29,
    annualPrice: 24,
    monthlyPriceId: process.env.NEXT_PUBLIC_PADDLE_STARTER_MONTHLY_PRICE_ID || 'pri_starter_monthly_sample',
    annualPriceId: process.env.NEXT_PUBLIC_PADDLE_STARTER_ANNUAL_PRICE_ID || 'pri_starter_annual_sample',
    maxWebsites: 1,
    features: [
      '1 Connected Website',
      'Autonomous AI SEO Agent (24/7 Monitoring)',
      'Keyword Gap Discovery & Content Planner',
      'Claude Sonnet 5 Editorial Drafting',
      'Weekly Technical SEO Audits',
      'Google Search Console Synchronization',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    monthlyPrice: 79,
    annualPrice: 63,
    monthlyPriceId: process.env.NEXT_PUBLIC_PADDLE_GROWTH_MONTHLY_PRICE_ID || 'pri_growth_monthly_sample',
    annualPriceId: process.env.NEXT_PUBLIC_PADDLE_GROWTH_ANNUAL_PRICE_ID || 'pri_growth_annual_sample',
    maxWebsites: 5,
    features: [
      '5 Connected Websites',
      'Everything in Starter',
      'Competitor Reverse-Engineering Engine',
      'Full Autonomous Daily Autopilot Engine',
      'Automated WordPress & GitHub Publishing',
      'Telegram Approval Bot Integration',
      'Backlink Prospecting & Spying Engine',
    ],
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    monthlyPrice: 199,
    annualPrice: 159,
    monthlyPriceId: process.env.NEXT_PUBLIC_PADDLE_AGENCY_MONTHLY_PRICE_ID || 'pri_agency_monthly_sample',
    annualPriceId: process.env.NEXT_PUBLIC_PADDLE_AGENCY_ANNUAL_PRICE_ID || 'pri_agency_annual_sample',
    maxWebsites: 25,
    features: [
      '25 Connected Websites',
      'Everything in Growth',
      'Unlimited Autonomous Article Generation',
      'Multi-Tenant White-Label Client Reports',
      'Priority Indexation & API Sync',
      'Dedicated Account Engineer Support',
    ],
  },
};

export function getPaddleEnvironment(): 'sandbox' | 'production' {
  return (process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox';
}

export function getPaddleClientToken(): string {
  return process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || '';
}
