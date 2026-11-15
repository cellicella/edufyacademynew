/**
 * Pure helpers for banners, offers, notifications, recently viewed and recommendations.
 */

export interface Banner {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  linkType: 'none' | 'course' | 'bundle' | 'offer' | 'blog' | 'url';
  courseId: string | null;
  bundleId: string | null;
  offerId: string | null;
  blogSlug?: string | null;
  url: string | null;
  startsAt: string | null;
  endsAt: string | null;
  position: number;
  subtitle?: string | null;
  ctaText?: string | null;
}

export interface Offer {
  id: string;
  title: string;
  description: string | null;
  discountText: string | null;
  offerType: string;
  imageUrl: string | null;
  linkType: 'none' | 'course' | 'bundle' | 'url';
  courseId: string | null;
  bundleId: string | null;
  url: string | null;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
}

export interface InboxItem {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  actionUrl: string | null;
  category: string;
  courseId: string | null;
  bundleId: string | null;
  offerId: string | null;
  readAt: string | null;
  createdAt: string;
  pushNotificationId: string | null;
}

const httpsOrNull = (v: unknown) => (typeof v === 'string' && /^https:\/\/\S+$/.test(v) ? v : null);

export function mapBanner(r: any): Banner {
  return {
    id: String(r.id), title: String(r.title || ''), description: r.description || null, imageUrl: httpsOrNull(r.image_url),
    linkType: ['course', 'bundle', 'offer', 'blog', 'url'].includes(r.link_type) ? r.link_type : 'none',
    courseId: r.course_id || null, bundleId: r.bundle_id || null, offerId: r.offer_id || null, url: httpsOrNull(r.link_url),
    blogSlug: typeof r.blog_slug === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.blog_slug) ? r.blog_slug : null,
    startsAt: r.starts_at || null, endsAt: r.ends_at || null, position: Number(r.position) || 0,
    subtitle: r.subtitle || null, ctaText: typeof r.cta_text === 'string' && r.cta_text.trim() ? r.cta_text.trim().slice(0, 40) : null,
  };
}

export function mapOffer(r: any): Offer {
  return {
    id: String(r.id), title: String(r.title || ''), description: r.description || null, discountText: r.discount_text || null,
    offerType: r.offer_type || 'special', imageUrl: httpsOrNull(r.image_url),
    linkType: ['course', 'bundle', 'url'].includes(r.link_type) ? r.link_type : 'none',
    courseId: r.course_id || null, bundleId: r.bundle_id || null, url: httpsOrNull(r.link_url),
    startsAt: r.starts_at, endsAt: r.ends_at || null, isActive: !!r.is_active,
  };
}

export function mapInbox(r: any): InboxItem {
  return {
    id: String(r.id), title: String(r.title || ''), body: String(r.body || ''), imageUrl: httpsOrNull(r.image_url), actionUrl: r.action_url || null,
    category: r.category || 'announcement', courseId: r.course_id || null, bundleId: r.bundle_id || null, offerId: r.offer_id || null,
    readAt: r.read_at || null, createdAt: r.created_at, pushNotificationId: r.push_notification_id || null,
  };
}

/** Live = inside its date window right now (the database applies the same rule; this guards cached data). */
export function isLive(item: { startsAt: string | null; endsAt: string | null; isActive?: boolean }, now = Date.now()): boolean {
  if (item.isActive === false) return false;
  if (item.startsAt && new Date(item.startsAt).getTime() > now) return false;
  if (item.endsAt && new Date(item.endsAt).getTime() <= now) return false;
  return true;
}

/** "Ends in 3 days" / "Ends today" / "Ended" for an offer. */
export function offerCountdown(endsAt: string | null, now = Date.now()): string | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return 'Offer ended';
  const hours = Math.floor(ms / 3600_000);
  if (hours < 1) return 'Ends in under an hour';
  if (hours < 24) return `Ends in ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `Ends in ${days} day${days === 1 ? '' : 's'}`;
}

export const CATEGORY_META: Record<string, { label: string; icon: string; tone: 'primary' | 'accent' | 'success' | 'warning' }> = {
  new_course: { label: 'New course', icon: 'sparkles', tone: 'primary' },
  new_bundle: { label: 'New bundle', icon: 'albums', tone: 'accent' },
  offer: { label: 'Offer', icon: 'pricetag', tone: 'accent' },
  discount: { label: 'Discount', icon: 'pricetags', tone: 'accent' },
  course_update: { label: 'Course update', icon: 'refresh-circle', tone: 'primary' },
  new_content: { label: 'New content', icon: 'play-circle', tone: 'primary' },
  announcement: { label: 'Announcement', icon: 'megaphone', tone: 'warning' },
  custom: { label: 'Message', icon: 'chatbubble-ellipses', tone: 'primary' },
  course_completion: { label: 'Completed', icon: 'trophy', tone: 'success' },
  certificate: { label: 'Certificate', icon: 'ribbon', tone: 'success' },
};
export const categoryMeta = (c: string) => CATEGORY_META[c] || CATEGORY_META.custom;

/** Group notifications under Today / Yesterday / Earlier. */
export function groupByDay<T extends { createdAt: string }>(items: T[], now = new Date()): { title: string; data: T[] }[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groups: Record<string, T[]> = { Today: [], Yesterday: [], Earlier: [] };
  for (const it of items) {
    const t = new Date(it.createdAt).getTime();
    groups[t >= start ? 'Today' : t >= start - 86400_000 ? 'Yesterday' : 'Earlier'].push(it);
  }
  return Object.entries(groups).filter(([, d]) => d.length).map(([title, data]) => ({ title, data }));
}

/** Most-recent-first list of course ids, without duplicates, capped. */
export function pushRecent(list: string[], id: string, max = 12): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, max);
}

interface RecCourse {
  id: string;
  category: string;
  rating: number;
  enrolledCount: number;
  featured?: boolean;
  trending?: boolean;
}

/**
 * Recommendations from real signals: categories of courses the student owns or viewed recently,
 * excluding courses they already own. Falls back to trending/popular courses.
 */
export function recommend<T extends RecCourse>(all: T[], ownedIds: Set<string>, recentIds: string[], limit = 8): T[] {
  const byId = new Map(all.map((c) => [c.id, c]));
  const weights = new Map<string, number>();
  for (const id of ownedIds) {
    const c = byId.get(id);
    if (c) weights.set(c.category, (weights.get(c.category) || 0) + 2);
  }
  recentIds.forEach((id, i) => {
    const c = byId.get(id);
    if (c) weights.set(c.category, (weights.get(c.category) || 0) + Math.max(0.5, 1.5 - i * 0.1));
  });
  const score = (c: T) => (weights.get(c.category) || 0) * 10 + (c.trending ? 3 : 0) + (c.featured ? 2 : 0) + c.rating + Math.log10(1 + c.enrolledCount);
  return all
    .filter((c) => !ownedIds.has(c.id))
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
}
