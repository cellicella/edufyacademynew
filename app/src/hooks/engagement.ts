import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { fetchBanners, fetchInbox, fetchOffer, fetchOffers, fetchPrefs, fetchUnreadCount } from '@/services/inbox';
import { prefs } from '@/lib/secureStorage';
import { isLive, pushRecent } from '@/logic/engagement';
import { fetchPost, fetchPosts } from '@/services/blog';

export const ek = {
  inbox: (uid?: string) => ['inbox', uid] as const,
  unread: (uid?: string) => ['inbox-unread', uid] as const,
  prefs: (uid?: string) => ['notification-prefs', uid] as const,
  banners: ['banners'] as const,
  offers: ['offers'] as const,
  offer: (id: string) => ['offer', id] as const,
};

export function useInbox() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({ queryKey: ek.inbox(uid), queryFn: ({ signal }) => fetchInbox(uid!, signal), enabled: !!uid, staleTime: 15_000 });
}

export function useUnreadCount() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({ queryKey: ek.unread(uid), queryFn: () => fetchUnreadCount(uid!), enabled: !!uid, staleTime: 15_000, refetchInterval: 120_000 });
}

export function useNotificationPrefs() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({ queryKey: ek.prefs(uid), queryFn: () => fetchPrefs(uid!), enabled: !!uid });
}

/** Active home banners (the database only returns live ones; expired cached items are filtered too). */
export function useBanners() {
  const q = useQuery({ queryKey: ek.banners, queryFn: ({ signal }) => fetchBanners(signal), staleTime: 5 * 60_000 });
  return { ...q, data: (q.data || []).filter((b) => isLive(b)) };
}

export function useOffers() {
  const q = useQuery({ queryKey: ek.offers, queryFn: ({ signal }) => fetchOffers(signal), staleTime: 2 * 60_000 });
  return { ...q, data: (q.data || []).filter((o) => isLive(o)) };
}

export function useOffer(id: string | undefined) {
  return useQuery({ queryKey: ek.offer(id || ''), queryFn: ({ signal }) => fetchOffer(id!, signal), enabled: !!id });
}

/** Courses this student opened recently (kept on this device, per account; shared via the query cache). */
export function useRecentlyViewed() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const uid = session?.user.id;
  const key = uid ? `recent_${uid}` : null;
  const q = useQuery({
    queryKey: ['recently-viewed', uid],
    enabled: !!key,
    staleTime: Infinity,
    queryFn: async () => parseIds(await prefs.get(key!)),
  });

  const add = useCallback(
    async (courseId: string) => {
      if (!key) return;
      const next = pushRecent(parseIds(await prefs.get(key)), courseId);
      qc.setQueryData(['recently-viewed', uid], next);
      await prefs.set(key, JSON.stringify(next)).catch(() => undefined);
    },
    [key, uid, qc]
  );

  return { ids: q.data || [], add };
}

function parseIds(raw: string | null): string[] {
  try {
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ blog */
export function useBlogPosts() {
  return useQuery({ queryKey: ['blog'], queryFn: ({ signal }) => fetchPosts(signal), staleTime: 5 * 60_000 });
}

export function useBlogPost(slug: string | undefined) {
  return useQuery({ queryKey: ['blog-post', slug], queryFn: ({ signal }) => fetchPost(slug!, signal), enabled: !!slug });
}
