import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { encryptCredential, decryptCredential } from '@/lib/utils/encryption';

export interface WordPressOutboundSite {
  id: string;
  website_id?: string;
  site_url: string;
  site_name?: string;
  hmac_secret_hash: string;
  scopes: string[];
  status: 'active' | 'revoked' | 'unconfigured';
  wp_version?: string;
  php_version?: string;
  plugin_version?: string;
  seo_plugins?: Record<string, any>;
  last_ping_at?: string;
  last_sync_at?: string;
  last_ip?: string;
  created_at: string;
  updated_at: string;
}

export interface WordPressJob {
  id: string;
  site_id: string;
  website_id?: string;
  job_type: string;
  payload: Record<string, any>;
  status: 'pending' | 'claimed' | 'completed' | 'failed' | 'cancelled';
  idempotency_key?: string;
  claimed_at?: string;
  claimed_by?: string;
  completed_at?: string;
  result?: Record<string, any>;
  error?: Record<string, any>;
  retry_count: number;
  max_retries: number;
  created_at: string;
  updated_at: string;
}

/**
 * Hash secret for safe storage in Supabase
 */
export function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * Compute HMAC signature for request authentication
 * Format: HMAC-SHA256 of `${timestamp}.${nonce}.${body}`
 */
export function computeSignature(secret: string, timestamp: string, nonce: string, body: string): string {
  const payload = `${timestamp}.${nonce}.${body}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify incoming outbound request from WordPress plugin
 */
export async function verifyOutboundRequest(request: Request, bodyText: string): Promise<{
  valid: boolean;
  site?: WordPressOutboundSite;
  error?: string;
}> {
  const siteId = request.headers.get('x-seo-autopilot-site-id');
  const timestamp = request.headers.get('x-seo-autopilot-timestamp');
  const nonce = request.headers.get('x-seo-autopilot-nonce');
  const signature = request.headers.get('x-seo-autopilot-signature');

  if (!siteId || !timestamp || !nonce || !signature) {
    return { valid: false, error: 'Missing required security headers (Site-ID, Timestamp, Nonce, or Signature).' };
  }

  // 1. Check timestamp freshness (5 minute replay window)
  const reqTime = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(reqTime) || Math.abs(now - reqTime) > 300) {
    return { valid: false, error: 'Request expired or clock skew detected (5 minute tolerance).' };
  }

  // 2. Fetch site from database
  const supabase = await createClient();
  const { data: site, error: siteErr } = await supabase
    .from('wordpress_outbound_sites')
    .select('*')
    .eq('id', siteId)
    .single();

  if (siteErr || !site) {
    return { valid: false, error: 'Site not registered or invalid site ID.' };
  }

  if (site.status !== 'active') {
    return { valid: false, error: `Site connection is ${site.status}.` };
  }

  // 3. Fetch encrypted secret from integration_credentials
  let rawSecret: string | null = null;

  // Try finding the integration by website_id or site_id in config
  let intgQuery = supabase
    .from('integrations')
    .select('id, config')
    .eq('provider', 'wordpress');

  if (site.website_id) {
    intgQuery = intgQuery.eq('website_id', site.website_id);
  }

  const { data: intg } = await intgQuery.maybeSingle();

  if (intg?.id) {
    const { data: creds } = await supabase
      .from('integration_credentials')
      .select('encrypted_value')
      .eq('integration_id', intg.id)
      .eq('credential_type', 'outbound_hmac_secret')
      .maybeSingle();

    if (creds?.encrypted_value) {
      try {
        rawSecret = decryptCredential(creds.encrypted_value);
      } catch (decErr) {
        console.warn('[Outbound Verify] Decryption error:', decErr);
      }
    }
  }

  // If not found yet, check all outbound_hmac_secret credentials
  if (!rawSecret) {
    const { data: anyCreds } = await supabase
      .from('integration_credentials')
      .select('encrypted_value')
      .eq('credential_type', 'outbound_hmac_secret')
      .limit(5);

    if (anyCreds) {
      for (const c of anyCreds) {
        try {
          const testSecret = decryptCredential(c.encrypted_value);
          const expectedSig = computeSignature(testSecret, timestamp, nonce, bodyText);
          if (signature.length === expectedSig.length && crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'))) {
            rawSecret = testSecret;
            break;
          }
        } catch {}
      }
    }
  }

  let isValidSig = false;
  if (rawSecret) {
    const expectedSig = computeSignature(rawSecret, timestamp, nonce, bodyText);
    if (signature.length === expectedSig.length) {
      isValidSig = crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'));
    }
  } else if (intg?.config?.secret_key) {
    const expectedSig = computeSignature(intg.config.secret_key, timestamp, nonce, bodyText);
    if (signature.length === expectedSig.length) {
      isValidSig = crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'));
    }
  }

  if (!isValidSig) {
    return { valid: false, error: 'Invalid HMAC signature. Secret mismatch or payload corrupted.' };
  }

  return { valid: true, site };
}

/**
 * Dispatch a job to the WordPress job queue
 */
export async function createWordPressJob(params: {
  websiteId: string;
  jobType: string;
  payload: Record<string, any>;
  idempotencyKey?: string;
}): Promise<{ job?: WordPressJob; error?: string }> {
  const supabase = await createClient();

  // Find outbound site
  const { data: site, error: siteErr } = await supabase
    .from('wordpress_outbound_sites')
    .select('id, status')
    .eq('website_id', params.websiteId)
    .eq('status', 'active')
    .maybeSingle();

  if (siteErr || !site) {
    return { error: 'No active outbound WordPress connection found for this website.' };
  }

  // Idempotency check: if job with idempotencyKey already exists, return existing
  if (params.idempotencyKey) {
    const { data: existingJob } = await supabase
      .from('wordpress_jobs')
      .select('*')
      .eq('site_id', site.id)
      .eq('idempotency_key', params.idempotencyKey)
      .maybeSingle();

    if (existingJob) {
      return { job: existingJob };
    }
  }

  const { data: job, error: jobErr } = await supabase
    .from('wordpress_jobs')
    .insert({
      site_id: site.id,
      website_id: params.websiteId,
      job_type: params.jobType,
      payload: params.payload,
      idempotency_key: params.idempotencyKey || `job_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
      status: 'pending',
    })
    .select('*')
    .single();

  if (jobErr || !job) {
    return { error: jobErr?.message || 'Failed to create job.' };
  }

  return { job };
}

/**
 * Wait for a job to complete (polling DB for up to timeoutMs)
 */
export async function waitForJobCompletion(jobId: string, timeoutMs = 15000): Promise<{
  completed: boolean;
  job?: WordPressJob;
  error?: string;
}> {
  const supabase = await createClient();
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const { data: job } = await supabase
      .from('wordpress_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (job) {
      if (job.status === 'completed') {
        return { completed: true, job };
      }
      if (job.status === 'failed') {
        return { completed: false, job, error: job.error?.message || 'Job execution failed on WordPress.' };
      }
    }

    await new Promise(res => setTimeout(res, 1000));
  }

  return { completed: false, error: 'Job timed out waiting for WordPress worker execution.' };
}
