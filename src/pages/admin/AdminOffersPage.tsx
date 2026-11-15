import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Upload, Send, Megaphone } from 'lucide-react';
import { AdminPageHeader, EmptyState, ErrorBanner } from '../../components/admin/AdminUI';
import { courseService } from '../../services/api';
import {
  OfferRow, OfferType, PickItem, PushAudience, fmtDateTime, fromLocalInput, loadPickers, newKey, offerAdmin, pushAdmin, toLocalInput,
} from '../../services/pushAdmin';
import { AndroidPreview, AUDIENCE_LABEL } from './AdminNotificationsPage';
import { Picker } from './AdminBannersPage';
import { useCartWishlist } from '../../context/CartWishlistContext';

const OFFER_TYPES: Record<OfferType, string> = {
  special: 'Special discount',
  limited_time: 'Limited-time offer',
  festival: 'Festival offer',
  bundle_discount: 'Bundle discount',
  course_discount: 'Course discount',
  campaign: 'Promotional campaign',
};

const empty = (): OfferRow => ({
  title: '', description: '', discount_text: '', offer_type: 'special', image_url: '', link_type: 'none', course_id: null, bundle_id: null, link_url: null,
  starts_at: new Date().toISOString(), ends_at: null, is_active: true,
});

export const offerState = (o: OfferRow) => {
  const now = Date.now();
  if (!o.is_active) return { label: 'Disabled', cls: 'bg-[#F1F5F9] text-[#475569]' };
  if (new Date(o.starts_at).getTime() > now) return { label: 'Upcoming', cls: 'bg-[#E8EFFB] text-[#004AAD]' };
  if (o.ends_at && new Date(o.ends_at).getTime() <= now) return { label: 'Expired', cls: 'bg-amber-50 text-amber-700' };
  return { label: 'Active', cls: 'bg-emerald-50 text-emerald-700' };
};

interface NotifyState {
  enabled: boolean;
  when: 'now' | 'schedule';
  scheduledAt: string;
  audience: PushAudience;
  audienceCourseId: string;
  audienceBundleId: string;
  title: string;
  body: string;
}

export const AdminOffersPage: React.FC = () => {
  const { showToast } = useCartWishlist();
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [pickers, setPickers] = useState<{ courses: PickItem[]; bundles: PickItem[]; offers: PickItem[] }>({ courses: [], bundles: [], offers: [] });
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<OfferRow | null>(null);
  const [notify, setNotify] = useState<NotifyState | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    try {
      setOffers(await offerAdmin.list());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
    loadPickers().then(setPickers).catch(() => undefined);
  }, []);

  const open = (o?: OfferRow) => {
    const f = o ? { ...o } : empty();
    setForm(f);
    setNotify({ enabled: !o, when: 'now', scheduledAt: '', audience: 'all_students', audienceCourseId: '', audienceBundleId: '', title: '', body: '' });
  };

  const pushTitle = notify?.title || form?.title || '';
  const pushBody = notify?.body || [form?.discount_text, form?.description].filter(Boolean).join(' — ').slice(0, 240);

  const validate = (): string | null => {
    if (!form) return 'Nothing to save';
    if (!form.title.trim()) return 'Give the offer a title';
    if (form.image_url && !/^https:\/\/\S+$/.test(form.image_url)) return 'The image must be an https:// link';
    if (form.link_type === 'url' && !/^https:\/\/\S+$/.test(form.link_url || '')) return 'The link must start with https://';
    if (form.link_type === 'course' && !form.course_id) return 'Choose a course';
    if (form.link_type === 'bundle' && !form.bundle_id) return 'Choose a bundle';
    if (form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) return 'The end date must be after the start date';
    if (notify?.enabled) {
      if (form.ends_at && new Date(form.ends_at).getTime() <= Date.now()) return 'This offer has already ended — it can’t be announced';
      if (!pushTitle.trim() || pushTitle.length > 65) return 'Push title is required (max 65 characters)';
      if (!pushBody.trim() || pushBody.length > 240) return 'Push message is required (max 240 characters)';
      if (notify.when === 'schedule' && !notify.scheduledAt) return 'Choose when to send the notification';
      if (notify.audience === 'course_students' && !notify.audienceCourseId) return 'Choose the course for the audience';
      if (notify.audience === 'bundle_buyers' && !notify.audienceBundleId) return 'Choose the bundle for the audience';
    }
    return null;
  };

  const save = async (confirmed = false) => {
    const problem = validate();
    if (problem) return showToast(problem, 'warning');
    if (notify?.enabled && !confirmed) return setConfirm(true);
    setConfirm(false);
    setSaving(true);
    try {
      const saved = await offerAdmin.save({
        ...form!,
        title: form!.title.trim(),
        description: form!.description?.trim() || null,
        discount_text: form!.discount_text?.trim() || null,
        image_url: form!.image_url?.trim() || null,
      });
      if (notify?.enabled && saved.id) {
        await pushAdmin.create(
          {
            title: pushTitle.trim(), body: pushBody.trim(), imageUrl: saved.image_url || '', actionUrl: '', category: 'offer',
            courseId: saved.course_id || '', bundleId: saved.bundle_id || '', offerId: saved.id,
            audience: notify.audience, audienceCourseId: notify.audienceCourseId, audienceBundleId: notify.audienceBundleId,
          },
          { mode: notify.when === 'now' ? 'now' : 'schedule', scheduledAt: fromLocalInput(notify.scheduledAt) || undefined, confirmed: true, idempotencyKey: newKey(), source: 'offer' }
        );
        showToast(notify.when === 'now' ? 'Offer saved — notification is sending' : 'Offer saved — notification scheduled', 'success');
      } else showToast('Offer saved', 'success');
      setForm(null);
      setNotify(null);
      await load();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file?: File) => {
    if (!file || !form) return;
    if (!file.type.startsWith('image/')) return showToast('Choose an image file', 'warning');
    setUploading(true);
    try {
      const r = await courseService.uploadMedia(file, 'course-thumbnails');
      setForm({ ...form, image_url: r.url });
    } catch (e: any) {
      showToast(e.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Engagement"
        title="Offers & promotions"
        description="Offers appear in the app’s Special offers section while they’re active, and can be announced with a push notification."
        actions={<button onClick={() => open()} className="ed-btn ed-btn-filled ed-btn-sm"><Plus className="w-4 h-4" /> New offer</button>}
      />
      {error && <ErrorBanner message={error} />}

      <section className="bg-white rounded-[20px] border border-[#E2E8F0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <thead className="bg-[#F7F9FC] text-[13px] uppercase tracking-wide text-[#64748B]">
              <tr><th className="px-5 py-3">Offer</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Runs</th><th className="px-5 py-3">Status</th><th className="px-5 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F7]">
              {offers.map((o) => {
                const st = offerState(o);
                return (
                  <tr key={o.id}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-16 aspect-video rounded-lg overflow-hidden bg-[#F1EAFE] shrink-0 flex items-center justify-center">{o.image_url ? <img src={o.image_url} alt="" className="w-full h-full object-cover" /> : <Megaphone className="w-5 h-5 text-[#5E17EB]" />}</div>
                        <div className="min-w-0"><div className="font-semibold text-[#111827] truncate max-w-[280px]">{o.title}</div>{o.discount_text && <div className="text-[13px] font-semibold text-[#5E17EB]">{o.discount_text}</div>}</div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[14px] text-[#334155]">{OFFER_TYPES[o.offer_type]}</td>
                    <td className="px-5 py-3 text-[13px] text-[#334155] whitespace-nowrap">{fmtDateTime(o.starts_at)} → {o.ends_at ? fmtDateTime(o.ends_at) : 'No end date'}</td>
                    <td className="px-5 py-3"><span className={`px-2.5 h-7 inline-flex items-center rounded-full text-[13px] font-semibold ${st.cls}`}>{st.label}</span></td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button onClick={() => open(o)} className="ed-btn ed-btn-text ed-btn-sm" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => window.confirm(`Delete offer “${o.title}”?`) && offerAdmin.remove(o.id!).then(load).catch((e) => showToast(e.message, 'error'))} className="ed-btn ed-btn-text ed-btn-sm !text-rose-600" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {offers.length === 0 && <EmptyState title="No offers yet" body="Create an offer to show it in the app and announce it to students." />}
        </div>
      </section>

      {form && notify && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Offer editor">
          <div className="fixed inset-0 bg-[#111827]/40" onClick={() => setForm(null)} />
          <div className="relative w-full max-w-5xl bg-white rounded-[28px] shadow-2xl my-8 edufy-pop">
            <div className="flex items-center justify-between p-6 border-b border-[#EEF2F7]">
              <h2 className="font-display text-[24px] font-bold text-[#111827]">{form.id ? 'Edit offer' : 'New offer'}</h2>
              <button onClick={() => setForm(null)} className="w-10 h-10 rounded-full hover:bg-[#F1F5F9] flex items-center justify-center" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid lg:grid-cols-[1fr_340px] gap-8 p-6">
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Offer title</span>
                    <input className="ed-field mt-1.5" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Diwali Learning Festival" /></label>
                  <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Offer type</span>
                    <select className="ed-field mt-1.5" value={form.offer_type} onChange={(e) => setForm({ ...form, offer_type: e.target.value as OfferType })}>
                      {(Object.keys(OFFER_TYPES) as OfferType[]).map((k) => <option key={k} value={k}>{OFFER_TYPES[k]}</option>)}
                    </select></label>
                </div>
                <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Discount details</span>
                  <input className="ed-field mt-1.5" maxLength={60} value={form.discount_text || ''} onChange={(e) => setForm({ ...form, discount_text: e.target.value })} placeholder="Exactly as students should see it, e.g. Flat 40% off" />
                  <p className="mt-1 text-[12.5px] text-[#64748B]">Shown as entered. Course prices themselves are still set on each course.</p></label>
                <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Description</span>
                  <textarea rows={3} maxLength={1000} className="ed-field mt-1.5 !h-auto py-3" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
                <div>
                  <span className="text-[15px] font-semibold text-[#111827]">Image / banner</span>
                  <div className="mt-1.5 flex gap-2">
                    <input className="ed-field" value={form.image_url || ''} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" />
                    <label className="ed-btn ed-btn-tonal ed-btn-sm cursor-pointer shrink-0"><Upload className="w-4 h-4" />{uploading ? '…' : 'Upload'}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} /></label>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Destination</span>
                    <select className="ed-field mt-1.5" value={form.link_type} onChange={(e) => setForm({ ...form, link_type: e.target.value as OfferRow['link_type'], course_id: null, bundle_id: null, link_url: null })}>
                      <option value="none">Offer page only</option><option value="course">Course</option><option value="bundle">Bundle</option><option value="url">Web link</option>
                    </select></label>
                  {form.link_type === 'course' && <Picker label="Course" value={form.course_id} items={pickers.courses} onChange={(v) => setForm({ ...form, course_id: v })} />}
                  {form.link_type === 'bundle' && <Picker label="Bundle" value={form.bundle_id} items={pickers.bundles} onChange={(v) => setForm({ ...form, bundle_id: v })} />}
                  {form.link_type === 'url' && (
                    <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Link</span>
                      <input className="ed-field mt-1.5" value={form.link_url || ''} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://…" /></label>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Starts</span>
                    <input type="datetime-local" className="ed-field mt-1.5" value={toLocalInput(form.starts_at)} onChange={(e) => setForm({ ...form, starts_at: fromLocalInput(e.target.value) || new Date().toISOString() })} /></label>
                  <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Ends</span>
                    <input type="datetime-local" className="ed-field mt-1.5" value={toLocalInput(form.ends_at)} onChange={(e) => setForm({ ...form, ends_at: fromLocalInput(e.target.value) })} /></label>
                </div>
                <label className="flex items-center gap-3 text-[16px] font-medium text-[#111827] cursor-pointer">
                  <input type="checkbox" className="w-5 h-5" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active
                </label>

                <div className="p-4 rounded-2xl border border-[#E2E8F0] space-y-3">
                  <label className="flex items-center gap-3 text-[16px] font-semibold text-[#111827] cursor-pointer">
                    <input type="checkbox" className="w-5 h-5" checked={notify.enabled} onChange={(e) => setNotify({ ...notify, enabled: e.target.checked })} />
                    <Send className="w-4 h-4 text-[#004AAD]" /> Announce with a push notification
                  </label>
                  {notify.enabled && (
                    <>
                      <input className="ed-field" maxLength={65} placeholder={`Push title (default: ${form.title || 'offer title'})`} value={notify.title} onChange={(e) => setNotify({ ...notify, title: e.target.value })} />
                      <textarea rows={2} maxLength={240} className="ed-field !h-auto py-3" placeholder="Push message (default: discount + description)" value={notify.body} onChange={(e) => setNotify({ ...notify, body: e.target.value })} />
                      <div className="grid sm:grid-cols-2 gap-3">
                        <select className="ed-field" value={notify.audience} onChange={(e) => setNotify({ ...notify, audience: e.target.value as PushAudience })}>
                          {(Object.keys(AUDIENCE_LABEL) as PushAudience[]).map((a) => <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>)}
                        </select>
                        {notify.audience === 'course_students' && <Picker label="" value={notify.audienceCourseId || null} items={pickers.courses} onChange={(v) => setNotify({ ...notify, audienceCourseId: v || '' })} />}
                        {notify.audience === 'bundle_buyers' && <Picker label="" value={notify.audienceBundleId || null} items={pickers.bundles} onChange={(v) => setNotify({ ...notify, audienceBundleId: v || '' })} />}
                      </div>
                      <div className="flex flex-wrap gap-4 text-[15px]">
                        <label className="flex items-center gap-2"><input type="radio" checked={notify.when === 'now'} onChange={() => setNotify({ ...notify, when: 'now' })} /> Send immediately</label>
                        <label className="flex items-center gap-2"><input type="radio" checked={notify.when === 'schedule'} onChange={() => setNotify({ ...notify, when: 'schedule' })} /> Schedule</label>
                        {notify.when === 'schedule' && <input type="datetime-local" className="ed-field max-w-xs" value={notify.scheduledAt} onChange={(e) => setNotify({ ...notify, scheduledAt: e.target.value })} />}
                      </div>
                      <p className="text-[12.5px] text-[#64748B]">If the offer is disabled or ends before a scheduled send, the notification is cancelled automatically.</p>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-[13px] font-bold uppercase tracking-wide text-[#64748B]">{notify.enabled ? 'Push preview' : 'Offer preview'}</div>
                <AndroidPreview title={pushTitle} body={pushBody} image={form.image_url} />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-[#EEF2F7]">
              <button onClick={() => setForm(null)} className="ed-btn ed-btn-outlined ed-btn-sm">Cancel</button>
              <button onClick={() => save()} disabled={saving} className="ed-btn ed-btn-filled ed-btn-sm">{saving ? 'Saving…' : notify.enabled ? 'Save & announce' : 'Save offer'}</button>
            </div>
          </div>
        </div>
      )}

      {confirm && notify && form && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-[#111827]/50" onClick={() => setConfirm(false)} />
          <div className="relative w-full max-w-md bg-white rounded-[24px] p-6 shadow-2xl edufy-pop">
            <h3 className="font-display text-[20px] font-bold text-[#111827]">{notify.when === 'now' ? 'Send this offer notification now?' : 'Schedule this offer notification?'}</h3>
            <p className="mt-2 text-[15px] text-[#334155]">“{pushTitle}” → {AUDIENCE_LABEL[notify.audience]}{notify.when === 'schedule' ? ` on ${fmtDateTime(fromLocalInput(notify.scheduledAt))}` : ''}.</p>
            {notify.audience === 'all_students' && <p className="mt-3 p-3 rounded-xl bg-amber-50 text-amber-900 text-[14.5px]">This goes to every registered student who allows promotional notifications. It can’t be recalled once sent.</p>}
            <div className="flex justify-end gap-3 mt-6">
              <button className="ed-btn ed-btn-outlined ed-btn-sm" onClick={() => setConfirm(false)}>Back</button>
              <button className="ed-btn ed-btn-filled ed-btn-sm" onClick={() => save(true)}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
