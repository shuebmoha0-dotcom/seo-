/**
 * Platform Administration Verification Helper
 * STRICT ENFORCEMENT: Only shuebmoha0@gmail.com is granted platform admin privileges.
 * All other users, tenants, and roles are strictly denied.
 */

export const PLATFORM_ADMIN_EMAIL = "shuebmoha0@gmail.com";

export function isPlatformAdmin(email?: string | null, _role?: string | null): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return normalized === PLATFORM_ADMIN_EMAIL;
}
