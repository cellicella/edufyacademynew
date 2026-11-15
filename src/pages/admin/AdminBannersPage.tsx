import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, ArrowUp, ArrowDown, Image as ImageIcon, Eye, EyeOff, Monitor, Smartphone } from 'lucide-react';
import { AdminPageHeader, EmptyState, ErrorBanner } from '../../components/admin/AdminUI';
import { BannerRow, LinkType, PickItem, bannerAdmin, fmtDateTime, fromLocalInput, loadPickers, toLocalInput } from '../../services/pushAdmin';
import { ImageField } from '../../components/admin/MediaLibrary';
import { useCartWishlist } from '../../context/CartWishlistContext';

const empty = (position: number, placement: 'app' | 'website'): BannerRow => ({
  title: '', subtitle: '', description: '', image_url: '', mobile_image_url: '', cta_text: '', link_type: 'none', course_id: null, bundle_id: null, offer_id: null,
  blog_slug: null, link_url: null, starts_at: null, ends_at: null, is_active: true, position, placement,
});

export const bannerState = (b: BannerRow): { label: string; cls: string } => {
  const now = Date.now();
  if (!b.is_active) return { label: 'Disabled', cls: 'bg-[#F1F5F9] text-[#475569]' };
  if (b.starts_at && new Date(b.starts_at).getTime() > now) return { label: 'Starts later', cls: 'bg-[#E8EFFB] text-[#004AAD]' };
  if (b.ends_at && new Date(b.ends_at).getTime() <= now) return { label: 'Ended', cls: 'bg-amber-50 text-amber-700' };
  return { label: 'Live', cls: 'bg-emerald-50 text-emerald-700' };
};

/** Desktop + phone preview matching the website homepage slider. */
const WebsitePreview: React.FC<{ b: BannerRow }> = ({ b }) => (
  <div className="space-y-4">
    <div>
      <div className="text-[12px] font-semibold text-[#64748B] mb-1 flex items-center gap-1"><Monitor className="w-3.5 h-3.5" /> Desktop</div>
      <div className="w-full aspect-[16/5] rounded-[16px] overflow-hidden relative bg-[#0B1220]">
        {b.image_url && <img src={b.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B1220]/85 via-[#0B1220]/35 to-transparent" />
        <div className="absolute inset-y-0 left-0 max-w-[65%] p-4 flex flex-col justify-center text-white">
          {b.subtitle && <div className="text-[9px] font-bold uppercase tracking-wider text-white/80">{b.subtitle}</div>}
          <div className="font-display text-[15px] font-extrabold leading-tight line-clamp-2">{b.title || 'Banner title'}</div>
          {(b.cta_text || b.link_type !== 'none') && <span className="mt-2 self-start px-2.5 h-6 leading-6 rounded-full bg-white text-[#111827] text-[10px] font-bold">{b.cta_text || 'Learn more'} →</span>}
        </div>
      </div>
    </div>
    <div>
      <div className="text-[12px] font-semibold text-[#64748B] mb-1 flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /> Mobile browser</div>
      <div className="w-40 aspect-[4/5] rounded-[16px] overflow-hidden relative bg-[#0B1220]">
        {(b.mobile_image_url || b.image_url) && <img src={(b.mobile_image_url || b.image_url)!} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1220]/85 to-transparent" />
        <div className="absolute bottom-0 p-3 text-white font-display text-[12px] font-extrabold leading-tight">{b.title || 'Banner title'}</div>
      </div>
    </div>
  </div>
);

/** Phone-sized preview matching the app's home slider. */
const BannerPreview: React.FC<{ b: BannerRow }> = ({ b }) => (
  <div className="w-full max-w-[360px] aspect-[16/9] rounded-[22px] overflow-hidden relative bg-gradient-to-br from-[#004AAD] to-[#5E17EB] shadow-lg">
    {b.image_url && <img src={b.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
    <div className="absolute inset-0 bg-gradient-to-t from-[#0B1220]/85 via-[#0B1220]/25 to-transparent" />
    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
      <div className="font-display text-[19px] font-extrabold leading-tight line-clamp-2">{b.title || 'Banner title'}</div>
      {b.description && <div className="text-[13px] text-white/85 mt-1 line-clamp-2">{b.description}</div>}
      {b.link_type !== 'none' && <span className="inline-block mt-2 px-3 h-7 leading-7 rounded-full bg-white text-[#004AAD] text-[12.5px] font-bold">{b.cta_text || 'Explore'} →</span>}
    </div>
  </div>
);

export const AdminBannersPage: React.FC<{ placement?: 'app' | 'website' }> = ({ placement = 'app' }) => {
  const { showToast } = useCartWishlist();
  const isWeb = placement === 'website';
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [pickers, setPickers] = useState<{ courses: PickItem[]; bundles: PickItem[]; offers: PickItem[]; posts: PickItem[] }>({ courses: [], bundles: [], offers: [], posts: [] });
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BannerRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setBanners(await bannerAdmin.list(placement));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
    Promise.all([loadPickers(), bannerAdmin.blogPosts()]).then(([p, posts]) => setPickers({ ...p, posts })).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placement]);

  const setLink = (t: LinkType) => form && setForm({ ...form, link_type: t, course_id: t === 'course' ? form.course_id : null, bundle_id: t === 'bundle' ? form.bundle_id : null, offer_id: t === 'offer' ? form.offer_id : null, blog_slug: t === 'blog' ? form.blog_slug : null, link_url: t === 'url' ? form.link_url : null });

  const save = async () => {
    if (!form) return;
    if (!form.title.trim()) return showToast('Give the banner a title', 'warning');
    if (form.image_url && !/^https:\/\/\S+$/.test(form.image_url)) return showToast('The image must be an https:// link', 'warning');
    if (form.link_type === 'url' && !/^https:\/\/\S+$/.test(form.link_url || '')) return showToast('The link must start with https://', 'warning');
    if (form.link_type === 'course' && !form.course_id) return showToast('Choose a course', 'warning');
    if (form.link_type === 'bundle' && !form.bundle_id) return showToast('Choose a bundle', 'warning');
    if (form.link_type === 'offer' && !form.offer_id) return showToast('Choose an offer', 'warning');
    if (form.link_type === 'blog' && !form.blog_slug) return showToast('Choose a blog post', 'warning');
    if (isWeb && !form.image_url) return showToast('Website banners need an image', 'warning');
    if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) return showToast('The end date must be after the start date', 'warning');
    setSaving(true);
    try {
      const extra = form.placement || isWeb ? {
        placement: form.placement || placement, subtitle: form.subtitle?.trim() || null, cta_text: form.cta_text?.trim() || null,
        mobile_image_url: form.mobile_image_url?.trim() || null, blog_slug: form.link_type === 'blog' ? form.blog_slug : null,
      } : {};
      await bannerAdmin.save({ ...form, ...extra, title: form.title.trim(), description: form.description?.trim() || null, image_url: form.image_url?.trim() || null });
      showToast('Banner saved', 'success');
      setForm(null);
      await load();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= banners.length) return;
    const ids = banners.map((b) => b.id!);
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    try {
      await bannerAdmin.reorder(ids);
      await load();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const toggle = async (b: BannerRow) => {
    try {
      await bannerAdmin.save({ ...b, is_active: !b.is_active });
      await load();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const target = (b: BannerRow) => {
    const name = (list: PickItem[], id: string | null) => list.find((x) => x.id === id)?.title || '—';
    switch (b.link_type) {
      case 'course': return `Course: ${name(pickers.courses, b.course_id)}`;
      case 'bundle': return `Bundle: ${name(pickers.bundles, b.bundle_id)}`;
      case 'offer': return `Offer: ${name(pickers.offers, b.offer_id)}`;
      case 'blog': return `Blog: ${name(pickers.posts, b.blog_slug || null)}`;
      case 'url': return b.link_url;
      default: return 'No link';
    }
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow={isWeb ? 'Website' : 'Mobile app'}
        title={isWeb ? 'Website banners' : 'App home banners'}
        description={isWeb
          ? 'Banners rotate at the top of the website homepage (desktop image + optional mobile image). Only enabled banners inside their date window are shown; with none live, the homepage looks as before.'
          : 'Banners rotate at the top of the student app’s home screen. Only enabled banners inside their date window are shown.'}
        actions={<button onClick={() => setForm(empty(banners.length, placement))} className="ed-btn ed-btn-filled ed-btn-sm"><Plus className="w-4 h-4" /> New banner</button>}
      />
      {error && <ErrorBanner message={error} />}

      <section className="bg-white rounded-[20px] border border-[#E2E8F0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <thead className="bg-[#F7F9FC] text-[13px] uppercase tracking-wide text-[#64748B]">
              <tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Banner</th><th className="px-5 py-3">Opens</th><th className="px-5 py-3">Schedule</th><th className="px-5 py-3">Status</th><th className="px-5 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F7]">
              {banners.map((b, i) => {
                const st = bannerState(b);
                return (
                  <tr key={b.id}>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <button onClick={() => move(i, -1)} className="p-1 hover:bg-[#F1F5F9] rounded" aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
                      <button onClick={() => move(i, 1)} className="p-1 hover:bg-[#F1F5F9] rounded" aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-20 aspect-video rounded-lg overflow-hidden bg-[#E8EFFB] shrink-0 flex items-center justify-center">{b.image_url ? <img src={b.image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-[#94A3B8]" />}</div>
                        <div className="min-w-0"><div className="font-semibold text-[#111827] truncate max-w-[260px]">{b.title}{b.placement === 'both' && <span className="ml-2 px-1.5 rounded bg-[#E8EFFB] text-[#004AAD] text-[11px] font-bold align-middle">WEB + APP</span>}</div><div className="text-[13px] text-[#64748B] truncate max-w-[260px]">{b.description}</div></div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[14px] text-[#334155] max-w-[220px] truncate">{target(b)}</td>
                    <td className="px-5 py-3 text-[13px] text-[#334155] whitespace-nowrap">{b.starts_at ? fmtDateTime(b.starts_at) : 'Now'} → {b.ends_at ? fmtDateTime(b.ends_at) : 'No end'}</td>
                    <td className="px-5 py-3"><span className={`px-2.5 h-7 inline-flex items-center rounded-full text-[13px] font-semibold ${st.cls}`}>{st.label}</span></td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button onClick={() => toggle(b)} className="ed-btn ed-btn-text ed-btn-sm" title={b.is_active ? 'Disable' : 'Enable'}>{b.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                      <button onClick={() => setForm({ ...b })} className="ed-btn ed-btn-text ed-btn-sm" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => window.confirm(`Delete banner “${b.title}”?`) && bannerAdmin.remove(b.id!).then(load).catch((e) => showToast(e.message, 'error'))} className="ed-btn ed-btn-text ed-btn-sm !text-rose-600" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {banners.length === 0 && <EmptyState title="No banners yet" body={isWeb ? 'The homepage shows its normal hero until you add a banner.' : 'Until you add banners, the app shows featured courses in the slider.'} />}
        </div>
      </section>

      {form && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Banner editor">
          <div className="fixed inset-0 bg-[#111827]/40" onClick={() => setForm(null)} />
          <div className="relative w-full max-w-4xl bg-white rounded-[28px] shadow-2xl my-8 edufy-pop">
            <div className="flex items-center justify-between p-6 border-b border-[#EEF2F7]">
              <h2 className="font-display text-[24px] font-bold text-[#111827]">{form.id ? 'Edit banner' : 'New banner'}</h2>
              <button onClick={() => setForm(null)} className="w-10 h-10 rounded-full hover:bg-[#F1F5F9] flex items-center justify-center" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid lg:grid-cols-[1fr_360px] gap-8 p-6">
              <div className="space-y-4">
                <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Title</span>
                  <input className="ed-field mt-1.5" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Subtitle (optional)</span>
                    <input className="ed-field mt-1.5" maxLength={160} value={form.subtitle || ''} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></label>
                  <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Button text</span>
                    <input className="ed-field mt-1.5" maxLength={40} value={form.cta_text || ''} placeholder={isWeb ? 'Learn more' : 'Explore'} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} /></label>
                </div>
                <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Description</span>
                  <textarea rows={2} maxLength={300} className="ed-field mt-1.5 !h-auto py-3" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
                <ImageField
                  label={isWeb ? 'Desktop image' : 'Image'}
                  hint={isWeb ? '1920×600 recommended (min 1200×300). Large images are optimised automatically.' : '16:9, e.g. 1280×720 (min 640×360).'}
                  value={form.image_url || ''}
                  onChange={(u) => setForm({ ...form, image_url: u })}
                  assetType={isWeb ? 'website_banner' : 'app_banner'}
                  previewClass="h-24"
                />
                {isWeb && (
                  <ImageField label="Mobile image (optional)" hint="Portrait or square, e.g. 1080×1350. Used on phones; the desktop image is used if empty." value={form.mobile_image_url || ''} onChange={(u) => setForm({ ...form, mobile_image_url: u })} assetType="website_banner" previewClass="h-24" />
                )}
                <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Show on</span>
                  <select className="ed-field mt-1.5" value={form.placement || placement} onChange={(e) => setForm({ ...form, placement: e.target.value as any })}>
                    <option value="website">Website only</option><option value="app">App only</option><option value="both">Website and app</option>
                  </select></label>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Destination</span>
                    <select className="ed-field mt-1.5" value={form.link_type} onChange={(e) => setLink(e.target.value as LinkType)}>
                      <option value="none">No link</option><option value="course">Course</option><option value="bundle">Bundle</option>{!isWeb && <option value="offer">Offer</option>}<option value="blog">Blog post</option><option value="url">Web link</option>
                    </select></label>
                  {form.link_type === 'course' && <Picker label="Course" value={form.course_id} items={pickers.courses} onChange={(v) => setForm({ ...form, course_id: v })} />}
                  {form.link_type === 'bundle' && <Picker label="Bundle" value={form.bundle_id} items={pickers.bundles} onChange={(v) => setForm({ ...form, bundle_id: v })} />}
                  {form.link_type === 'offer' && <Picker label="Offer" value={form.offer_id} items={pickers.offers} onChange={(v) => setForm({ ...form, offer_id: v })} />}
                  {form.link_type === 'blog' && <Picker label="Blog post" value={form.blog_slug || null} items={pickers.posts} onChange={(v) => setForm({ ...form, blog_slug: v })} />}
                  {form.link_type === 'url' && (
                    <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Link</span>
                      <input className="ed-field mt-1.5" value={form.link_url || ''} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://…" /></label>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Start (optional)</span>
                    <input type="datetime-local" className="ed-field mt-1.5" value={toLocalInput(form.starts_at)} onChange={(e) => setForm({ ...form, starts_at: fromLocalInput(e.target.value) })} /></label>
                  <label className="block"><span className="text-[15px] font-semibold text-[#111827]">End (optional)</span>
                    <input type="datetime-local" className="ed-field mt-1.5" value={toLocalInput(form.ends_at)} onChange={(e) => setForm({ ...form, ends_at: fromLocalInput(e.target.value) })} /></label>
                </div>
                <label className="flex items-center gap-3 text-[16px] font-medium text-[#111827] cursor-pointer">
                  <input type="checkbox" className="w-5 h-5" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Enabled
                </label>
              </div>
              <div className="space-y-3">
                <div className="text-[13px] font-bold uppercase tracking-wide text-[#64748B]">Preview</div>
                {isWeb || form.placement === 'website' ? <WebsitePreview b={form} /> : <BannerPreview b={form} />}
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-[#EEF2F7]">
              <button onClick={() => setForm(null)} className="ed-btn ed-btn-outlined ed-btn-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="ed-btn ed-btn-filled ed-btn-sm">{saving ? 'Saving…' : 'Save banner'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const Picker: React.FC<{ label: string; value: string | null; items: PickItem[]; onChange: (v: string | null) => void }> = ({ label, value, items, onChange }) => (
  <label className="block"><span className="text-[15px] font-semibold text-[#111827]">{label}</span>
    <select className="ed-field mt-1.5" value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Choose…</option>
      {items.map((i) => <option key={i.id} value={i.id}>{i.title}{i.isPublished ? '' : ' (not live)'}</option>)}
    </select>
  </label>
);
