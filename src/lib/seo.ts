import { useEffect } from 'react';

/** Site name used in page titles ("Course | Edufy Academy"); kept in sync with Admin → Settings → General. */
let siteName = 'Edufy Academy';
export const setSiteName = (name: string) => {
  siteName = name || 'Edufy Academy';
};

/** Sets the page title and social/SEO meta tags for the current route (restored on unmount). */
export function useDocumentMeta(meta: { title?: string; description?: string; image?: string | null; type?: 'website' | 'article'; canonicalPath?: string } | null) {
  useEffect(() => {
    if (!meta) return;
    const prevTitle = document.title;
    const touched: { el: HTMLMetaElement | HTMLLinkElement; prev: string | null; created: boolean; attr: string }[] = [];
    const set = (selector: string, create: () => HTMLMetaElement | HTMLLinkElement, attr: string, value?: string | null) => {
      if (!value) return;
      let el = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
      const created = !el;
      if (!el) {
        el = create();
        document.head.appendChild(el);
      }
      touched.push({ el, prev: el.getAttribute(attr), created, attr });
      el.setAttribute(attr, value);
    };
    const metaTag = (key: 'name' | 'property', name: string) => () => {
      const m = document.createElement('meta');
      m.setAttribute(key, name);
      return m;
    };
    if (meta.title) document.title = `${meta.title} | ${siteName}`;
    const desc = meta.description?.slice(0, 170);
    set('meta[name="description"]', metaTag('name', 'description'), 'content', desc);
    set('meta[property="og:title"]', metaTag('property', 'og:title'), 'content', meta.title);
    set('meta[property="og:description"]', metaTag('property', 'og:description'), 'content', desc);
    set('meta[property="og:type"]', metaTag('property', 'og:type'), 'content', meta.type || 'website');
    set('meta[property="og:image"]', metaTag('property', 'og:image'), 'content', meta.image || undefined);
    if (meta.canonicalPath) {
      set('link[rel="canonical"]', () => {
        const l = document.createElement('link');
        l.setAttribute('rel', 'canonical');
        return l;
      }, 'href', `${window.location.origin}${meta.canonicalPath}`);
    }
    return () => {
      document.title = prevTitle;
      for (const t of touched) {
        if (t.created) t.el.remove();
        else if (t.prev !== null) t.el.setAttribute(t.attr, t.prev);
      }
    };
  }, [meta?.title, meta?.description, meta?.image, meta?.type, meta?.canonicalPath]);
}
