/**
 * Safe navigation targets for notification taps, banners and offers.
 * Only whitelisted in-app routes and https:// links are allowed — anything else is ignored.
 * (Mirrors the server whitelist in server/pushLogic.ts.)
 */

export type LinkTarget = { kind: 'internal'; path: string } | { kind: 'external'; url: string };

const ID = '[A-Za-z0-9_-]{1,80}';
const UUID = '[0-9a-fA-F-]{36}';
const INTERNAL: RegExp[] = [
  new RegExp(`^/course/${ID}$`),
  new RegExp(`^/bundle/${ID}$`),
  new RegExp(`^/learn/${ID}(\\?lesson=${ID})?$`),
  new RegExp(`^/offer/${UUID}$`),
  new RegExp(`^/certificate/${UUID}$`),
  new RegExp(`^/certificates(\\?claim=${ID})?$`),
  /^\/(bundles|offers|notifications|certificates)$/,
  /^\/blog(\/[a-z0-9]+(-[a-z0-9]+)*)?$/,
  /^\/\(tabs\)(\/(learning|explore|profile))?$/,
];

export function isSafeInternalPath(path: unknown): path is string {
  return typeof path === 'string' && INTERNAL.some((r) => r.test(path));
}

export function isSafeExternalUrl(url: unknown): url is string {
  if (typeof url !== 'string' || /\s/.test(url) || url.length > 500) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** A single link string (from a notification or banner) → validated target. */
export function parseLink(link: unknown): LinkTarget | null {
  if (typeof link !== 'string' || !link.trim()) return null;
  const s = link.trim();
  if (s.startsWith('/')) return isSafeInternalPath(s) ? { kind: 'internal', path: s } : null;
  return isSafeExternalUrl(s) ? { kind: 'external', url: s } : null;
}

const isId = (v: unknown): v is string => typeof v === 'string' && new RegExp(`^${ID}$`).test(v);
const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);

/**
 * Where should tapping a push notification go? Uses the explicit url first, then the related
 * offer/course/bundle, and falls back to the notification centre.
 */
export function notificationTarget(data: Record<string, unknown> | null | undefined): LinkTarget {
  const d = data || {};
  const fromUrl = parseLink(d.url);
  if (fromUrl) return fromUrl;
  if (isUuid(d.offerId)) return { kind: 'internal', path: `/offer/${d.offerId}` };
  if (isId(d.courseId)) return { kind: 'internal', path: `/course/${d.courseId}` };
  if (isId(d.bundleId)) return { kind: 'internal', path: `/bundle/${d.bundleId}` };
  return { kind: 'internal', path: '/notifications' };
}

/** Banner / offer link fields → target (null when the item has no link). */
export function itemTarget(i: { linkType: string; courseId?: string | null; bundleId?: string | null; offerId?: string | null; blogSlug?: string | null; url?: string | null }): LinkTarget | null {
  switch (i.linkType) {
    case 'blog':
      return typeof i.blogSlug === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(i.blogSlug) ? { kind: 'internal', path: `/blog/${i.blogSlug}` } : null;
    case 'course':
      return isId(i.courseId) ? { kind: 'internal', path: `/course/${i.courseId}` } : null;
    case 'bundle':
      return isId(i.bundleId) ? { kind: 'internal', path: `/bundle/${i.bundleId}` } : null;
    case 'offer':
      return isUuid(i.offerId) ? { kind: 'internal', path: `/offer/${i.offerId}` } : null;
    case 'url':
      return isSafeExternalUrl(i.url) ? { kind: 'external', url: i.url } : null;
    default:
      return null;
  }
}
