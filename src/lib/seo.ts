import { useEffect } from 'react';
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL, absoluteUrl } from '../seo/seoConfig';

/**
 * Browser side of the SEO setup. The first page a visitor (or crawler) opens already carries its own title,
 * description, canonical URL, Open Graph / Twitter tags and JSON-LD from the build-time prerender
 * (scripts/seo/prerender.ts). These helpers keep the same tags correct while the visitor moves around the
 * single-page app, using the same text (src/seo/seoConfig.ts).
 */

/** Site name used in page titles ("Course | Edufy Academy"); kept in sync with Admin → Settings → General. */
let siteName = SITE_NAME;
export const setSiteName = (name: string) => {
  siteName = name || SITE_NAME;
};

/** Robots value for indexable pages (Admin → Settings → SEO can switch the whole site to noindex). */
let defaultRobots = 'index, follow, max-image-preview:large';
export const setDefaultRobots = (value: string) => {
  defaultRobots = value;
};

export interface HeadTags {
  /** Full page title (already including the brand when wanted). */
  title?: string;
  description?: string | null;
  /** Path like "/courses/abc"; omitted → no canonical (private and error pages). */
  canonicalPath?: string | null;
  image?: string | null;
  type?: 'website' | 'article';
  robots?: string;
  /** JSON-LD nodes; [] removes structured data, undefined leaves it unchanged. */
  ld?: Record<string, unknown>[];
}

function setTag(selector: string, create: () => HTMLElement, attr: string, value: string | null | undefined) {
  let el = document.head.querySelector(selector) as HTMLElement | null;
  if (!value) {
    el?.remove();
    return;
  }
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
  // From now on the page owns this tag: site-wide defaults (SettingsContext) must not overwrite it
  delete el.dataset.edufySettings;
}

const metaEl = (key: 'name' | 'property', name: string) => () => {
  const m = document.createElement('meta');
  m.setAttribute(key, name);
  return m;
};

/** Writes the page's head tags (one canonical, one robots tag, one JSON-LD block — never duplicates). */
export function applyHead(t: HeadTags) {
  if (typeof document === 'undefined') return;
  if (t.title) document.title = t.title;
  const url = t.canonicalPath ? `${SITE_URL}${t.canonicalPath === '/' ? '/' : t.canonicalPath}` : null;
  const desc = t.description ? t.description.replace(/\s+/g, ' ').trim().slice(0, 300) : null;
  const image = absoluteUrl(t.image) || DEFAULT_OG_IMAGE;
  setTag('meta[name="description"]', metaEl('name', 'description'), 'content', desc);
  // Pages with a canonical URL are indexable unless they say otherwise; error pages pass "noindex"
  const robots = t.robots ?? (t.canonicalPath ? defaultRobots : undefined);
  if (robots) setTag('meta[name="robots"]', metaEl('name', 'robots'), 'content', robots);
  setTag('link[rel="canonical"]', () => {
    const l = document.createElement('link');
    l.setAttribute('rel', 'canonical');
    return l;
  }, 'href', url);
  setTag('meta[property="og:title"]', metaEl('property', 'og:title'), 'content', t.title || null);
  setTag('meta[property="og:description"]', metaEl('property', 'og:description'), 'content', desc);
  setTag('meta[property="og:type"]', metaEl('property', 'og:type'), 'content', t.type || 'website');
  setTag('meta[property="og:url"]', metaEl('property', 'og:url'), 'content', url);
  setTag('meta[property="og:image"]', metaEl('property', 'og:image'), 'content', image);
  setTag('meta[name="twitter:card"]', metaEl('name', 'twitter:card'), 'content', 'summary_large_image');
  setTag('meta[name="twitter:title"]', metaEl('name', 'twitter:title'), 'content', t.title || null);
  setTag('meta[name="twitter:description"]', metaEl('name', 'twitter:description'), 'content', desc);
  setTag('meta[name="twitter:image"]', metaEl('name', 'twitter:image'), 'content', image);
  if (t.ld) {
    let s = document.head.querySelector('script[data-seo="ld"]') as HTMLScriptElement | null;
    if (!t.ld.length) s?.remove();
    else {
      if (!s) {
        s = document.createElement('script');
        s.type = 'application/ld+json';
        s.dataset.seo = 'ld';
        document.head.appendChild(s);
      }
      s.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': t.ld });
    }
  }
}

/** Applies head tags for the current page whenever they change (pass null while data is loading). */
export function useSeo(tags: HeadTags | null) {
  const key = tags ? JSON.stringify(tags) : '';
  useEffect(() => {
    if (tags) applyHead(tags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Older API kept for the blog pages: title gets " | site name". */
export function useDocumentMeta(meta: { title?: string; description?: string; image?: string | null; type?: 'website' | 'article'; canonicalPath?: string } | null) {
  useSeo(
    meta
      ? {
          title: meta.title ? (meta.title.includes(siteName) ? meta.title : `${meta.title} | ${siteName}`) : undefined,
          description: meta.description,
          image: meta.image,
          type: meta.type,
          canonicalPath: meta.canonicalPath,
        }
      : null
  );
}
