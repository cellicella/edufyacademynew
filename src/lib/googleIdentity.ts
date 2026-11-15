/**
 * Google Identity Services (GIS) loader for the official "Sign in with Google" button and One Tap.
 *
 * - The script URL is a fixed constant (never taken from settings or the database).
 * - A random nonce is generated per page load: Google receives its SHA-256 hash, Supabase receives the raw
 *   value with the ID token (supabase.auth.signInWithIdToken), so a stolen token cannot be replayed.
 * - Only the public Web Client ID is used here. The Client Secret stays on the server / in Supabase.
 */
const GIS_SRC = 'https://accounts.google.com/gsi/client';
export const GOOGLE_CLIENT_ID_RE = /^[0-9]{6,}-[a-z0-9]+\.apps\.googleusercontent\.com$/;

let scriptPromise: Promise<any> | null = null;
let initialisedFor = '';
let rawNonce = '';
let handler: ((credential: string, nonce: string) => void) | null = null;

export function loadGis(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No browser'));
  const w = window as any;
  if (w.google?.accounts?.id) return Promise.resolve(w.google);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => (w.google?.accounts?.id ? resolve(w.google) : reject(new Error('Google sign-in did not load.')));
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('Google sign-in could not be loaded (blocked by the browser or offline).'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

async function sha256Hex(v: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Loads GIS and initialises it once for this client ID. The latest registered handler receives credentials. */
export async function prepareGoogle(clientId: string, onCredential: (credential: string, nonce: string) => void): Promise<any> {
  if (!GOOGLE_CLIENT_ID_RE.test(clientId)) throw new Error('Google Client ID is not configured.');
  handler = onCredential;
  const google = await loadGis();
  if (initialisedFor !== clientId) {
    rawNonce = Array.from(crypto.getRandomValues(new Uint8Array(24))).map((b) => b.toString(16).padStart(2, '0')).join('');
    google.accounts.id.initialize({
      client_id: clientId,
      nonce: await sha256Hex(rawNonce),
      callback: (resp: { credential?: string }) => {
        if (resp?.credential && handler) handler(resp.credential, rawNonce);
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      itp_support: true,
      use_fedcm_for_prompt: true,
      context: 'signin',
      ux_mode: 'popup',
    });
    initialisedFor = clientId;
  }
  return google;
}

export function cancelOneTap() {
  try {
    (window as any).google?.accounts?.id?.cancel();
  } catch {
    /* not loaded */
  }
}

/** Call on sign-out so Google does not auto-select the account again. */
export function disableGoogleAutoSelect() {
  try {
    (window as any).google?.accounts?.id?.disableAutoSelect();
  } catch {
    /* not loaded */
  }
}

/**
 * Whether the Google provider is switched on in Supabase Auth (public GET /auth/v1/settings, no secrets).
 * Resolves null when unknown (offline / not configured), so the button stays usable and reports errors itself.
 */
let providerCache: Promise<boolean | null> | null = null;
export function googleProviderEnabled(): Promise<boolean | null> {
  if (providerCache) return providerCache;
  const url = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '');
  if (!/^https:\/\//.test(url) || !key) return Promise.resolve(null);
  providerCache = fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (typeof j?.external?.google === 'boolean' ? j.external.google : null))
    .catch(() => null);
  return providerCache;
}
