import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../services/api';
import { readJson } from '../lib/http';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEFAULT_SETTINGS, PublicSettings, isHttps, mergeSettings } from '../config/siteSettings';
import { setSiteName } from '../lib/seo';
import { setConfiguredSiteUrl } from '../lib/siteUrl';

/**
 * Public site settings for the whole website.
 * Source of truth: GET /api/settings/public (falls back to the get_public_settings() database function
 * when the API isn't reachable). The last copy is kept in localStorage so pages render instantly with the
 * latest known values; it refreshes in the background, on window focus and every 5 minutes.
 */
interface Ctx {
  settings: PublicSettings;
  loaded: boolean;
  source: 'default' | 'cache' | 'api' | 'database';
  refresh: () => Promise<void>;
}

const CACHE_KEY = 'edufy.publicSettings.v1';
const REFRESH_MS = 5 * 60_000;

const SettingsContext = createContext<Ctx>({ settings: DEFAULT_SETTINGS, loaded: false, source: 'default', refresh: async () => undefined });

function readCache(): PublicSettings | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? mergeSettings(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
function writeCache(raw: unknown) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(raw));
  } catch {
    /* storage unavailable (private mode) */
  }
}

async function fetchPublic(): Promise<{ raw: unknown; source: 'api' | 'database' }> {
  try {
    const res = await fetch(`${API_BASE_URL}/settings/public`, { headers: { accept: 'application/json' }, cache: 'no-cache' });
    if (res.ok) {
      const body = await readJson<{ settings: unknown }>(res);
      if (body?.settings) return { raw: body.settings, source: 'api' };
    }
  } catch {
    /* API unreachable → database fallback */
  }
  if (!isSupabaseConfigured) throw new Error('Settings unavailable');
  const { data, error } = await supabase.rpc('get_public_settings');
  if (error) throw new Error(error.message);
  return { raw: (data as any)?.settings || {}, source: 'database' };
}

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cached = useRef(typeof window !== 'undefined' ? readCache() : null);
  const [settings, setSettings] = useState<PublicSettings>(cached.current || DEFAULT_SETTINGS);
  const [source, setSource] = useState<Ctx['source']>(cached.current ? 'cache' : 'default');
  const [loaded, setLoaded] = useState(false);
  const inflight = useRef<Promise<void> | null>(null);
  const lastTitle = useRef('Edufy Academy');

  const refresh = useCallback(async () => {
    if (inflight.current) return inflight.current;
    inflight.current = (async () => {
      try {
        const { raw, source: src } = await fetchPublic();
        setSettings(mergeSettings(raw));
        setSource(src);
        writeCache(raw);
      } catch {
        /* keep cached/default values */
      } finally {
        setLoaded(true);
        inflight.current = null;
      }
    })();
    return inflight.current;
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    const onFocus = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh]);

  // Site-wide head tags: default title/description, favicon, Search Console, Google Analytics
  useEffect(() => {
    setConfiguredSiteUrl(settings.domain?.siteUrl);
    setSiteName(settings.general.siteName || 'Edufy Academy');
    const head = document.head;
    const meta = (name: string, content: string, attr: 'name' | 'property' = 'name') => {
      if (!content) return;
      let el = head.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        el.dataset.edufySettings = '1';
        head.appendChild(el);
      }
      // Pages set their own description/og tags; only fill site-wide defaults when untouched
      if (el.dataset.edufySettings === '1' || !el.getAttribute('content')) {
        el.setAttribute('content', content);
        el.dataset.edufySettings = '1';
      }
    };
    const siteTitle = settings.seo.title || settings.general.siteName;
    if (!document.title || document.title === 'Edufy Academy' || document.title === lastTitle.current) document.title = siteTitle;
    lastTitle.current = siteTitle;
    meta('keywords', settings.seo.keywords);
    meta('robots', settings.seo.robots);
    if (/^[A-Za-z0-9_-]{10,100}$/.test(settings.seo.gscVerification)) meta('google-site-verification', settings.seo.gscVerification);
    if (isHttps(settings.seo.ogImage)) meta('og:image', settings.seo.ogImage, 'property');
    if (isHttps(settings.branding.favicon)) {
      head.querySelectorAll('link[rel="icon"]').forEach((l) => l.setAttribute('href', settings.branding.favicon));
    }
    const ga = settings.seo.gaId;
    if (ga && /^(G-[A-Z0-9]{4,15}|UA-\d{4,10}-\d{1,4})$/.test(ga) && !head.querySelector('script[data-edufy-ga]')) {
      const s1 = document.createElement('script');
      s1.async = true;
      s1.src = `https://www.googletagmanager.com/gtag/js?id=${ga}`;
      s1.dataset.edufyGa = '1';
      head.appendChild(s1);
      const w = window as any;
      w.dataLayer = w.dataLayer || [];
      w.gtag = function gtag() {
        // eslint-disable-next-line prefer-rest-params
        w.dataLayer.push(arguments);
      };
      w.gtag('js', new Date());
      w.gtag('config', ga);
    }
  }, [settings]);

  const value = useMemo(() => ({ settings, loaded, source, refresh }), [settings, loaded, source, refresh]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSiteSettings = () => useContext(SettingsContext);
