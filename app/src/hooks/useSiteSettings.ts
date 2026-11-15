import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cachedSiteSettings, fetchSiteSettings } from '@/services/siteSettings';
import { AppSiteSettings, DEFAULT_APP_SETTINGS } from '@/logic/siteSettings';

export const SITE_SETTINGS_KEY = ['site-settings'] as const;

/**
 * Public site settings (Admin → Settings & Configuration). Starts from the copy cached on the phone, refreshes
 * from the server every 5 minutes and whenever the app returns to the foreground. Always returns usable values.
 */
export function useSiteSettings(): AppSiteSettings & { isFetched: boolean } {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: SITE_SETTINGS_KEY,
    queryFn: ({ signal }) => fetchSiteSettings(signal),
    staleTime: 5 * 60_000,
    gcTime: Infinity,
    refetchOnWindowFocus: true,
    refetchInterval: 15 * 60_000,
  });
  // Seed from the on-device cache so the first screen already shows the last known settings
  useEffect(() => {
    if (q.data) return;
    let alive = true;
    cachedSiteSettings().then((c) => {
      if (alive && c && !qc.getQueryData(SITE_SETTINGS_KEY)) qc.setQueryData(SITE_SETTINGS_KEY, c, { updatedAt: 0 });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { ...(q.data || DEFAULT_APP_SETTINGS), isFetched: q.isFetched };
}
