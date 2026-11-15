/**
 * Pure helpers for push notifications (no I/O) — validated and unit-tested in tests/pushLogic.test.ts.
 */

export const CATEGORIES = [
  'new_course', 'new_bundle', 'offer', 'discount', 'course_update', 'new_content',
  'announcement', 'custom', 'course_completion', 'certificate',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const AUDIENCES = ['all_students', 'enrolled_students', 'course_students', 'bundle_buyers'] as const;
export type Audience = (typeof AUDIENCES)[number];

export const TITLE_MAX = 65;
export const BODY_MAX = 240;
export const EXPO_BATCH = 100; // Expo Push Service: max 100 messages per request
export const RECEIPT_BATCH = 1000; // max ids per getReceipts request

/** Android notification channel used for each category (channels are created by the app). */
export function channelFor(category: string): string {
  switch (category) {
    case 'new_course':
    case 'new_bundle':
      return 'courses';
    case 'offer':
    case 'discount':
      return 'offers';
    case 'course_update':
    case 'new_content':
    case 'course_completion':
    case 'certificate':
      return 'learning';
    default:
      return 'announcements';
  }
}

/** Trim, drop control characters and collapse runs of whitespace (keeps single newlines). */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

const ID = '[A-Za-z0-9_-]{1,80}';
const UUID = '[0-9a-fA-F-]{36}';
/** In-app destinations a notification may open. Anything else is rejected. */
export const INTERNAL_ROUTES: RegExp[] = [
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

/** Validates an action URL: an https link or a whitelisted in-app path. Returns null when empty. */
export function validateActionUrl(v: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) return { ok: true, value: null };
  if (typeof v !== 'string') return { ok: false, error: 'Link must be text.' };
  const s = v.trim();
  if (s.length > 500) return { ok: false, error: 'Link is too long.' };
  if (s.startsWith('/')) {
    return INTERNAL_ROUTES.some((r) => r.test(s)) ? { ok: true, value: s } : { ok: false, error: 'Unknown in-app link.' };
  }
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:') return { ok: false, error: 'Links must use https://' };
    if (u.username || u.password) return { ok: false, error: 'Links must not contain credentials.' };
    if (/\s/.test(s)) return { ok: false, error: 'Links must not contain spaces.' };
    return { ok: true, value: u.toString() };
  } catch {
    return { ok: false, error: 'Not a valid link.' };
  }
}

export function validateImageUrl(v: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) return { ok: true, value: null };
  if (typeof v !== 'string') return { ok: false, error: 'Image link must be text.' };
  try {
    const u = new URL(v.trim());
    if (u.protocol !== 'https:' || /\s/.test(v.trim())) return { ok: false, error: 'Image link must be an https:// URL.' };
    return { ok: true, value: u.toString() };
  } catch {
    return { ok: false, error: 'Image link is not a valid URL.' };
  }
}

const isId = (v: unknown): v is string => typeof v === 'string' && new RegExp(`^${ID}$`).test(v);
const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);

export interface CampaignInput {
  title: string;
  body: string;
  image_url: string | null;
  action_url: string | null;
  category: Category;
  course_id: string | null;
  bundle_id: string | null;
  offer_id: string | null;
  audience: Audience;
  audience_course_id: string | null;
  audience_bundle_id: string | null;
}

/** Validates an admin's notification form. The database re-checks the same rules. */
export function validateCampaign(raw: any): { ok: true; value: CampaignInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const title = cleanText(raw?.title, 200);
  const body = cleanText(raw?.body, 2000);
  if (!title) errors.title = 'Title is required.';
  else if (title.length > TITLE_MAX) errors.title = `Title must be ${TITLE_MAX} characters or fewer.`;
  if (!body) errors.body = 'Message is required.';
  else if (body.length > BODY_MAX) errors.body = `Message must be ${BODY_MAX} characters or fewer.`;

  const category = raw?.category;
  if (!CATEGORIES.includes(category)) errors.category = 'Choose a category.';
  const audience = raw?.audience ?? 'all_students';
  if (!AUDIENCES.includes(audience)) errors.audience = 'Choose a target audience.';

  const img = validateImageUrl(raw?.imageUrl ?? raw?.image_url);
  if (!img.ok) errors.imageUrl = img.error;
  const act = validateActionUrl(raw?.actionUrl ?? raw?.action_url);
  if (!act.ok) errors.actionUrl = act.error;

  const opt = (v: unknown, check: (x: unknown) => boolean, field: string, label: string) => {
    if (v === undefined || v === null || v === '') return null;
    if (!check(v)) {
      errors[field] = `Invalid ${label}.`;
      return null;
    }
    return v as string;
  };
  const course_id = opt(raw?.courseId ?? raw?.course_id, isId, 'courseId', 'course');
  const bundle_id = opt(raw?.bundleId ?? raw?.bundle_id, isId, 'bundleId', 'bundle');
  const offer_id = opt(raw?.offerId ?? raw?.offer_id, isUuid, 'offerId', 'offer');
  const audience_course_id = opt(raw?.audienceCourseId ?? raw?.audience_course_id, isId, 'audienceCourseId', 'course');
  const audience_bundle_id = opt(raw?.audienceBundleId ?? raw?.audience_bundle_id, isId, 'audienceBundleId', 'bundle');
  if (audience === 'course_students' && !audience_course_id) errors.audienceCourseId = 'Choose the course whose students should receive this.';
  if (audience === 'bundle_buyers' && !audience_bundle_id) errors.audienceBundleId = 'Choose the bundle whose buyers should receive this.';

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title, body, image_url: img.ok ? img.value : null, action_url: act.ok ? act.value : null,
      category, course_id, bundle_id, offer_id, audience,
      audience_course_id: audience === 'course_students' ? audience_course_id : null,
      audience_bundle_id: audience === 'bundle_buyers' ? audience_bundle_id : null,
    },
  };
}

/** Default in-app destination when the admin didn't give a link. */
export function defaultActionUrl(c: { action_url?: string | null; course_id?: string | null; bundle_id?: string | null; offer_id?: string | null }): string | null {
  if (c.action_url) return c.action_url;
  if (c.offer_id) return `/offer/${c.offer_id}`;
  if (c.course_id) return `/course/${c.course_id}`;
  if (c.bundle_id) return `/bundle/${c.bundle_id}`;
  return null;
}

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export interface PushContent {
  title: string;
  body: string;
  image_url?: string | null;
  category: string;
  url: string | null;
  data: Record<string, string>;
}

/** Expo push message for one device. The data payload stays well under the 4 KB limit. */
export function expoMessage(token: string, c: PushContent) {
  const msg: Record<string, unknown> = {
    to: token,
    title: c.title,
    body: c.body,
    sound: 'default',
    priority: 'high',
    channelId: channelFor(c.category),
    data: { ...c.data, type: c.category, ...(c.url ? { url: c.url } : {}) },
    ttl: 60 * 60 * 24 * 7,
  };
  if (c.image_url) msg.richContent = { image: c.image_url };
  return msg;
}

export type TicketOutcome = { status: 'ok'; id: string } | { status: 'error'; error: string; invalidToken: boolean };

/** Interprets one Expo push ticket. */
export function readTicket(t: any): TicketOutcome {
  if (t && t.status === 'ok' && typeof t.id === 'string') return { status: 'ok', id: t.id };
  const code = t?.details?.error || 'Unknown';
  return { status: 'error', error: String(t?.message || code).slice(0, 300), invalidToken: code === 'DeviceNotRegistered' };
}

/** HTTP status codes worth retrying (with backoff) when calling Expo. */
export const isRetryableStatus = (status: number) => status === 429 || status >= 500;

/** Final campaign status from its delivery counts. */
export function finalStatus(counts: { devices: number; ticketsOk: number }): { status: 'sent' | 'failed'; note: string | null } {
  if (counts.devices === 0) return { status: 'sent', note: 'No registered devices — saved to each student’s notification centre only.' };
  if (counts.ticketsOk === 0) return { status: 'failed', note: 'Expo rejected every push for this notification.' };
  return { status: 'sent', note: null };
}
