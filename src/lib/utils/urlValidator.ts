/**
 * URL Validation and SSRF Protection Utility
 * Ensures incoming WordPress site URLs are valid, properly formatted,
 * and do not point to internal, private, or loopback network addresses.
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254', // AWS/GCP metadata endpoint
  'metadata.google.internal',
]);

const PRIVATE_IP_RANGES = [
  /^10\./,                          // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0/12
  /^192\.168\./,                    // 192.168.0.0/16
  /^127\./,                         // 127.0.0.0/8
  /^169\.254\./,                    // 169.254.0.0/16 (link-local)
  /^fc00:/i,                        // IPv6 unique local
  /^fe80:/i,                        // IPv6 link-local
];

export interface URLValidationResult {
  isValid: boolean;
  normalizedUrl?: string;
  error?: string;
}

export function validateAndNormalizeWordPressUrl(inputUrl: string): URLValidationResult {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return { isValid: false, error: 'Website URL is required.' };
  }

  let raw = inputUrl.trim();

  // Add https protocol if omitted
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    raw = 'https://' + raw;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { isValid: false, error: 'Invalid URL format. Please provide a valid website address.' };
  }

  // Protocol check — enforce https in production, allow http only if local/explicit
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { isValid: false, error: 'Only HTTP and HTTPS protocols are supported.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // SSRF Protection: Check against blocked hostnames
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return {
      isValid: false,
      error: 'Cannot connect to local or internal network addresses. Please provide a public WordPress site URL.',
    };
  }

  // SSRF Protection: Check private IP ranges
  for (const regex of PRIVATE_IP_RANGES) {
    if (regex.test(hostname)) {
      return {
        isValid: false,
        error: 'Private IP addresses are not permitted. Please connect a public website.',
      };
    }
  }

  // Normalize: Lowercase hostname, strip trailing slash and path extras unless specified
  const normalizedUrl = `${parsed.protocol}//${hostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '')}`;

  return {
    isValid: true,
    normalizedUrl,
  };
}
