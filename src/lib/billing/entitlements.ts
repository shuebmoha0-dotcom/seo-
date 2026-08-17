/**
 * Centralized Plan Entitlements & Quotas
 * 
 * Controls allowed limits across plans.
 * In Testing / Development Mode: All limits are relaxed and users have unlimited website access.
 */

import { createClient } from '@/lib/supabase/server';

export interface PlanEntitlements {
  plan_id: 'free' | 'starter' | 'pro' | 'enterprise' | 'testing';
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
  testing: {
    plan_id: 'testing',
    display_name: 'Testing Mode (Unlimited)',
    max_websites: 9999,
    max_crawl_pages: 50000,
    max_recurring_tasks: 1000,
    can_use_github_execution: true,
    can_use_wordpress_execution: true,
    can_use_custom_api: true,
    can_use_scheduled_autopilot: true,
  },
  free: {
    plan_id: 'free',
    display_name: 'Free Trial',
    max_websites: 1,
    max_crawl_pages: 50,
    max_recurring_tasks: 2,
    can_use_github_execution: true,
    can_use_wordpress_execution: true,
    can_use_custom_api: true,
    can_use_scheduled_autopilot: true,
  },
  starter: {
    plan_id: 'starter',
    display_name: 'Starter Plan',
    max_websites: 5,
    max_crawl_pages: 500,
    max_recurring_tasks: 10,
    can_use_github_execution: true,
    can_use_wordpress_execution: true,
    can_use_custom_api: true,
    can_use_scheduled_autopilot: true,
  },
  pro: {
    plan_id: 'pro',
    display_name: 'Pro Plan',
    max_websites: 20,
    max_crawl_pages: 5000,
    max_recurring_tasks: 50,
    can_use_github_execution: true,
    can_use_wordpress_execution: true,
    can_use_custom_api: true,
    can_use_scheduled_autopilot: true,
  },
  enterprise: {
    plan_id: 'enterprise',
    display_name: 'Enterprise Plan',
    max_websites: 9999,
    max_crawl_pages: 50000,
    max_recurring_tasks: 1000,
    can_use_github_execution: true,
    can_use_wordpress_execution: true,
    can_use_custom_api: true,
    can_use_scheduled_autopilot: true,
  },
};

/**
 * Check if the user has reached their allowed website quota.
 * Currently in Testing Mode: Always returns allowed = true with unlimited slots.
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

  // Count existing websites for user
  const { count } = await supabase
    .from('websites')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const currentCount = count || 0;

  // In Testing Mode: unlimited websites allowed
  return {
    allowed: true,
    current_count: currentCount,
    max_websites: 9999,
    plan_name: 'Testing Mode',
    upgrade_required: false,
  };
}
