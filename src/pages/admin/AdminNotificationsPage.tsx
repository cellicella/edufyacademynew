import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell, Send, CalendarClock, Save, X, Upload, RefreshCw, Smartphone, CheckCircle2, AlertTriangle, Ban, Pencil, Trash2, Copy, Eye, Settings2,
  Users, Clock, Inbox, Zap,
} from 'lucide-react';
import { AdminPageHeader, StatCard, EmptyState, ErrorBanner } from '../../components/admin/AdminUI';
import { courseService } from '../../services/api';
import {
  ApiError, CampaignForm, PickItem, PushAudience, PushCampaign, PushCategory, PushOverview, PushSettings, PushStatus,
  fmtDateTime, fromLocalInput, loadPickers, newKey, pushAdmin, toLocalInput,
} from '../../services/pushAdmin';
import { useCartWishlist } from '../../context/CartWishlistContext';

export const CATEGORY_LABEL: Record<PushCategory, string> = {
  new_course: 'New course published',
  new_bundle: 'New bundle published',
  offer: 'Special offer',
  discount: 'Discount announcement',
  course_update: 'Course update',
  new_content: 'New learning content',
  announcement: 'Important announcement',
  custom: 'Custom message',
  course_completion: 'Course completion',
  certificate: 'Certificate available',
};
const MANUAL_CATEGORIES: PushCategory[] = ['announcement', 'custom', 'offer', 'discount', 'new_course', 'new_bundle', 'course_update', 'new_content'];

export const AUDIENCE_LABEL: Record<PushAudience, string> = {
  all_students: 'All registered students',
  enrolled_students: 'All enrolled students',
  course_students: 'Students of a selected course',
  bundle_buyers: 'Buyers of a selected bundle',
};

const STATUS_STYLE: Record<PushStatus, string> = {
  draft: 'bg-[#F1F5F9] text-[#475569]',
  pending_review: 'bg-amber-50 text-amber-700',
  scheduled: 'bg-[#E8EFFB] text-[#004AAD]',
  sending: 'bg-[#F1EAFE] text-[#5E17EB]',
  sent: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-rose-50 text-rose-700',
  cancelled: 'bg-[#F1F5F9] text-[#94A3B8]',
};
const STATUS_LABEL: Record<PushStatus, string> = {
  draft: 'Draft', pending_review: 'Needs review', scheduled: 'Scheduled', sending: 'Sending', sent: 'Sent', failed: 'Failed', cancelled: 'Cancelled',
};

const emptyForm = (): CampaignForm => ({
  title: '', body: '', imageUrl: '', actionUrl: '', category: 'announcement', courseId: '', bundleId: '', offerId: '',
  audience: 'all_students', audienceCourseId: '', audienceBundleId: '',
});

const fromCampaign = (c: PushCampaign): CampaignForm => ({
  title: c.title, body: c.body, imageUrl: c.image_url || '', actionUrl: c.action_url || '', category: c.category,
  courseId: c.course_id || '', bundleId: c.bundle_id || '', offerId: c.offer_id || '', audience: c.audience,
  audienceCourseId: c.audience_course_id || '', audienceBundleId: c.audience_bundle_id || '',
});

type Tab = 'compose' | 'history' | 'automation';

export const StatusPill: React.FC<{ status: PushStatus }> = ({ status }) => (
  <span className={`px-2.5 h-7 inline-flex items-center rounded-full text-[13px] font-semibold whitespace-nowrap ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
);

/** Approximation of how Android shows the notification (expanded, with big picture). */
export const AndroidPreview: React.FC<{ title: string; body: string; image?: string | null }> = ({ title, body, image }) => (
  <div className="rounded-[28px] bg-[#1F2430] p-4 shadow-xl">
    <div className="flex items-center justify-between text-[12px] text-white/70 px-2 pb-3">
      <span>9:41</span>
      <span className="flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /> Android</span>
    </div>
    <div className="rounded-[22px] bg-[#F4F6FB] p-4">
      <div className="flex items-center gap-2 text-[12px] text-[#475569]">
        <span className="w-5 h-5 rounded-full bg-[#004AAD] text-white flex items-center justify-center text-[10px] font-bold">E</span>
        <span className="font-semibold">Edufy Academy</span>
        <span>• now</span>
      </div>
      <div className="mt-2 text-[15px] font-semibold text-[#111827] break-words">{title || 'Notification title'}</div>
      <div className="mt-0.5 text-[14px] text-[#334155] whitespace-pre-line break-words">{body || 'Your message appears here.'}</div>
      {image && (
        <img src={image} alt="" className="mt-3 w-full aspect-[2/1] object-cover rounded-xl bg-[#E2E8F0]" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
      )}
    </div>
    <p className="text-[11.5px] text-white/50 mt-3 px-2">Exact look depends on the phone and Android version. Images appear when the notification is expanded.</p>
  </div>
);

export const AdminNotificationsPage: React.FC = () => {
  const { showToast } = useCartWishlist();
  const [tab, setTab] = useState<Tab>('compose');
  const [overview, setOverview] = useState<PushOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickers, setPickers] = useState<{ courses: PickItem[]; bundles: PickItem[]; offers: PickItem[] }>({ courses: [], bundles: [], offers: [] });

  const load = useCallback(async () => {
    try {
      setOverview(await pushAdmin.overview());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    loadPickers().then(setPickers).catch((e) => setError(e.message));
  }, [load]);

  // Refresh while something is queued or sending
  useEffect(() => {
    const busy = overview && (overview.counts.sending > 0 || overview.notifications.some((n) => n.status === 'scheduled' && n.scheduled_at && new Date(n.scheduled_at).getTime() < Date.now() + 120_000));
    if (!busy) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [overview, load]);

  const [editing, setEditing] = useState<PushCampaign | null>(null);
  const [seed, setSeed] = useState<CampaignForm | null>(null);

  const c = overview?.counts;
  return (
    <div>
      <AdminPageHeader
        eyebrow="Engagement"
        title="Push notifications"
        description="Send real push notifications to the Edufy student app, schedule them, and review delivery results."
        actions={<button onClick={load} className="ed-btn ed-btn-outlined ed-btn-sm"><RefreshCw className="w-4 h-4" /> Refresh</button>}
      />
      {error && <ErrorBanner message={error} />}
      {overview?.worker.lastError && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-[15px] text-amber-900 flex gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" /> Sender: {overview.worker.lastError}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total notifications" value={overview?.total ?? '—'} icon={Bell} />
        <StatCard label="Sent" value={c?.sent ?? '—'} hint={c ? `${c.failed} failed · ${c.cancelled} cancelled` : undefined} icon={CheckCircle2} tone="green" />
        <StatCard label="Scheduled" value={c ? c.scheduled + c.pending_review : '—'} hint={c?.pending_review ? `${c.pending_review} waiting for review` : 'Queued to send'} icon={CalendarClock} tone="purple" />
        <StatCard label="Registered devices" value={overview?.devices ?? '—'} hint="Phones with notifications allowed" icon={Smartphone} tone="ink" />
        <StatCard label="Students targeted" value={overview?.totals.targeted ?? '—'} hint="All sent notifications" icon={Users} />
        <StatCard label="Accepted by Expo" value={overview?.totals.accepted ?? '—'} hint={overview ? `${overview.totals.rejected} rejected` : undefined} icon={Send} tone="purple" />
        <StatCard label="Handed to Google/Apple" value={overview?.totals.delivered ?? '—'} hint={overview ? `Expo receipts · ${overview.totals.receiptErrors} errors` : undefined} icon={Zap} tone="green" />
        <StatCard label="Failed notifications" value={c?.failed ?? '—'} icon={AlertTriangle} tone="ink" />
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {(['compose', 'history', 'automation'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`ed-btn ed-btn-sm ${tab === t ? 'ed-btn-ink' : 'ed-btn-outlined'}`}>
            {t === 'compose' ? (editing ? 'Edit notification' : 'Create notification') : t === 'history' ? 'History' : 'Automation'}
          </button>
        ))}
      </div>

      {tab === 'compose' && (
        <Composer
          key={editing?.id || (seed ? 'seed' + seed.title : 'new')}
          pickers={pickers}
          editing={editing}
          seed={seed}
          onDone={() => {
            setEditing(null);
            setSeed(null);
            load();
          }}
          onCancelEdit={() => {
            setEditing(null);
            setSeed(null);
          }}
          showToast={showToast}
        />
      )}
      {tab === 'history' && (
        <History
          overview={overview}
          pickers={pickers}
          reload={load}
          showToast={showToast}
          onEdit={(n) => {
            setEditing(n);
            setSeed(null);
            setTab('compose');
          }}
          onDuplicate={(n) => {
            setEditing(null);
            setSeed(fromCampaign(n));
            setTab('compose');
          }}
        />
      )}
      {tab === 'automation' && overview && <Automation initial={overview.settings} onSaved={load} showToast={showToast} />}
    </div>
  );
};

/* ================================================================== Composer */
const Composer: React.FC<{
  pickers: { courses: PickItem[]; bundles: PickItem[]; offers: PickItem[] };
  editing: PushCampaign | null;
  seed: CampaignForm | null;
  onDone: () => void;
  onCancelEdit: () => void;
  showToast: (m: string, t?: 'success' | 'info' | 'warning' | 'error') => void;
}> = ({ pickers, editing, seed, onDone, onCancelEdit, showToast }) => {
  const [form, setForm] = useState<CampaignForm>(editing ? fromCampaign(editing) : seed || emptyForm());
  const [linkMode, setLinkMode] = useState<'auto' | 'url'>(editing?.action_url?.startsWith('https://') || seed?.actionUrl?.startsWith('https://') ? 'url' : 'auto');
  const [when, setWhen] = useState<'now' | 'schedule'>(editing?.status === 'scheduled' ? 'schedule' : 'now');
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(editing?.scheduled_at) || '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [audience, setAudience] = useState<{ students: number; devices: number; studentsWithDevices: number } | null>(null);
  const [confirming, setConfirming] = useState<null | 'now' | 'schedule'>(null);
  const [result, setResult] = useState<PushCampaign | null>(null);
  const idemKey = useRef(newKey());
  const set = <K extends keyof CampaignForm>(k: K, v: CampaignForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Live audience size
  useEffect(() => {
    if ((form.audience === 'course_students' && !form.audienceCourseId) || (form.audience === 'bundle_buyers' && !form.audienceBundleId)) {
      setAudience(null);
      return;
    }
    const t = setTimeout(() => {
      pushAdmin.audiencePreview(form).then(setAudience).catch(() => setAudience(null));
    }, 350);
    return () => clearTimeout(t);
  }, [form.audience, form.audienceCourseId, form.audienceBundleId, form.category]);

  const autoDestination = form.offerId
    ? 'the offer'
    : form.courseId
    ? 'the course page'
    : form.bundleId
    ? 'the bundle page'
    : 'the notification centre';

  const payload = (): CampaignForm => ({ ...form, actionUrl: linkMode === 'url' ? form.actionUrl.trim() : '' });

  const localErrors = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required.';
    else if (form.title.trim().length > 65) e.title = 'Keep the title to 65 characters.';
    if (!form.body.trim()) e.body = 'Message is required.';
    else if (form.body.trim().length > 240) e.body = 'Keep the message to 240 characters.';
    if (form.imageUrl && !/^https:\/\/\S+$/.test(form.imageUrl.trim())) e.imageUrl = 'Use an https:// image link.';
    if (linkMode === 'url' && !/^https:\/\/\S+$/.test(form.actionUrl.trim())) e.actionUrl = 'Enter an https:// link.';
    if (form.audience === 'course_students' && !form.audienceCourseId) e.audienceCourseId = 'Choose a course.';
    if (form.audience === 'bundle_buyers' && !form.audienceBundleId) e.audienceBundleId = 'Choose a bundle.';
    return e;
  };

  const handleError = (e: any) => {
    if (e instanceof ApiError && e.fieldErrors) setFieldErrors(e.fieldErrors);
    showToast(e.message || 'Something went wrong', 'error');
  };

  const pollResult = async (id: string) => {
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const d = await pushAdmin.detail(id);
        setResult(d.notification);
        if (['sent', 'failed', 'cancelled'].includes(d.notification.status)) return;
      } catch {
        /* keep polling */
      }
    }
  };

  const submit = async (mode: 'draft' | 'now' | 'schedule', confirmed = false) => {
    const errs = localErrors();
    if (mode === 'schedule' && !scheduledAt) errs.scheduledAt = 'Choose the date and time.';
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    if (mode !== 'draft' && !confirmed) {
      setConfirming(mode);
      return;
    }
    setConfirming(null);
    setBusy(true);
    try {
      let saved: PushCampaign;
      if (editing) {
        saved = (await pushAdmin.update(editing.id, payload(), mode === 'schedule' ? fromLocalInput(scheduledAt) || undefined : undefined)).notification;
        if (mode === 'now') saved = (await pushAdmin.sendNow(editing.id, true)).notification;
        if (mode === 'schedule') saved = (await pushAdmin.schedule(editing.id, fromLocalInput(scheduledAt)!, true)).notification;
      } else {
        const r = await pushAdmin.create(payload(), { mode, scheduledAt: fromLocalInput(scheduledAt) || undefined, confirmed: true, idempotencyKey: idemKey.current });
        saved = r.notification;
        if (r.duplicate) showToast('This notification was already submitted', 'info');
      }
      idemKey.current = newKey();
      if (mode === 'now') {
        setResult(saved);
        showToast('Sending…', 'info');
        await pollResult(saved.id);
      } else {
        showToast(mode === 'draft' ? 'Draft saved' : `Scheduled for ${fmtDateTime(saved.scheduled_at)}`, 'success');
        setForm(emptyForm());
        onDone();
      }
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return showToast('Choose an image file', 'warning');
    if (file.size > 5 * 1024 * 1024) return showToast('Images must be under 5 MB', 'warning');
    setUploading(true);
    try {
      const r = await courseService.uploadMedia(file, 'course-thumbnails');
      set('imageUrl', r.url);
    } catch (e: any) {
      showToast(e.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const err = (k: string) => fieldErrors[k] && <p className="mt-1 text-[13px] text-rose-600">{fieldErrors[k]}</p>;
  const select = (value: string, onChange: (v: string) => void, items: PickItem[], placeholder: string) => (
    <select className="ed-field mt-1.5" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {items.map((i) => (
        <option key={i.id} value={i.id}>{i.title}{i.isPublished ? '' : ' (not live)'}</option>
      ))}
    </select>
  );

  if (result) {
    const done = ['sent', 'failed', 'cancelled'].includes(result.status);
    return (
      <section className="bg-white rounded-[20px] border border-[#E2E8F0] p-6 max-w-2xl">
        <div className="flex items-center gap-3">
          {done ? (result.status === 'sent' ? <CheckCircle2 className="w-7 h-7 text-emerald-600" /> : <AlertTriangle className="w-7 h-7 text-rose-600" />) : <RefreshCw className="w-7 h-7 text-[#5E17EB] animate-spin" />}
          <div>
            <h2 className="font-display text-[22px] font-bold text-[#111827]">{done ? (result.status === 'sent' ? 'Notification sent' : result.status === 'failed' ? 'Sending failed' : 'Cancelled') : 'Sending…'}</h2>
            <p className="text-[15px] text-[#64748B]">“{result.title}”</p>
          </div>
        </div>
        <ResultGrid n={result} />
        {result.last_error && <p className="mt-4 text-[14px] text-amber-800 bg-amber-50 rounded-xl p-3">{result.last_error}</p>}
        {!done && <p className="mt-4 text-[14px] text-[#64748B]">Large audiences are sent in the background — you can leave this page; results appear in History.</p>}
        <div className="mt-6 flex gap-3">
          <button className="ed-btn ed-btn-filled ed-btn-sm" onClick={() => { setResult(null); setForm(emptyForm()); onDone(); }}>Create another</button>
        </div>
      </section>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-8">
      <section className="bg-white rounded-[20px] border border-[#E2E8F0] p-6 space-y-5">
        {editing && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#E8EFFB] text-[15px] text-[#004AAD]">
            Editing “{editing.title}” ({STATUS_LABEL[editing.status]})
            <button className="ed-btn ed-btn-text ed-btn-sm" onClick={onCancelEdit}><X className="w-4 h-4" /> Stop editing</button>
          </div>
        )}
        <label className="block">
          <span className="text-[15px] font-semibold text-[#111827]">Notification title</span>
          <input className="ed-field mt-1.5" maxLength={65} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. New Course Available!" />
          <div className="flex justify-between">{err('title') || <span />}<span className="text-[12px] text-[#94A3B8] mt-1">{form.title.length}/65</span></div>
        </label>
        <label className="block">
          <span className="text-[15px] font-semibold text-[#111827]">Message</span>
          <textarea rows={3} maxLength={240} className="ed-field mt-1.5 !h-auto py-3" value={form.body} onChange={(e) => set('body', e.target.value)} placeholder="Write a short, clear message." />
          <div className="flex justify-between">{err('body') || <span />}<span className="text-[12px] text-[#94A3B8] mt-1">{form.body.length}/240</span></div>
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[15px] font-semibold text-[#111827]">Category</span>
            <select className="ed-field mt-1.5" value={form.category} onChange={(e) => set('category', e.target.value as PushCategory)}>
              {MANUAL_CATEGORIES.map((k) => <option key={k} value={k}>{CATEGORY_LABEL[k]}</option>)}
            </select>
            <p className="mt-1 text-[12.5px] text-[#64748B]">Students can turn categories off in the app; they won’t receive those.</p>
          </label>
          <div>
            <span className="text-[15px] font-semibold text-[#111827]">Banner image (optional)</span>
            <div className="mt-1.5 flex gap-2">
              <input className="ed-field" value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} placeholder="https://…" />
              <label className="ed-btn ed-btn-tonal ed-btn-sm cursor-pointer shrink-0"><Upload className="w-4 h-4" />{uploading ? '…' : 'Upload'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} /></label>
            </div>
            {err('imageUrl')}
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Related course</span>
            {select(form.courseId, (v) => set('courseId', v), pickers.courses, 'None')}{err('courseId')}</label>
          <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Related bundle</span>
            {select(form.bundleId, (v) => set('bundleId', v), pickers.bundles, 'None')}{err('bundleId')}</label>
          <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Related offer</span>
            {select(form.offerId, (v) => set('offerId', v), pickers.offers, 'None')}{err('offerId')}</label>
        </div>

        <div>
          <span className="text-[15px] font-semibold text-[#111827]">When tapped, open</span>
          <div className="mt-2 flex flex-wrap gap-4 text-[15px]">
            <label className="flex items-center gap-2"><input type="radio" checked={linkMode === 'auto'} onChange={() => setLinkMode('auto')} /> {autoDestination} (in the app)</label>
            <label className="flex items-center gap-2"><input type="radio" checked={linkMode === 'url'} onChange={() => setLinkMode('url')} /> A web link</label>
          </div>
          {linkMode === 'url' && (
            <>
              <input className="ed-field mt-2" value={form.actionUrl} onChange={(e) => set('actionUrl', e.target.value)} placeholder="https://edufyacademy.com/…" />
              {err('actionUrl')}
            </>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[15px] font-semibold text-[#111827]">Target audience</span>
            <select className="ed-field mt-1.5" value={form.audience} onChange={(e) => set('audience', e.target.value as PushAudience)}>
              {(Object.keys(AUDIENCE_LABEL) as PushAudience[]).map((a) => <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>)}
            </select>
          </label>
          {form.audience === 'course_students' && (
            <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Course</span>
              {select(form.audienceCourseId, (v) => set('audienceCourseId', v), pickers.courses, 'Choose a course')}{err('audienceCourseId')}</label>
          )}
          {form.audience === 'bundle_buyers' && (
            <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Bundle</span>
              {select(form.audienceBundleId, (v) => set('audienceBundleId', v), pickers.bundles, 'Choose a bundle')}{err('audienceBundleId')}</label>
          )}
        </div>
        <div className="flex items-center gap-2 text-[14.5px] text-[#334155] bg-[#F7F9FC] rounded-xl p-3">
          <Users className="w-4 h-4 text-[#004AAD]" />
          {audience
            ? <>Reaches <b>{audience.students}</b> student{audience.students === 1 ? '' : 's'} in the notification centre · <b>{audience.devices}</b> device{audience.devices === 1 ? '' : 's'} ({audience.studentsWithDevices} students) can receive a push.</>
            : 'Audience size appears here.'}
        </div>

        <div>
          <span className="text-[15px] font-semibold text-[#111827]">Delivery</span>
          <div className="mt-2 flex flex-wrap gap-4 text-[15px]">
            <label className="flex items-center gap-2"><input type="radio" checked={when === 'now'} onChange={() => setWhen('now')} /> Send now</label>
            <label className="flex items-center gap-2"><input type="radio" checked={when === 'schedule'} onChange={() => setWhen('schedule')} /> Schedule for later</label>
          </div>
          {when === 'schedule' && (
            <>
              <input type="datetime-local" className="ed-field mt-2 max-w-xs" value={scheduledAt} min={toLocalInput(new Date().toISOString())} onChange={(e) => setScheduledAt(e.target.value)} />
              {err('scheduledAt')}
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-3 pt-2 border-t border-[#EEF2F7]">
          <button disabled={busy} onClick={() => submit(when)} className="ed-btn ed-btn-filled ed-btn-sm">
            {when === 'now' ? <Send className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />} {when === 'now' ? 'Review & send' : 'Review & schedule'}
          </button>
          {(!editing || editing.status === 'draft') && (
            <button disabled={busy} onClick={() => submit('draft')} className="ed-btn ed-btn-outlined ed-btn-sm"><Save className="w-4 h-4" /> Save as draft</button>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="text-[13px] font-bold uppercase tracking-wide text-[#64748B]">Live preview</div>
        <AndroidPreview title={form.title} body={form.body} image={form.imageUrl} />
      </aside>

      {confirming && (
        <Dialog title={confirming === 'now' ? 'Send this notification now?' : 'Schedule this notification?'} onClose={() => setConfirming(null)}>
          <div className="grid sm:grid-cols-[1fr_260px] gap-6">
            <ul className="space-y-2 text-[15px] text-[#334155]">
              <li><b>Audience:</b> {AUDIENCE_LABEL[form.audience]}</li>
              <li><b>Students:</b> {audience ? audience.students : '…'} · <b>Devices:</b> {audience ? audience.devices : '…'}</li>
              <li><b>Category:</b> {CATEGORY_LABEL[form.category]}</li>
              <li><b>Opens:</b> {linkMode === 'url' ? form.actionUrl : autoDestination}</li>
              {confirming === 'schedule' && <li><b>When:</b> {fmtDateTime(fromLocalInput(scheduledAt))}</li>}
              {form.audience === 'all_students' && (
                <li className="p-3 rounded-xl bg-amber-50 text-amber-900">This goes to <b>every registered student</b>. Push notifications can’t be recalled once sent.</li>
              )}
            </ul>
            <AndroidPreview title={form.title} body={form.body} image={form.imageUrl} />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button className="ed-btn ed-btn-outlined ed-btn-sm" onClick={() => setConfirming(null)}>Back</button>
            <button className="ed-btn ed-btn-filled ed-btn-sm" disabled={busy} onClick={() => submit(confirming, true)}>
              {confirming === 'now' ? 'Yes, send now' : 'Yes, schedule'}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
};

const ResultGrid: React.FC<{ n: PushCampaign }> = ({ n }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
    {[
      ['Students targeted', n.target_count, Users],
      ['Notification centre', n.inbox_count, Inbox],
      ['Devices attempted', n.device_count, Smartphone],
      ['Accepted by Expo', n.tickets_ok, Send],
      ['Rejected', n.tickets_failed, AlertTriangle],
      ['Handed to Google/Apple', n.receipts_ok, CheckCircle2],
    ].map(([label, value, Icon]: any) => (
      <div key={label} className="rounded-xl border border-[#E2E8F0] p-3">
        <div className="flex items-center gap-1.5 text-[13px] text-[#64748B]"><Icon className="w-3.5 h-3.5" /> {label}</div>
        <div className="font-display text-[22px] font-extrabold tabular-nums text-[#111827]">{value}</div>
      </div>
    ))}
  </div>
);

const Dialog: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label={title}>
    <div className="fixed inset-0 bg-[#111827]/40" onClick={onClose} />
    <div className="relative w-full max-w-3xl bg-white rounded-[28px] shadow-2xl my-8 p-6 edufy-pop">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display text-[22px] font-bold text-[#111827]">{title}</h2>
        <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-[#F1F5F9] flex items-center justify-center" aria-label="Close"><X className="w-5 h-5" /></button>
      </div>
      {children}
    </div>
  </div>
);

/* ================================================================== History */
const History: React.FC<{
  overview: PushOverview | null;
  pickers: { courses: PickItem[]; bundles: PickItem[]; offers: PickItem[] };
  reload: () => void;
  onEdit: (n: PushCampaign) => void;
  onDuplicate: (n: PushCampaign) => void;
  showToast: (m: string, t?: 'success' | 'info' | 'warning' | 'error') => void;
}> = ({ overview, pickers, reload, onEdit, onDuplicate, showToast }) => {
  const [filter, setFilter] = useState<'all' | PushStatus>('all');
  const [detail, setDetail] = useState<{ notification: PushCampaign; failureReasons: Record<string, number>; readInApp: number } | null>(null);
  const [confirmSend, setConfirmSend] = useState<PushCampaign | null>(null);
  const names = useMemo(() => {
    const m = new Map<string, string>();
    [...pickers.courses, ...pickers.bundles, ...pickers.offers].forEach((p) => m.set(p.id, p.title));
    return m;
  }, [pickers]);
  const list = (overview?.notifications || []).filter((n) => filter === 'all' || n.status === filter);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      showToast(ok, 'success');
      reload();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const audienceText = (n: PushCampaign) =>
    n.audience === 'course_students' ? `Course: ${names.get(n.audience_course_id || '') || '—'}` : n.audience === 'bundle_buyers' ? `Bundle: ${names.get(n.audience_bundle_id || '') || '—'}` : AUDIENCE_LABEL[n.audience];

  return (
    <section className="bg-white rounded-[20px] border border-[#E2E8F0] overflow-hidden">
      <div className="flex flex-wrap gap-2 p-4 border-b border-[#EEF2F7]">
        {(['all', 'scheduled', 'pending_review', 'draft', 'sent', 'failed', 'cancelled'] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`ed-btn ed-btn-sm ${filter === s ? 'ed-btn-ink' : 'ed-btn-text'}`}>
            {s === 'all' ? 'All' : STATUS_LABEL[s]}{s !== 'all' && overview ? ` (${overview.counts[s]})` : ''}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[14.5px]">
          <thead className="bg-[#F7F9FC] text-[12.5px] uppercase tracking-wide text-[#64748B]">
            <tr><th className="px-5 py-3">Notification</th><th className="px-5 py-3">Audience</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">When</th><th className="px-5 py-3 text-right">Results</th><th className="px-5 py-3" /></tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2F7]">
            {list.map((n) => (
              <tr key={n.id} className="align-top">
                <td className="px-5 py-3 max-w-[340px]">
                  <div className="font-semibold text-[#111827] truncate">{n.title}</div>
                  <div className="text-[13px] text-[#64748B] line-clamp-2">{n.body}</div>
                  <div className="text-[12px] text-[#94A3B8] mt-1">{CATEGORY_LABEL[n.category]}{n.source !== 'manual' ? ` · ${n.source === 'offer' ? 'Offer' : 'Automatic'}` : ''}</div>
                </td>
                <td className="px-5 py-3 text-[13.5px] text-[#334155]">{audienceText(n)}</td>
                <td className="px-5 py-3"><StatusPill status={n.status} />{n.last_error && <div className="text-[12px] text-[#64748B] mt-1 max-w-[220px]">{n.last_error}</div>}</td>
                <td className="px-5 py-3 text-[13.5px] text-[#334155] whitespace-nowrap">
                  {n.sent_at ? <>Sent {fmtDateTime(n.sent_at)}</> : n.scheduled_at && ['scheduled', 'pending_review', 'sending'].includes(n.status) ? <><Clock className="inline w-3.5 h-3.5" /> {fmtDateTime(n.scheduled_at)}</> : <>Created {fmtDateTime(n.created_at)}</>}
                </td>
                <td className="px-5 py-3 text-right text-[13px] tabular-nums whitespace-nowrap">
                  {['sent', 'failed'].includes(n.status) ? (
                    <div className="space-y-0.5">
                      <div>{n.target_count} students · {n.device_count} devices</div>
                      <div className="text-emerald-700">{n.tickets_ok} accepted{n.receipts_ok ? ` · ${n.receipts_ok} handed off` : ''}</div>
                      {(n.tickets_failed > 0 || n.receipts_failed > 0) && <div className="text-rose-600">{n.tickets_failed + n.receipts_failed} failed</div>}
                    </div>
                  ) : '—'}
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  <button title="Details" onClick={() => pushAdmin.detail(n.id).then(setDetail).catch((e) => showToast(e.message, 'error'))} className="ed-btn ed-btn-text ed-btn-sm"><Eye className="w-4 h-4" /></button>
                  {['draft', 'pending_review', 'scheduled'].includes(n.status) && (
                    <>
                      <button title="Edit" onClick={() => onEdit(n)} className="ed-btn ed-btn-text ed-btn-sm"><Pencil className="w-4 h-4" /></button>
                      <button title="Send now" onClick={() => setConfirmSend(n)} className="ed-btn ed-btn-text ed-btn-sm !text-[#004AAD]"><Send className="w-4 h-4" /></button>
                      <button title="Cancel" onClick={() => window.confirm('Cancel this notification? It will not be sent.') && act(() => pushAdmin.cancel(n.id), 'Notification cancelled')} className="ed-btn ed-btn-text ed-btn-sm !text-amber-700"><Ban className="w-4 h-4" /></button>
                    </>
                  )}
                  <button title="Duplicate" onClick={() => onDuplicate(n)} className="ed-btn ed-btn-text ed-btn-sm"><Copy className="w-4 h-4" /></button>
                  {['draft', 'cancelled'].includes(n.status) && (
                    <button title="Delete" onClick={() => window.confirm('Delete this notification?') && act(() => pushAdmin.remove(n.id), 'Deleted')} className="ed-btn ed-btn-text ed-btn-sm !text-rose-600"><Trash2 className="w-4 h-4" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <EmptyState title="Nothing here yet" body="Notifications you create, and automatic announcements for new courses and bundles, appear here." />}
      </div>

      {detail && (
        <Dialog title={detail.notification.title} onClose={() => setDetail(null)}>
          <div className="grid sm:grid-cols-[1fr_260px] gap-6">
            <div>
              <div className="flex gap-2 items-center"><StatusPill status={detail.notification.status} /><span className="text-[13px] text-[#64748B]">{CATEGORY_LABEL[detail.notification.category]}</span></div>
              <ResultGrid n={detail.notification} />
              <p className="mt-3 text-[14px] text-[#334155]"><b>{detail.readInApp}</b> students opened it in the app’s notification centre.</p>
              {Object.keys(detail.failureReasons).length > 0 && (
                <div className="mt-4">
                  <div className="text-[14px] font-semibold text-[#111827]">Failure reasons</div>
                  <ul className="mt-1 text-[13.5px] text-[#334155] list-disc pl-5">
                    {Object.entries(detail.failureReasons).map(([k, v]) => <li key={k}>{k} — {v}</li>)}
                  </ul>
                </div>
              )}
              <p className="mt-4 text-[12.5px] text-[#64748B]">
                “Accepted by Expo” means Expo’s push service received the message. “Handed to Google/Apple” comes from Expo receipts (checked ~15 minutes after sending).
                Android doesn’t report whether the notification was displayed, so delivery to the screen isn’t counted.
              </p>
            </div>
            <AndroidPreview title={detail.notification.title} body={detail.notification.body} image={detail.notification.image_url} />
          </div>
        </Dialog>
      )}

      {confirmSend && (
        <Dialog title="Send this notification now?" onClose={() => setConfirmSend(null)}>
          <p className="text-[15px] text-[#334155]">“{confirmSend.title}” → {audienceText(confirmSend)}.</p>
          {confirmSend.audience === 'all_students' && <p className="mt-3 p-3 rounded-xl bg-amber-50 text-amber-900 text-[15px]">This goes to every registered student and can’t be recalled.</p>}
          <div className="flex justify-end gap-3 mt-6">
            <button className="ed-btn ed-btn-outlined ed-btn-sm" onClick={() => setConfirmSend(null)}>Back</button>
            <button className="ed-btn ed-btn-filled ed-btn-sm" onClick={() => { const n = confirmSend; setConfirmSend(null); act(() => pushAdmin.sendNow(n.id, true), 'Sending started'); }}>Yes, send now</button>
          </div>
        </Dialog>
      )}
    </section>
  );
};

/* ================================================================== Automation */
const Automation: React.FC<{ initial: Partial<PushSettings>; onSaved: () => void; showToast: (m: string, t?: 'success' | 'info' | 'warning' | 'error') => void }> = ({ initial, onSaved, showToast }) => {
  const [s, setS] = useState<PushSettings>({
    auto_course_enabled: initial.auto_course_enabled !== false,
    auto_bundle_enabled: initial.auto_bundle_enabled !== false,
    auto_requires_review: initial.auto_requires_review === true,
    auto_audience: initial.auto_audience === 'enrolled_students' ? 'enrolled_students' : 'all_students',
    auto_delay_minutes: initial.auto_delay_minutes ?? 2,
  });
  const [saving, setSaving] = useState(false);
  const [testTitle, setTestTitle] = useState('Edufy test notification');
  const [testBody, setTestBody] = useState('Push notifications are working on this device.');
  const [testing, setTesting] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await pushAdmin.saveSettings(s);
      showToast('Automation settings saved', 'success');
      onSaved();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };
  const test = async () => {
    setTesting(true);
    try {
      const r = await pushAdmin.test(testTitle, testBody);
      showToast(r.accepted ? `Sent to ${r.accepted} of your ${r.devices} device(s)` : `Not accepted: ${r.error || 'unknown error'}`, r.accepted ? 'success' : 'error');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setTesting(false);
    }
  };
  const toggle = (k: keyof PushSettings, label: string, hint: string) => (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" className="w-5 h-5 mt-0.5" checked={!!s[k]} onChange={(e) => setS({ ...s, [k]: e.target.checked })} />
      <span><span className="block text-[16px] font-semibold text-[#111827]">{label}</span><span className="block text-[14px] text-[#64748B]">{hint}</span></span>
    </label>
  );

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <section className="bg-white rounded-[20px] border border-[#E2E8F0] p-6 space-y-5">
        <h2 className="font-display text-[20px] font-bold text-[#111827] flex items-center gap-2"><Settings2 className="w-5 h-5 text-[#5E17EB]" /> Automatic announcements</h2>
        {toggle('auto_course_enabled', 'Announce new courses', 'When a course is published for the first time, students get “New Course Available!” with the course thumbnail and a link to it.')}
        {toggle('auto_bundle_enabled', 'Announce new bundles', 'When a bundle is published for the first time, students get “New Course Bundle Available!”.')}
        {toggle('auto_requires_review', 'Review before sending', 'Automatic announcements wait in History as “Needs review” until you send them.')}
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Audience</span>
            <select className="ed-field mt-1.5" value={s.auto_audience} onChange={(e) => setS({ ...s, auto_audience: e.target.value as PushSettings['auto_audience'] })}>
              <option value="all_students">All registered students</option>
              <option value="enrolled_students">All enrolled students</option>
            </select></label>
          <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Delay after publishing (minutes)</span>
            <input type="number" min={0} max={1440} className="ed-field mt-1.5" value={s.auto_delay_minutes} onChange={(e) => setS({ ...s, auto_delay_minutes: Number(e.target.value) })} /></label>
        </div>
        <p className="text-[13.5px] text-[#64748B]">Each course or bundle is announced once. Editing, re-saving, or unpublishing and republishing never sends it again. If it’s unpublished before the delay ends, the announcement is cancelled.</p>
        <button onClick={save} disabled={saving} className="ed-btn ed-btn-filled ed-btn-sm"><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save settings'}</button>
      </section>

      <section className="bg-white rounded-[20px] border border-[#E2E8F0] p-6 space-y-4">
        <h2 className="font-display text-[20px] font-bold text-[#111827] flex items-center gap-2"><Smartphone className="w-5 h-5 text-[#004AAD]" /> Test on your phone</h2>
        <p className="text-[14.5px] text-[#64748B]">Sends only to devices signed in with <b>your</b> admin account in the Edufy app (a development or production build — Expo Go can’t receive push notifications).</p>
        <input className="ed-field" value={testTitle} maxLength={65} onChange={(e) => setTestTitle(e.target.value)} />
        <textarea rows={2} className="ed-field !h-auto py-3" value={testBody} maxLength={240} onChange={(e) => setTestBody(e.target.value)} />
        <button onClick={test} disabled={testing} className="ed-btn ed-btn-tonal ed-btn-sm"><Send className="w-4 h-4" /> {testing ? 'Sending…' : 'Send test to my devices'}</button>
      </section>
    </div>
  );
};
