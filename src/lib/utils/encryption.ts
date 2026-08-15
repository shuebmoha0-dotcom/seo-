import crypto from 'crypto';

/**
 * Server-side Credential Encryption Utility
 * Uses AES-256-GCM for authenticated encryption of stored secrets (e.g. WordPress Application Passwords).
 * Decrypted credentials are NEVER sent to the frontend or included in logs.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'default-secret-key-for-development-32chars!';
  // Derive a 32-byte key using SHA-256
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts plaintext string into a safe base64 format: iv:tag:ciphertext
 */
export function encryptCredential(plainText: string): string {
  if (!plainText) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts base64/hex formatted string back to plaintext.
 */
export function decryptCredential(cipherText: string): string {
  if (!cipherText) return '';
  
  // Format check: iv:tag:encrypted
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    // If not encrypted in GCM format (e.g. legacy fallback), return empty or raw if safe
    return '';
  }

  try {
    const [ivHex, tagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('[Encryption] Failed to decrypt credential');
    return '';
  }
}
