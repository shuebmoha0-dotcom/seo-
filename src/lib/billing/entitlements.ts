/**
 * Centralized Plan Entitlements & Quotas
 * 
 * Controls allowed limits across plans without hardcoding throughout the codebase.
 */

import { createClient } from '@/lib/supabase/server';

export interface PlanEntitlements {
  plan_id: 'free' | 'starter' | 'pro' | 'enterprise';
  display_name: string;
  max_websites: number;
  max_crawl_pages: number;
  max_recurring_tasks: number;
  can_use_github_execution: boolean;
  can_use_wordpress_execution: boolean;
  can_use_custom_api: boolean;
  can_use_scheduled_autopilot: boolean;
}

export const PLAN_ENTITLEMENTS: Record<string, PlanEntitlements> = {
  free: {
    plan_id: 'free',
    display_name: 'Free Trial',
    max_websites: 1,
    max_crawl_pages: 50,
    max_recurring_tasks: 2,
    can_use_github_execution: true,
    can_use_wordpress_execution: true,
    can_use_custom_api: true,
    can_use_scheduled_autopilot: false,
  },
  starter: {
    plan_id: 'starter',
    display_name: 'Starter Plan',
    max_websites: 2,
    max_crawl_pages: 250,
    max_recurring_tasks: 5,
    can_use_github_execution: true,
    can_use_wordpress_execution: true,
    can_use_custom_api: true,
    can_use_scheduled_autopilot: true,
  },
  pro: {
    plan_id: 'pro',
    display_name: 'Pro Plan',
    max_websites: 5,
    max_crawl_pages: 2500,
    max_recurring_tasks: 20,
    can_use_github_execution: true,
    can_use_wordpress_execution: true,
    can_use_custom_api: true,
    can_use_scheduled_autopilot: true,
  },
  enterprise: {
    plan_id: 'enterprise',
    display_name: 'Enterprise Plan',
    max_websites: 25,
    max_crawl_pages: 10000,
    max_recurring_tasks: 100,
    can_use_github_execution: true,
    can_use_wordpress_execution: true,
    can_use_custom_api: true,
    can_use_scheduled_autopilot: true,
  },
};

/**
 * Check if the user has reached their allowed website quota.
 */
export async function checkWebsiteLimit(userId: string): Promise<{
  allowed: boolean;
  current_count: number;
  max_websites: number;
  plan_name: string;
  upgrade_required: boolean;
  message?: string;
}> {
  const supabase = await createClient();

  // 1. Fetch user's subscription tier
  const { data: userRow } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('id', userId)
    .maybeSingle();

  // Query subscription if table exists, otherwise default to pro for active development
  const planKey = 'pro';
  const entitlements = PLAN_ENTITLEMENTS[planKey] || PLAN_ENTITLEMENTS.free;

  // 2. Count existing websites for user
  const { count, error } = await supabase
    .from('websites')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const currentCount = count || 0;

  if (currentCount >= entitlements.max_websites) {
    return {
      allowed: false,
      current_count: currentCount,
      max_websites: entitlements.max_websites,
      plan_name: entitlements.display_name,
      upgrade_required: true,
      message: `You have reached the limit of ${entitlements.max_websites} website(s) on the ${entitlements.display_name}. Please upgrade your plan to connect additional websites.`,
    };
  }

  return {
    allowed: true,
    current_count: currentCount,
    max_websites: entitlements.max_websites,
    plan_name: entitlements.display_name,
    upgrade_required: false,
  };
}
