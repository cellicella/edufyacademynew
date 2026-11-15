import { API_BASE_URL } from './api';
import { getAuthToken, supabase } from '../lib/supabase';
import { readJson } from '../lib/http';

/* Admin-only client for push notifications, banners and offers.
   Sending always goes through the Express server; banners/offers use Supabase directly
   (row-level security allows writes only for administrators). */

export type PushCategory =
  | 'new_course' | 'new_bundle' | 'offer' | 'discount' | 'course_update' | 'new_content'
  | 'announcement' | 'custom' | 'course_completion' | 'certificate';
export type PushAudience = 'all_students' | 'enrolled_students' | 'course_students' | 'bundle_buyers';
export type PushStatus = 'draft' | 'pending_review' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';

export interface PushCampaign {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  action_url: string | null;
  category: PushCategory;
  course_id: string | null;
  bundle_id: string | null;
  offer_id: string | null;
  audience: PushAudience;
  audience_course_id: string | null;
  audience_bundle_id: string | null;
  status: PushStatus;
  scheduled_at: string | null;
  source: 'manual' | 'auto_course' | 'auto_bundle' | 'offer';
  created_at: string;
  sent_at: string | null;
  cancelled_at: string | null;
  target_count: number;
  inbox_count: number;
  device_count: number;
  tickets_ok: number;
  tickets_failed: number;
  receipts_ok: number;
  receipts_failed: number;
  last_error: string | null;
  attempts: number;
}

export interface PushSettings {
  auto_course_enabled: boolean;
  auto_bundle_enabled: boolean;
  auto_requires_review: boolean;
  auto_audience: 'all_students' | 'enrolled_students';
  auto_delay_minutes: number;
}

export interface PushOverview {
  counts: Record<PushStatus, number>;
  total: number;
  totals: { targeted: number; accepted: number; rejected: number; delivered: number; receiptErrors: number };
  devices: number;
  notifications: PushCampaign[];
  settings: Partial<PushSettings>;
  worker: { lastRunAt: string | null; lastError: string | null; lastReceiptsAt: string | null; accessTokenConfigured: boolean };
}

export interface CampaignForm {
  title: string;
  body: string;
  imageUrl: string;
  actionUrl: string;
  category: PushCategory;
  courseId: string;
  bundleId: string;
  offerId: string;
  audience: PushAudience;
  audienceCourseId: string;
  audienceBundleId: string;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public fieldErrors?: Record<string, string>, public needsConfirmation?: boolean) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  const data = await readJson(res).catch(() => ({} as any));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.fieldErrors, data.needsConfirmation);
  return data as T;
}

const blankToNull = (f: CampaignForm) => ({
  title: f.title, body: f.body, imageUrl: f.imageUrl || null, actionUrl: f.actionUrl || null, category: f.category,
  courseId: f.courseId || null, bundleId: f.bundleId || null, offerId: f.offerId || null, audience: f.audience,
  audienceCourseId: f.audienceCourseId || null, audienceBundleId: f.audienceBundleId || null,
});

export const pushAdmin = {
  overview: () => call<PushOverview>('/admin/push/overview'),
  detail: (id: string) => call<{ notification: PushCampaign; failureReasons: Record<string, number>; readInApp: number }>(`/admin/push/notifications/${id}`),
  audiencePreview: (f: Pick<CampaignForm, 'audience' | 'audienceCourseId' | 'audienceBundleId' | 'category'>) =>
    call<{ students: number; devices: number; studentsWithDevices: number }>('/admin/push/audience-preview', {
      method: 'POST',
      body: JSON.stringify({ audience: f.audience, audienceCourseId: f.audienceCourseId || null, audienceBundleId: f.audienceBundleId || null, category: f.category }),
    }),
  create: (f: CampaignForm, opts: { mode: 'draft' | 'schedule' | 'now'; scheduledAt?: string; confirmed?: boolean; idempotencyKey: string; source?: 'offer' }) =>
    call<{ notification: PushCampaign; duplicate?: boolean }>('/admin/push/notifications', { method: 'POST', body: JSON.stringify({ ...blankToNull(f), ...opts }) }),
  update: (id: string, f: CampaignForm, scheduledAt?: string) =>
    call<{ notification: PushCampaign }>(`/admin/push/notifications/${id}`, { method: 'PATCH', body: JSON.stringify({ ...blankToNull(f), scheduledAt }) }),
  sendNow: (id: string, confirmed?: boolean) => call<{ notification: PushCampaign }>(`/admin/push/notifications/${id}/send`, { method: 'POST', body: JSON.stringify({ confirmed }) }),
  schedule: (id: string, scheduledAt: string, confirmed?: boolean) =>
    call<{ notification: PushCampaign }>(`/admin/push/notifications/${id}/schedule`, { method: 'POST', body: JSON.stringify({ scheduledAt, confirmed }) }),
  cancel: (id: string) => call<{ notification: PushCampaign }>(`/admin/push/notifications/${id}/cancel`, { method: 'POST', body: '{}' }),
  remove: (id: string) => call<{ success: boolean }>(`/admin/push/notifications/${id}`, { method: 'DELETE' }),
  saveSettings: (s: PushSettings) => call<{ settings: PushSettings }>('/admin/push/settings', { method: 'PUT', body: JSON.stringify(s) }),
  test: (title: string, body: string) => call<{ devices: number; accepted: number; failed: number; error: string | null }>('/admin/push/test', { method: 'POST', body: JSON.stringify({ title, body }) }),
};

/* ------------------------------------------------------------------ catalogue pickers */
export interface PickItem { id: string; title: string; thumbnail: string | null; isPublished: boolean }
export async function loadPickers(): Promise<{ courses: PickItem[]; bundles: PickItem[]; offers: PickItem[] }> {
  const [c, b, o] = await Promise.all([
    supabase.from('courses').select('id, title, thumbnail_url, is_published').order('title'),
    supabase.from('bundles').select('id, title, thumbnail_url, is_published').order('title'),
    supabase.from('offers').select('id, title, image_url, is_active, ends_at').order('created_at', { ascending: false }),
  ]);
  if (c.error) throw new Error(c.error.message);
  const now = Date.now();
  return {
    courses: (c.data || []).map((r: any) => ({ id: r.id, title: r.title, thumbnail: r.thumbnail_url, isPublished: !!r.is_published })),
    bundles: (b.data || []).map((r: any) => ({ id: r.id, title: r.title, thumbnail: r.thumbnail_url, isPublished: !!r.is_published })),
    offers: (o.data || []).map((r: any) => ({ id: r.id, title: r.title, thumbnail: r.image_url, isPublished: !!r.is_active && (!r.ends_at || new Date(r.ends_at).getTime() > now) })),
  };
}

/* ------------------------------------------------------------------ banners */
export type LinkType = 'none' | 'course' | 'bundle' | 'offer' | 'blog' | 'url';
export type BannerPlacement = 'app' | 'website' | 'both';
export interface BannerRow {
  id?: string;
  title: string;
  subtitle?: string | null;
  description: string | null;
  image_url: string | null;
  mobile_image_url?: string | null;
  cta_text?: string | null;
  blog_slug?: string | null;
  placement?: BannerPlacement;
  link_type: LinkType;
  course_id: string | null;
  bundle_id: string | null;
  offer_id: string | null;
  link_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  position: number;
}

export const bannerAdmin = {
  /** placement 'app' also lists banners shown on both; same for 'website'. */
  async list(placement?: 'app' | 'website'): Promise<BannerRow[]> {
    let q = supabase.from('banners').select('*').order('position').order('created_at');
    if (placement) q = q.in('placement', [placement, 'both']);
    const { data, error } = await q;
    if (error) {
      // Before the settings migration there is no placement column: every banner is an app banner
      if (placement && /placement/.test(error.message)) {
        if (placement === 'website') throw new Error('Run the settings database migration (supabase/RUN_IN_SQL_EDITOR.sql) to enable website banners.');
        const r = await supabase.from('banners').select('*').order('position').order('created_at');
        if (r.error) throw new Error(r.error.message);
        return r.data as BannerRow[];
      }
      throw new Error(error.message);
    }
    return data as BannerRow[];
  },
  async blogPosts(): Promise<PickItem[]> {
    const { data } = await supabase.from('blog_posts').select('slug, title, status').order('created_at', { ascending: false }).limit(200);
    return (data || []).map((r: any) => ({ id: r.slug, title: r.title, thumbnail: null, isPublished: r.status === 'published' }));
  },
  async save(b: BannerRow): Promise<void> {
    const row = { ...b, updated_at: new Date().toISOString() };
    const { error } = b.id ? await supabase.from('banners').update(row).eq('id', b.id) : await supabase.from('banners').insert(row);
    if (error) throw new Error(friendlyDbError(error.message));
  },
  async remove(id: string) {
    const { error } = await supabase.from('banners').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
  async reorder(ids: string[]) {
    for (let i = 0; i < ids.length; i++) {
      const { error } = await supabase.from('banners').update({ position: i }).eq('id', ids[i]);
      if (error) throw new Error(error.message);
    }
  },
};

/* ------------------------------------------------------------------ offers */
export type OfferType = 'special' | 'limited_time' | 'festival' | 'bundle_discount' | 'course_discount' | 'campaign';
export interface OfferRow {
  id?: string;
  title: string;
  description: string | null;
  discount_text: string | null;
  offer_type: OfferType;
  image_url: string | null;
  link_type: Exclude<LinkType, 'offer'>;
  course_id: string | null;
  bundle_id: string | null;
  link_url: string | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
}

export const offerAdmin = {
  async list(): Promise<OfferRow[]> {
    const { data, error } = await supabase.from('offers').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data as OfferRow[];
  },
  async save(o: OfferRow): Promise<OfferRow> {
    const row = { ...o, updated_at: new Date().toISOString() };
    const q = o.id ? supabase.from('offers').update(row).eq('id', o.id) : supabase.from('offers').insert(row);
    const { data, error } = await q.select('*').single();
    if (error) throw new Error(friendlyDbError(error.message));
    return data as OfferRow;
  },
  async remove(id: string) {
    const { error } = await supabase.from('offers').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

function friendlyDbError(msg: string): string {
  if (/_dates/.test(msg)) return 'The end date must be after the start date.';
  if (/_link/.test(msg)) return 'Choose the destination for the selected link type.';
  if (/image_url_check/.test(msg)) return 'The image must be an https:// link.';
  if (/link_url_check/.test(msg)) return 'The link must start with https://';
  if (/mobile_image_url_check/.test(msg)) return 'The mobile image must be an https:// link.';
  if (/cta_text_check/.test(msg)) return 'The button text must be 1–40 characters.';
  if (/blog_slug_check/.test(msg)) return 'Choose a blog post.';
  if (/row-level security/i.test(msg)) return 'Only administrators can do this.';
  return msg;
}

/* ------------------------------------------------------------------ helpers */
export const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
export const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
