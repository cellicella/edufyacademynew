import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { isHttps } from '../../config/siteSettings';
import { cdnImage, cdnSrcSet } from '../../lib/cdnImage';

interface WebBanner {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  mobile_image_url: string | null;
  cta_text: string | null;
  link_type: string;
  course_id: string | null;
  bundle_id: string | null;
  blog_slug: string | null;
  link_url: string | null;
}

const CACHE_KEY = 'edufy.webBanners.v1';

function target(b: WebBanner): { internal?: string; external?: string } | null {
  switch (b.link_type) {
    case 'course': return b.course_id ? { internal: `/courses/${b.course_id}` } : null;
    case 'bundle': return b.bundle_id ? { internal: `/bundles/${b.bundle_id}` } : null;
    case 'blog': return b.blog_slug ? { internal: `/blog/${b.blog_slug}` } : null;
    case 'url': return isHttps(b.link_url) ? { external: b.link_url! } : null;
    default: return null;
  }
}

/**
 * Homepage banner slider (Settings → Website banners). Only live banners are returned by the database
 * (enabled and inside their schedule). Renders nothing when there are none, so the page looks as before.
 */
export const WebsiteBanners: React.FC = () => {
  const [items, setItems] = useState<WebBanner[]>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(CACHE_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    supabase
      .from('banners')
      .select('id, title, subtitle, description, image_url, mobile_image_url, cta_text, link_type, course_id, bundle_id, blog_slug, link_url, position')
      .in('placement', ['website', 'both'])
      .order('position')
      .limit(8)
      .then(({ data, error }) => {
        if (!alive || error) return; // keep the cached copy on errors (e.g. migration not run yet)
        const live = ((data || []) as WebBanner[]).filter((b) => isHttps(b.image_url));
        setItems(live);
        try {
          window.localStorage.setItem(CACHE_KEY, JSON.stringify(live));
        } catch {
          /* ignore */
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (items.length < 2 || paused) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % items.length), 6000);
    return () => window.clearInterval(t);
  }, [items.length, paused]);

  if (!items.length) return null;
  const idx = i % items.length;

  return (
    <section className="max-w-[1280px] mx-auto px-5 sm:px-8 pt-6" aria-roledescription="carousel" aria-label="Featured" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="relative overflow-hidden rounded-[28px] bg-[#0B1220] aspect-[4/5] sm:aspect-[16/7] lg:aspect-[16/5]">
        {items.map((b, n) => {
          const t = target(b);
          const cta = b.cta_text || (t ? 'Learn more' : '');
          const body = (
            <>
              <picture>
                {isHttps(b.mobile_image_url) && <source media="(max-width: 639px)" srcSet={b.mobile_image_url!} />}
                <img src={cdnImage(b.image_url!, 1920)} srcSet={cdnSrcSet(b.image_url, [640, 960, 1280, 1920])} sizes="100vw" alt="" className="absolute inset-0 w-full h-full object-cover" loading={n === 0 ? 'eager' : 'lazy'} />
              </picture>
              <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-[#0B1220]/85 via-[#0B1220]/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 sm:inset-y-0 sm:right-auto sm:max-w-[60%] p-6 sm:p-10 lg:p-14 flex flex-col justify-end sm:justify-center text-white text-left">
                {b.subtitle && <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/80">{b.subtitle}</span>}
                <h2 className="mt-2 font-display text-[1.75rem] sm:text-[2.25rem] lg:text-[2.75rem] font-extrabold leading-[1.1]">{b.title}</h2>
                {b.description && <p className="mt-3 text-[16px] text-white/85 max-w-xl line-clamp-3">{b.description}</p>}
                {cta && <span className="mt-5 inline-flex items-center gap-2 self-start ed-btn bg-white text-[#111827] ed-btn-sm">{cta} <ArrowRight className="w-4 h-4" /></span>}
              </div>
            </>
          );
          const cls = `absolute inset-0 transition-opacity duration-700 ${n === idx ? 'opacity-100' : 'opacity-0 pointer-events-none'}`;
          return t?.internal ? (
            <Link key={b.id} to={t.internal} className={cls} aria-hidden={n !== idx} tabIndex={n === idx ? 0 : -1}>{body}</Link>
          ) : t?.external ? (
            <a key={b.id} href={t.external} target="_blank" rel="noopener noreferrer" className={cls} aria-hidden={n !== idx} tabIndex={n === idx ? 0 : -1}>{body}</a>
          ) : (
            <div key={b.id} className={cls} aria-hidden={n !== idx}>{body}</div>
          );
        })}
        {items.length > 1 && (
          <>
            <button onClick={() => setI((idx - 1 + items.length) % items.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/85 hover:bg-white flex items-center justify-center" aria-label="Previous banner"><ChevronLeft className="w-5 h-5" /></button>
            <button onClick={() => setI((idx + 1) % items.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/85 hover:bg-white flex items-center justify-center" aria-label="Next banner"><ChevronRight className="w-5 h-5" /></button>
            <div className="absolute bottom-4 right-5 flex gap-1.5">
              {items.map((b, n) => (
                <button key={b.id} onClick={() => setI(n)} className={`h-2 rounded-full transition-all ${n === idx ? 'w-6 bg-white' : 'w-2 bg-white/50'}`} aria-label={`Show banner ${n + 1}`} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};
