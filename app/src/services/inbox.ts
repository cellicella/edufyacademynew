import { supabase } from '@/lib/supabase';
import { Banner, InboxItem, Offer, mapBanner, mapInbox, mapOffer } from '@/logic/engagement';

/* Notification centre (user_notifications — RLS: a student only sees and changes their own rows). */

const INBOX_COLUMNS = 'id, title, body, image_url, action_url, category, course_id, bundle_id, offer_id, read_at, created_at, push_notification_id';

export async function fetchInbox(userId: string, signal?: AbortSignal): Promise<InboxItem[]> {
  let q = supabase.from('user_notifications').select(INBOX_COLUMNS).eq('user_id', userId).order('created_at', { ascending: false }).limit(150);
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(mapInbox);
}

export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase.from('user_notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null);
  if (error) throw new Error(error.message);
  return count || 0;
}

export async function markRead(ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).in('id', ids).is('read_at', null);
  if (error) throw new Error(error.message);
}

export async function markAllRead(userId: string) {
  const { error } = await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
  if (error) throw new Error(error.message);
}

/** Mark the inbox record that belongs to a tapped push as read. */
export async function markPushRead(userId: string, data: Record<string, unknown>) {
  const key = typeof data.notificationId === 'string' ? `push:${data.notificationId}` : null;
  const id = typeof data.inboxId === 'string' ? data.inboxId : null;
  if (id) return markRead([id]);
  if (!key) return;
  await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).eq('dedupe_key', key).is('read_at', null);
}

export async function deleteNotification(id: string) {
  const { error } = await supabase.from('user_notifications').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function clearAll(userId: string) {
  const { error } = await supabase.from('user_notifications').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/** Live updates for the unread badge. Returns an unsubscribe function. */
export function subscribeInbox(userId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`inbox-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` }, () => onChange())
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/* ------------------------------------------------------------------ preferences */
export interface NotificationPrefs {
  promotions: boolean;
  new_courses: boolean;
  bundles_offers: boolean;
  announcements: boolean;
  learning_updates: boolean;
}
export const DEFAULT_PREFS: NotificationPrefs = { promotions: true, new_courses: true, bundles_offers: true, announcements: true, learning_updates: true };

export async function fetchPrefs(userId: string): Promise<NotificationPrefs> {
  const { data, error } = await supabase.from('notification_preferences').select('promotions, new_courses, bundles_offers, announcements, learning_updates').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return { ...DEFAULT_PREFS, ...(data || {}) };
}

export async function savePrefs(userId: string, p: NotificationPrefs) {
  const { error } = await supabase.from('notification_preferences').upsert({ user_id: userId, ...p, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------------ banners & offers (public, live only) */
const BANNER_BASE = 'id, title, description, image_url, link_type, course_id, bundle_id, offer_id, link_url, starts_at, ends_at, position';

/** App home banners: placement "app" or "both" (Settings → Mobile App Banners). */
export async function fetchBanners(signal?: AbortSignal): Promise<Banner[]> {
  let q = supabase.from('banners').select(`${BANNER_BASE}, subtitle, cta_text, blog_slug, placement`).in('placement', ['app', 'both']).order('position').limit(10);
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  if (error) {
    // Database without the settings migration: no placement column yet, every banner is an app banner
    if (/placement|subtitle|cta_text|blog_slug/.test(error.message)) {
      let q2 = supabase.from('banners').select(BANNER_BASE).order('position').limit(10);
      if (signal) q2 = q2.abortSignal(signal);
      const r = await q2;
      if (r.error) throw new Error(r.error.message);
      return (r.data || []).map(mapBanner);
    }
    throw new Error(error.message);
  }
  return (data || []).map(mapBanner);
}

const OFFER_COLUMNS = 'id, title, description, discount_text, offer_type, image_url, link_type, course_id, bundle_id, link_url, starts_at, ends_at, is_active';

export async function fetchOffers(signal?: AbortSignal): Promise<Offer[]> {
  let q = supabase.from('offers').select(OFFER_COLUMNS).order('ends_at', { ascending: true, nullsFirst: false }).limit(20);
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(mapOffer);
}

/** A single offer (null when it doesn't exist or is no longer live — RLS hides those). */
export async function fetchOffer(id: string, signal?: AbortSignal): Promise<Offer | null> {
  let q = supabase.from('offers').select(OFFER_COLUMNS).eq('id', id);
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapOffer(data) : null;
}
