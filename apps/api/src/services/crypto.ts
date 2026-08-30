// Symmetric encryption for at-rest secrets (GMI API keys, etc.).
//
// Why this exists
// ----------------
// We store user-supplied secrets in D1. D1 is encrypted at rest by
// Cloudflare, but defense in depth says we should not store plaintext
// for a value the user explicitly trusts us with. We use AES-256-GCM
// with a per-deployment key (GMI_ENC_KEY) supplied as a Worker secret
// via `wrangler secret put`.
//
// Format on disk
// --------------
//   <base64(iv)>{1}<base64(authTag)>{1}<base64(ciphertext)>
//
// The IV is 12 bytes (recommended for GCM) and is generated fresh per
// write. The auth tag (16 bytes) is the standard GCM tag length.
//
// Key management
// --------------
// The deployment key must be 32 raw bytes. Locally we accept a
// 32+ character string and SHA-256 it to derive the key. In production
// generate a real 32-byte key:
//   openssl rand -base64 32
// and put it in:
//   wrangler secret put GMI_ENC_KEY

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';

const ALG = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SEP = '{1}'; // unlikely to appear in base64 output

function getKey(secret: string | undefined): Buffer {
  if (!secret) {
    throw new Error(
      'GMI_ENC_KEY is not set. Generate one with `openssl rand -base64 32` ' +
        'and add it to .dev.vars (local) or `wrangler secret put GMI_ENC_KEY` (prod).',
    );
  }
  // SHA-256 the input to derive a uniform 32-byte key from any-length
  // passphrase. Production deployments should use the raw 32 bytes
  // from `openssl rand`, which already hash to themselves.
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function encrypt(plaintext: string, secret: string | undefined): string {
  const key = getKey(secret);
  const iv = Buffer.from(randomBytes(IV_BYTES));
  const cipher = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = Buffer.from(cipher.getAuthTag());
  return [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(SEP);
}

export function decrypt(payload: string, secret: string | undefined): string {
  const key = getKey(secret);
  const [ivB64, tagB64, ctB64] = payload.split(SEP);
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error('Malformed ciphertext');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  if (iv.length !== IV_BYTES) throw new Error('Bad IV length');
  if (tag.length !== TAG_BYTES) throw new Error('Bad auth tag length');
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

/**
 * Cheap "looks like an encrypted value" check used so we can refuse to
 * accidentally double-encrypt values that are already encrypted (e.g.
 * during a migration).
 */
export function isCiphertext(value: string): boolean {
  const parts = value.split(SEP);
  if (parts.length !== 3) return false;
  try {
    const [iv, tag, ct] = parts;
    return (
      !!iv && !!tag && !!ct &&
      Buffer.from(iv!, 'base64').length === IV_BYTES &&
      Buffer.from(tag!, 'base64').length === TAG_BYTES &&
      Buffer.from(ct!, 'base64').length > 0
    );
  } catch {
    return false;
  }
}
