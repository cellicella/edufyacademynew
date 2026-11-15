/**
 * Encrypted credential storage for runtime-updatable secrets (Razorpay, email provider, Emovur).
 *
 * - Secrets are encrypted with AES-256-GCM using SETTINGS_ENCRYPTION_KEY (server environment only) and
 *   stored in public.secure_credentials, a table with RLS on and no policies: only the service role can read it.
 * - Two slots per provider: 'pending' (saved, not used for traffic) and 'active' (used). A pending set is
 *   promoted to active only after a successful server-side test (see settings.ts).
 * - When no active row exists, callers fall back to environment variables (the previous behaviour).
 * - Secret values are never logged and never returned to any client; only masked hints are.
 */
import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { maskSecret } from './settingsSchema';

export type Provider = 'razorpay' | 'email' | 'emovur' | 'google' | 'auth_hook';
export type Slot = 'active' | 'pending';

export interface CredentialRecord {
  provider: Provider;
  slot: Slot;
  publicConfig: Record<string, string>;
  secrets: Record<string, string>;
  hints: Record<string, string>;
  status: 'unverified' | 'verified' | 'failed';
  verifiedAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
}

/** Derives the 32-byte key: base64 of exactly 32 bytes, or any passphrase of 32+ characters (SHA-256). */
export function deriveKey(raw: string | undefined | null): Buffer | null {
  const v = (raw || '').trim();
  if (!v) return null;
  try {
    const b = Buffer.from(v, 'base64');
    if (b.length === 32 && /^[A-Za-z0-9+/=]+$/.test(v)) return b;
  } catch {
    /* not base64 */
  }
  if (v.length < 32) return null;
  return crypto.createHash('sha256').update(v, 'utf8').digest();
}

export function encryptJson(key: Buffer, data: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${Buffer.concat([iv, tag, ct]).toString('base64')}`;
}

export function decryptJson<T = any>(key: Buffer, payload: string): T {
  if (!payload.startsWith('v1:')) throw new Error('Unsupported credential format.');
  const buf = Buffer.from(payload.slice(3), 'base64');
  if (buf.length < 29) throw new Error('Credential payload is too short.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  const pt = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
  return JSON.parse(pt.toString('utf8'));
}

const CACHE_MS = 60_000;

export function createCredentialStore(db: SupabaseClient | null, rawKey: string | undefined) {
  const key = deriveKey(rawKey);
  const cache = new Map<string, { at: number; rec: CredentialRecord | null }>();
  const listeners = new Set<(p: Provider) => void>();

  const cacheKey = (p: Provider, s: Slot) => `${p}:${s}`;

  async function load(provider: Provider, slot: Slot, fresh = false): Promise<CredentialRecord | null> {
    const ck = cacheKey(provider, slot);
    const hit = cache.get(ck);
    if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.rec;
    if (!db) return null;
    const { data, error } = await db
      .from('secure_credentials')
      .select('provider, slot, public_config, secret_ciphertext, secret_hint, status, verified_at, last_error, updated_at')
      .eq('provider', provider)
      .eq('slot', slot)
      .maybeSingle();
    if (error) {
      // Table missing (migration not run) → behave as "no stored credentials"
      if (!/does not exist|schema cache/i.test(error.message)) console.error(`[Credentials] load ${provider}/${slot} failed: ${error.message}`);
      cache.set(ck, { at: Date.now(), rec: null });
      return null;
    }
    let rec: CredentialRecord | null = null;
    if (data) {
      let secrets: Record<string, string> = {};
      if (data.secret_ciphertext) {
        if (!key) {
          console.error(`[Credentials] ${provider}/${slot} is stored encrypted but SETTINGS_ENCRYPTION_KEY is not set; ignoring it.`);
          cache.set(ck, { at: Date.now(), rec: null });
          return null;
        }
        try {
          secrets = decryptJson(key, data.secret_ciphertext);
        } catch {
          console.error(`[Credentials] ${provider}/${slot} could not be decrypted (wrong SETTINGS_ENCRYPTION_KEY?); ignoring it.`);
          cache.set(ck, { at: Date.now(), rec: null });
          return null;
        }
      }
      rec = {
        provider, slot, publicConfig: data.public_config || {}, secrets, hints: data.secret_hint || {},
        status: data.status, verifiedAt: data.verified_at, lastError: data.last_error, updatedAt: data.updated_at,
      };
    }
    cache.set(ck, { at: Date.now(), rec });
    return rec;
  }

  function invalidate(provider: Provider) {
    cache.delete(cacheKey(provider, 'active'));
    cache.delete(cacheKey(provider, 'pending'));
    for (const l of listeners) l(provider);
  }

  return {
    /** true when secrets can be saved from the admin panel */
    get canEncrypt() {
      return !!key && !!db;
    },
    load,
    invalidate,
    onChange(fn: (p: Provider) => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** Saves (or replaces) the pending slot. Empty secret fields keep the previous pending/active value. */
    async savePending(provider: Provider, publicConfig: Record<string, string>, secrets: Record<string, string>, userId: string) {
      if (!key || !db) throw new Error('SETTINGS_ENCRYPTION_KEY is not configured on the server.');
      const base = (await load(provider, 'pending', true)) || (await load(provider, 'active', true));
      const merged: Record<string, string> = { ...(base?.secrets || {}) };
      for (const [k, v] of Object.entries(secrets)) if (v) merged[k] = v;
      const hints = Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, maskSecret(v)]));
      const { error } = await db.from('secure_credentials').upsert(
        {
          provider, slot: 'pending', public_config: publicConfig, secret_ciphertext: encryptJson(key, merged), secret_hint: hints,
          status: 'unverified', verified_at: null, last_error: null, updated_at: new Date().toISOString(), updated_by: userId,
        },
        { onConflict: 'provider,slot' }
      );
      if (error) throw new Error(error.message);
      invalidate(provider);
      return { hints };
    },

    async setStatus(provider: Provider, slot: Slot, status: 'verified' | 'failed', lastError: string | null) {
      if (!db) return;
      await db
        .from('secure_credentials')
        .update({ status, last_error: lastError ? lastError.slice(0, 500) : null, verified_at: status === 'verified' ? new Date().toISOString() : null })
        .eq('provider', provider)
        .eq('slot', slot);
      invalidate(provider);
    },

    /** Promotes the verified pending set to active (atomic enough: upsert active, then delete pending). */
    async activatePending(provider: Provider, userId: string) {
      if (!db) throw new Error('Database unavailable.');
      const { data: p, error } = await db.from('secure_credentials').select('*').eq('provider', provider).eq('slot', 'pending').maybeSingle();
      if (error) throw new Error(error.message);
      if (!p) throw new Error('There are no saved credentials waiting for activation.');
      if (p.status !== 'verified') throw new Error('Run "Test configuration" successfully before activating these credentials.');
      const { error: e2 } = await db.from('secure_credentials').upsert(
        { ...p, slot: 'active', updated_at: new Date().toISOString(), updated_by: userId },
        { onConflict: 'provider,slot' }
      );
      if (e2) throw new Error(e2.message);
      await db.from('secure_credentials').delete().eq('provider', provider).eq('slot', 'pending');
      invalidate(provider);
    },

    async discard(provider: Provider, slot: Slot) {
      if (!db) return;
      await db.from('secure_credentials').delete().eq('provider', provider).eq('slot', slot);
      invalidate(provider);
    },

    /** Safe description for the admin UI (no secret values). */
    async describe(provider: Provider) {
      const view = (r: CredentialRecord | null) =>
        r && { publicConfig: r.publicConfig, hints: r.hints, status: r.status, verifiedAt: r.verifiedAt, lastError: r.lastError, updatedAt: r.updatedAt };
      return { active: view(await load(provider, 'active', true)), pending: view(await load(provider, 'pending', true)) };
    },
  };
}

export type CredentialStore = ReturnType<typeof createCredentialStore>;
