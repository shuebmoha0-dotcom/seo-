/**
 * Platform Administration Verification Helper
 * Ensures sensitive SaaS administration tools (like the Platform Blog Manager)
 * are only accessible to verified platform owners/admins, and completely hidden
 * from regular tenants and clients.
 */

const DEFAULT_ADMIN_EMAILS = [
  "shuebmoha0@gmail.com",
  "shucebmohamed00@gmail.com",
];

export function isPlatformAdmin(email?: string | null, role?: string | null): boolean {
  if (!email) return false;

  // 1. Role-based check
  if (role === "admin" || role === "superadmin") return true;

  // 2. Environment override
  const configuredAdmins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  // 3. Platform Owner whitelist
  const adminSet = new Set([...DEFAULT_ADMIN_EMAILS, ...configuredAdmins]);
  return adminSet.has(email.toLowerCase().trim());
}
