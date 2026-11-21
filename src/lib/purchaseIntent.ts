/**
 * Guest purchase intent: a visitor who is not signed in clicks "Enroll now" → they are sent to the existing
 * sign-in page with a safe return address, and the intended purchase is remembered on this device for a short
 * time. After signing in (email/password, Google or a confirmation link) they come back to the same page and the
 * purchase continues once. Going back or cancelling sign-in never starts a checkout: the return address carries a
 * marker (?enroll=1 / ?buy=1 / ?checkout=cart) and the purchase only continues when that marker AND a matching,
 * recent intent from this browser are both present.
 */

export type PurchaseKind = 'course' | 'bundle' | 'cart';

export interface PurchaseIntent {
  kind: PurchaseKind;
  /** Course id or bundle slug ('cart' for the cart). */
  id: string;
  at: number;
}

const KEY = 'edufy_purchase_intent';
/** Long enough to create an account and click the confirmation email. */
export const INTENT_TTL_MS = 60 * 60 * 1000;

/** Query markers added to the return address. */
export const RESUME_PARAM: Record<PurchaseKind, [string, string]> = {
  course: ['enroll', '1'],
  bundle: ['buy', '1'],
  cart: ['checkout', 'cart'],
};

const idOk = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(id);

/**
 * A redirect target is accepted only when it is a path on this website: starts with a single "/", no
 * protocol-relative or backslash tricks, no control characters, not an auth callback, and resolves to the same
 * origin. Anything else → null (the caller falls back to its default page).
 */
export function safeInternalPath(value: unknown, origin = 'https://edufyacademy.com'): string | null {
  if (typeof value !== 'string' || value.length > 500) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  if (/[\u0000-\u001F\u007F]/.test(value)) return null;
  try {
    const u = new URL(value, origin);
    if (u.origin !== new URL(origin).origin) return null;
    if (u.pathname.startsWith('/auth/')) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

/** Return address for a purchase: the page with the resume marker. */
export function resumePath(kind: PurchaseKind, id: string, currentPath?: string): string {
  const [k, v] = RESUME_PARAM[kind];
  const base =
    kind === 'course' ? `/courses/${encodeURIComponent(id)}` : kind === 'bundle' ? `/bundles/${encodeURIComponent(id)}` : safeInternalPath(currentPath || '/')?.split(/[?#]/)[0] || '/';
  return `${base}?${k}=${v}`;
}

/** Existing sign-in page with the return address. */
export const loginUrl = (returnTo: string) => `/login?redirect=${encodeURIComponent(safeInternalPath(returnTo) || '/')}`;

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function saveIntent(kind: PurchaseKind, id: string, now = Date.now()): void {
  if (kind !== 'cart' && !idOk(id)) return;
  try {
    storage()?.setItem(KEY, JSON.stringify({ kind, id: kind === 'cart' ? 'cart' : id, at: now } satisfies PurchaseIntent));
  } catch {
    /* storage unavailable: the visitor simply clicks again after signing in */
  }
}

export function clearIntent(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Pure check (unit-tested): is `raw` a fresh intent for exactly this purchase? */
export function matchesIntent(raw: string | null, kind: PurchaseKind, id: string, now = Date.now()): boolean {
  if (!raw) return false;
  try {
    const i = JSON.parse(raw) as Partial<PurchaseIntent>;
    const wantId = kind === 'cart' ? 'cart' : id;
    return i?.kind === kind && i.id === wantId && typeof i.at === 'number' && now - i.at >= 0 && now - i.at <= INTENT_TTL_MS;
  } catch {
    return false;
  }
}

/** True once for a matching, recent intent; the intent is always cleared so it can never run twice. */
export function consumeIntent(kind: PurchaseKind, id: string, now = Date.now()): boolean {
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(KEY) ?? null;
  } catch {
    raw = null;
  }
  const ok = matchesIntent(raw, kind, id, now);
  if (raw) clearIntent();
  return ok;
}
