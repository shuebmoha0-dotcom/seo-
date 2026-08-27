/**
 * Secure Structured Worker Logger
 * Automatically masks and sanitizes any sensitive credentials or tokens.
 */

const SENSITIVE_PATTERNS = [
  /(?:Bearer\s+)[a-zA-Z0-9_\-\.]{15,}/gi,
  /(?:sk-[a-zA-Z0-9_\-]{20,})/gi,
  /(?:ghp_[a-zA-Z0-9]{20,})/gi,
  /(?:vcp_[a-zA-Z0-9]{20,})/gi,
  /(?:AIza[0-9A-Za-z\-_]{35})/gi,
  /(?:password["']?\s*[:=]\s*["']?)([^"'\s,]+)/gi,
  /(?:token["']?\s*[:=]\s*["']?)([^"'\s,]+)/gi,
  /(?:secret["']?\s*[:=]\s*["']?)([^"'\s,]+)/gi,
  /(?:api[_-]?key["']?\s*[:=]\s*["']?)([^"'\s,]+)/gi,
];

function sanitizeMessage(msg: any): string {
  let str = typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2);
  for (const pattern of SENSITIVE_PATTERNS) {
    str = str.replace(pattern, (match) => {
      if (match.length > 8) {
        return `${match.slice(0, 4)}***${match.slice(-4)}`;
      }
      return '***REDACTED***';
    });
  }
  return str;
}

export const WorkerLogger = {
  info(message: string, context?: Record<string, any>) {
    const timestamp = new Date().toISOString();
    const ctx = context ? ` ${sanitizeMessage(context)}` : '';
    console.log(`[worker] [INFO] [${timestamp}] ${sanitizeMessage(message)}${ctx}`);
  },

  warn(message: string, context?: Record<string, any>) {
    const timestamp = new Date().toISOString();
    const ctx = context ? ` ${sanitizeMessage(context)}` : '';
    console.warn(`[worker] [WARN] [${timestamp}] ${sanitizeMessage(message)}${ctx}`);
  },

  error(message: string, error?: any, context?: Record<string, any>) {
    const timestamp = new Date().toISOString();
    const errStr = error ? ` | Error: ${sanitizeMessage(error.message || error)}` : '';
    const ctx = context ? ` | Context: ${sanitizeMessage(context)}` : '';
    console.error(`[worker] [ERROR] [${timestamp}] ${sanitizeMessage(message)}${errStr}${ctx}`);
  },

  debug(message: string, context?: Record<string, any>) {
    if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      const ctx = context ? ` ${sanitizeMessage(context)}` : '';
      console.log(`[worker] [DEBUG] [${timestamp}] ${sanitizeMessage(message)}${ctx}`);
    }
  },
};
