import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, ArrowUp, ArrowDown, ExternalLink, Smartphone, Monitor, Send } from 'lucide-react';
import { Card, FieldDef, FieldGrid, Note, PanelHeader, PanelProps, SaveBar, useSectionForm } from './settingsKit';
import { ImageField } from '../../../components/admin/MediaLibrary';
import { SOCIAL_ICONS } from '../../../config/social';
import { maintenanceActive, waHref } from '../../../config/siteSettings';
import { pushAdmin, PushSettings, newKey } from '../../../services/pushAdmin';
import { useCartWishlist } from '../../../context/CartWishlistContext';

/* ------------------------------------------------------------------ General */
const GENERAL: FieldDef[] = [
  { key: 'siteName', label: 'Website name', kind: 'text', max: 60 },
  { key: 'appName', label: 'App name', kind: 'text', max: 40, hint: 'Shown inside the app. The name under the phone icon changes only with a new app build.' },
  { key: 'siteUrl', label: 'Website URL', kind: 'url', max: 200, hint: 'Used in emails and links, e.g. https://edufyacademy.com' },
  { key: 'defaultCountryCode', label: 'Default country code', kind: 'text', max: 5, placeholder: '+91' },
  { key: 'companyName', label: 'Company name', kind: 'text', max: 120 },
  { key: 'tagline', label: 'Tagline (under the logo)', kind: 'text', max: 60 },
  { key: 'companyAddress', label: 'Company address', kind: 'longtext', max: 300, wide: true },
  { key: 'description', label: 'Website description (footer)', kind: 'longtext', max: 300, wide: true },
  { key: 'copyright', label: 'Footer copyright text', kind: 'text', max: 160, wide: true, hint: '{year} is replaced with the current year.' },
];

export const GeneralPanel: React.FC<PanelProps> = ({ value, onSaved }) => {
  const f = useSectionForm('general', value, onSaved);
  return (
    <div>
      <PanelHeader title="General settings" description="Names and business details used across the website, emails and the student app." />
      <Card><FieldGrid fields={GENERAL} draft={f.draft} errors={f.errors} set={f.set} /></Card>
      <div className="mt-5"><Note>Phone numbers and emails are managed in <Link className="font-semibold underline" to="/admin/settings/contact">Contact information</Link>; the WhatsApp number is in <Link className="font-semibold underline" to="/admin/settings/whatsapp">WhatsApp settings</Link>.</Note></div>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => f.save()} onReset={f.reset} savedAt={f.savedAt} />
    </div>
  );
};

/* ------------------------------------------------------------------ Branding */
const LOGOS: { key: string; label: string; hint: string; dark?: boolean; rebuild?: string }[] = [
  { key: 'logoMain', label: 'Main logo', hint: 'Fallback for every place below. Square PNG/SVG, 512×512 recommended.' },
  { key: 'logoLight', label: 'Logo for light backgrounds', hint: 'Header and admin panel.' },
  { key: 'logoDark', label: 'Logo for dark backgrounds', hint: 'Footer and dark sections.', dark: true },
  { key: 'loginLogo', label: 'Login page logo', hint: 'Sign-in, registration and password pages.' },
  { key: 'appLogo', label: 'Mobile app logo', hint: 'Logo inside the app (headers, profile).', rebuild: 'The phone home-screen icon needs a new app build.' },
  { key: 'splashLogo', label: 'Splash screen logo', hint: 'Animated loading screen after the app opens.', dark: true, rebuild: 'The very first native splash frame needs a new app build.' },
  { key: 'favicon', label: 'Favicon', hint: 'Browser tab icon. Square PNG or ICO, 64×64 or larger.' },
  { key: 'emailLogo', label: 'Email header logo', hint: 'Top of transactional emails. PNG works in every email client (avoid SVG).' },
];

export const BrandingPanel: React.FC<PanelProps> = ({ value, onSaved }) => {
  const f = useSectionForm('branding', value, onSaved);
  return (
    <div>
      <PanelHeader title="Branding & logo" description="Upload a logo to replace it everywhere. Leave a slot empty to use the main logo, and the main logo empty to use the built-in official logo." />
      <Card>
        <div className="grid md:grid-cols-2 gap-6">
          {LOGOS.map((l) => (
            <div key={l.key}>
              <ImageField label={l.label} hint={l.hint} value={f.draft?.[l.key] || ''} onChange={(u) => f.set(l.key, u)} assetType="logo" error={f.errors[l.key]} dark={l.dark} />
              {l.rebuild && <p className="mt-1.5 text-[12.5px] text-amber-700">{l.rebuild}</p>}
            </div>
          ))}
        </div>
      </Card>
      <div className="mt-5">
        <Note tone="warn">
          <strong>Needs a new app build:</strong> the phone home-screen icon, the adaptive icon, the notification icon and the first native splash frame are compiled into the app
          (<code>app/assets/images</code>). Everything else on this page updates the website immediately and the app within a few minutes.
        </Note>
      </div>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => f.save()} onReset={f.reset} savedAt={f.savedAt} />
    </div>
  );
};

/* ------------------------------------------------------------------ Contact */
const CONTACT: FieldDef[] = [
  { key: 'primaryPhone', label: 'Primary phone', kind: 'phone', hint: 'With country code' },
  { key: 'secondaryPhone', label: 'Secondary phone', kind: 'phone' },
  { key: 'supportEmail', label: 'Support email', kind: 'email' },
  { key: 'salesEmail', label: 'Sales email', kind: 'email' },
  { key: 'businessHours', label: 'Business hours', kind: 'text', max: 120, placeholder: 'Mon–Sat, 9:30 am – 6:30 pm IST' },
  { key: 'mapsUrl', label: 'Google Maps URL', kind: 'url', max: 500 },
  { key: 'address', label: 'Office address', kind: 'longtext', max: 300, wide: true },
  { key: 'pageTitle', label: 'Contact page title', kind: 'text', max: 80 },
  { key: 'pageIntro', label: 'Contact page introduction', kind: 'longtext', max: 400, wide: true },
];

export const ContactPanel: React.FC<PanelProps> = ({ value, onSaved }) => {
  const f = useSectionForm('contact', value, onSaved);
  return (
    <div>
      <PanelHeader title="Contact information" description="Shown in the website footer, the contact page, the maintenance page and the app’s support section." />
      <Card><FieldGrid fields={CONTACT} draft={f.draft} errors={f.errors} set={f.set} /></Card>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => f.save()} onReset={f.reset} savedAt={f.savedAt} extra={<a href="/contact" target="_blank" rel="noreferrer" className="ed-btn ed-btn-text ed-btn-sm"><ExternalLink className="w-4 h-4" /> View contact page</a>} />
    </div>
  );
};

/* ------------------------------------------------------------------ Social */
const PLATFORMS = ['facebook', 'instagram', 'youtube', 'linkedin', 'x', 'reddit', 'pinterest', 'telegram', 'whatsapp', 'custom'];
const PLATFORM_LABEL: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', linkedin: 'LinkedIn', x: 'X (Twitter)', reddit: 'Reddit', pinterest: 'Pinterest', telegram: 'Telegram', whatsapp: 'WhatsApp', custom: 'Other' };

export const SocialPanel: React.FC<PanelProps> = ({ value, onSaved }) => {
  const f = useSectionForm('social', value, onSaved);
  const links: any[] = f.draft?.links || [];
  const setLinks = (next: any[]) => f.setDraft({ links: next.map((l, i) => ({ ...l, position: i })) });
  const update = (i: number, patch: any) => setLinks(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= links.length) return;
    const next = [...links];
    [next[i], next[j]] = [next[j], next[i]];
    setLinks(next);
  };
  return (
    <div>
      <PanelHeader title="Social media links" description="Enabled links appear in the website footer and the app’s profile screen, in this order.">
        <button onClick={() => setLinks([...links, { id: `custom-${Date.now().toString(36)}`, platform: 'custom', label: 'New link', url: '', icon: '', enabled: false, position: links.length }])} className="ed-btn ed-btn-tonal ed-btn-sm"><Plus className="w-4 h-4" /> Add platform</button>
      </PanelHeader>
      <div className="space-y-3">
        {links.map((l, i) => {
          const icon = SOCIAL_ICONS[l.platform] || SOCIAL_ICONS.custom;
          const err = f.errors[`links.${i}.url`] || f.errors[`links.${i}.icon`];
          return (
            <div key={l.id} className={`bg-white rounded-2xl border p-4 ${err ? 'border-rose-300' : 'border-[#E2E8F0]'}`}>
              <div className="grid lg:grid-cols-[auto_150px_170px_1fr_auto] gap-3 items-center">
                <span className="w-10 h-10 rounded-full bg-[#0B1220] text-white flex items-center justify-center"><svg viewBox={icon.viewBox} className="w-4 h-4" fill="currentColor" aria-hidden="true"><path d={icon.path} /></svg></span>
                <select className="ed-field" value={l.platform} onChange={(e) => update(i, { platform: e.target.value, label: l.label === PLATFORM_LABEL[l.platform] ? PLATFORM_LABEL[e.target.value] : l.label })} aria-label="Platform">
                  {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
                </select>
                <input className="ed-field" value={l.label} maxLength={40} onChange={(e) => update(i, { label: e.target.value })} aria-label="Label" placeholder="Label" />
                <input className="ed-field" value={l.url} maxLength={300} onChange={(e) => update(i, { url: e.target.value })} aria-label="Profile URL" placeholder="https://…" />
                <div className="flex items-center gap-1">
                  <label className="flex items-center gap-2 px-2 text-[14px] font-medium"><input type="checkbox" className="w-5 h-5" checked={!!l.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} /> On</label>
                  <button onClick={() => move(i, -1)} className="p-2 rounded hover:bg-[#F1F5F9]" aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
                  <button onClick={() => move(i, 1)} className="p-2 rounded hover:bg-[#F1F5F9]" aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
                  <button onClick={() => window.confirm(`Remove ${l.label}?`) && setLinks(links.filter((_, j) => j !== i))} className="p-2 rounded hover:bg-rose-50 text-rose-600" aria-label="Remove"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {l.platform === 'custom' && (
                <div className="mt-3"><ImageField label="Custom icon (optional)" value={l.icon || ''} onChange={(u) => update(i, { icon: u })} assetType="logo" previewClass="h-14" /></div>
              )}
              {err && <p className="mt-2 text-[13px] text-rose-600">{err}</p>}
            </div>
          );
        })}
      </div>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => f.save()} onReset={f.reset} savedAt={f.savedAt} />
    </div>
  );
};

/* ------------------------------------------------------------------ SEO */
const SEO: FieldDef[] = [
  { key: 'title', label: 'Website title', kind: 'text', max: 70, hint: 'Browser tab and search results (home page).' },
  { key: 'robots', label: 'Search engine indexing', kind: 'select', options: [{ value: 'index,follow', label: 'Allow search engines (recommended)' }, { value: 'noindex,nofollow', label: 'Hide from search engines (staging / test site)' }] },
  { key: 'description', label: 'Meta description', kind: 'longtext', max: 170, wide: true },
  { key: 'keywords', label: 'Default keywords', kind: 'text', max: 300, wide: true, hint: 'Comma separated.' },
  { key: 'gaId', label: 'Google Analytics ID', kind: 'text', max: 20, placeholder: 'G-XXXXXXXXXX' },
  { key: 'gscVerification', label: 'Google Search Console verification code', kind: 'text', max: 100, hint: 'Only the content="…" value of the meta tag.' },
];

export const SeoPanel: React.FC<PanelProps> = ({ value, onSaved }) => {
  const f = useSectionForm('seo', value, onSaved);
  return (
    <div>
      <PanelHeader title="SEO settings" description="Default title, description and sharing image. Individual pages (courses, blog posts) still set their own." />
      <Card>
        <FieldGrid fields={SEO} draft={f.draft} errors={f.errors} set={f.set} />
        <div className="mt-6"><ImageField label="Social sharing image (Open Graph)" hint="1200×630 PNG/JPG. Shown when the site is shared on WhatsApp, Facebook, LinkedIn…" value={f.draft?.ogImage || ''} onChange={(u) => f.set('ogImage', u)} assetType="seo" error={f.errors.ogImage} previewClass="h-28" /></div>
        <p className="mt-4 text-[13px] text-[#64748B]">Favicon: Branding & logo. These IDs are public by design; never paste private keys or passwords here.</p>
      </Card>
      <div className="mt-5"><Note>When the Node.js server serves the website, these tags are written into the page HTML for crawlers and <code>/robots.txt</code> follows the indexing choice. On static hosting (public_html) they are applied in the browser. For Search Console, use DNS verification there.</Note></div>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => f.save()} onReset={f.reset} savedAt={f.savedAt} />
    </div>
  );
};

/* ------------------------------------------------------------------ App configuration */
const APP_SUPPORT: FieldDef[] = [
  { key: 'supportPhone', label: 'App support phone', kind: 'phone', hint: 'Empty = primary contact phone' },
  { key: 'supportEmail', label: 'App support email', kind: 'email', hint: 'Empty = support email' },
  { key: 'whatsappNumber', label: 'App WhatsApp number', kind: 'phone', hint: 'Empty = WhatsApp settings number' },
  { key: 'helpUrl', label: 'Help URL', kind: 'url', hint: 'Empty = website /faq' },
  { key: 'supportUrl', label: 'Support URL', kind: 'url' },
];
const APP_SECTIONS: FieldDef[] = [
  { key: 'showFeaturedCourses', label: 'Featured courses on Home', kind: 'bool' },
  { key: 'showOffers', label: 'Offers on Home', kind: 'bool' },
  { key: 'showBundles', label: 'Bundles on Home', kind: 'bool' },
  { key: 'showBlog', label: '“From the blog” on Home', kind: 'bool' },
  { key: 'showSocialLinks', label: 'Social links on Profile', kind: 'bool' },
];
const APP_NOTICE: FieldDef[] = [
  { key: 'noticeEnabled', label: 'Show a notice bar on Home', kind: 'bool' },
  { key: 'noticeText', label: 'Notice text', kind: 'longtext', max: 240, wide: true },
];
const APP_VERSION: FieldDef[] = [
  { key: 'latestVersion', label: 'Latest version', kind: 'version', hint: 'Older apps see a friendly “update available” message.' },
  { key: 'minVersion', label: 'Minimum supported version', kind: 'version', hint: 'Older apps must update before continuing.' },
  { key: 'forceUpdateMessage', label: 'Force update message', kind: 'longtext', max: 240, wide: true },
  { key: 'androidStoreUrl', label: 'Google Play URL', kind: 'url', max: 300 },
  { key: 'iosStoreUrl', label: 'App Store URL', kind: 'url', max: 300 },
];

export const AppConfigPanel: React.FC<PanelProps> = ({ value, onSaved }) => {
  const f = useSectionForm('app', value, onSaved);
  return (
    <div>
      <PanelHeader title="Mobile app configuration" description="The app downloads these settings from the server, caches them on the phone and refreshes them when it opens." />
      <div className="space-y-5">
        <Card title="Support & help"><FieldGrid fields={APP_SUPPORT} draft={f.draft} errors={f.errors} set={f.set} /></Card>
        <Card title="Home & profile sections"><FieldGrid fields={APP_SECTIONS} draft={f.draft} errors={f.errors} set={f.set} /></Card>
        <Card title="App notice"><FieldGrid fields={APP_NOTICE} draft={f.draft} errors={f.errors} set={f.set} /></Card>
        <Card title="Versions & updates" description="Current app version is in app/app.config.ts (version). Set the minimum only after the new version is live in the store.">
          <FieldGrid fields={APP_VERSION} draft={f.draft} errors={f.errors} set={f.set} />
        </Card>
        <Note tone="warn"><strong>Needs a new app build:</strong> app icon, package name (com.edufyacademy.student), signing key, native splash image, permissions and the app version number itself.</Note>
      </div>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => f.save()} onReset={f.reset} savedAt={f.savedAt} />
    </div>
  );
};

/* ------------------------------------------------------------------ WhatsApp (public part) */
const WHATSAPP: FieldDef[] = [
  { key: 'enabled', label: 'Show the floating WhatsApp button on the website', kind: 'bool', wide: true },
  { key: 'number', label: 'WhatsApp Business number', kind: 'phone', hint: 'With country code' },
  { key: 'buttonText', label: 'Floating button text', kind: 'text', max: 60 },
  { key: 'welcomeMessage', label: 'Default welcome message', kind: 'longtext', max: 300, wide: true, hint: 'Pre-filled when a visitor taps the button.' },
  { key: 'supportMessage', label: 'Support message', kind: 'longtext', max: 300, wide: true, hint: 'Pre-filled from the app’s support screen and the maintenance page.' },
];

export const WhatsAppFields: React.FC<PanelProps> = ({ value, onSaved }) => {
  const f = useSectionForm('whatsapp', value, onSaved);
  const link = waHref(f.draft?.number || '', f.draft?.welcomeMessage);
  return (
    <Card title="WhatsApp button & messages">
      <FieldGrid fields={WHATSAPP} draft={f.draft} errors={f.errors} set={f.set} />
      {link && <a href={link} target="_blank" rel="noreferrer" className="mt-4 inline-flex ed-btn ed-btn-text ed-btn-sm"><ExternalLink className="w-4 h-4" /> Test this link</a>}
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => f.save()} onReset={f.reset} savedAt={f.savedAt} />
    </Card>
  );
};

/* ------------------------------------------------------------------ Notifications */
const NOTIF: FieldDef[] = [
  { key: 'pushEnabled', label: 'Push notifications enabled', kind: 'bool', wide: true, hint: 'Off = nothing is sent; queued notifications wait until you turn it back on.' },
  { key: 'promotionalEnabled', label: 'Promotional notifications (custom campaigns)', kind: 'bool' },
  { key: 'offersEnabled', label: 'Offer & discount notifications', kind: 'bool' },
  { key: 'maintenanceAnnouncements', label: 'Allow maintenance announcements', kind: 'bool' },
  { key: 'defaultTitle', label: 'Default notification title', kind: 'text', max: 65 },
  { key: 'defaultBody', label: 'Default notification content', kind: 'longtext', max: 240, wide: true },
];

export const NotificationsPanel: React.FC<PanelProps> = ({ value, onSaved }) => {
  const f = useSectionForm('notifications', value, onSaved);
  const { showToast } = useCartWishlist();
  const [auto, setAuto] = useState<Partial<PushSettings> | null>(null);
  const [autoErr, setAutoErr] = useState<string | null>(null);
  useEffect(() => {
    pushAdmin.overview().then((o) => setAuto(o.settings || {})).catch((e) => setAutoErr(e.message));
  }, []);
  const saveAuto = async (patch: Partial<PushSettings>) => {
    const next = { auto_course_enabled: true, auto_bundle_enabled: true, auto_requires_review: false, auto_audience: 'all_students', auto_delay_minutes: 0, ...auto, ...patch } as PushSettings;
    try {
      const r = await pushAdmin.saveSettings(next);
      setAuto(r.settings);
      showToast('Automatic announcement settings saved', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };
  return (
    <div>
      <PanelHeader title="Notification settings" description={<>Uses the existing push system, device registrations and history. Write and schedule notifications in <Link className="font-semibold underline" to="/admin/notifications">Push notifications</Link>.</>} />
      <div className="space-y-5">
        <Card><FieldGrid fields={NOTIF} draft={f.draft} errors={f.errors} set={f.set} /></Card>
        <Card title="Automatic announcements" description="Sent when a course or bundle is published (same switches as on the Push notifications page).">
          {autoErr && <Note tone="warn">{autoErr}</Note>}
          {auto && (
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-3"><input type="checkbox" className="w-5 h-5" checked={auto.auto_course_enabled !== false} onChange={(e) => saveAuto({ auto_course_enabled: e.target.checked })} /> New course announcements</label>
              <label className="flex items-center gap-3"><input type="checkbox" className="w-5 h-5" checked={auto.auto_bundle_enabled !== false} onChange={(e) => saveAuto({ auto_bundle_enabled: e.target.checked })} /> New bundle announcements</label>
            </div>
          )}
        </Card>
      </div>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => f.save()} onReset={f.reset} savedAt={f.savedAt} />
    </div>
  );
};

/* ------------------------------------------------------------------ Maintenance */
const MAINT: FieldDef[] = [
  { key: 'websiteEnabled', label: 'Website maintenance mode', kind: 'bool', hint: 'Visitors see the maintenance page. Admins and the sign-in page stay available.' },
  { key: 'appEnabled', label: 'App maintenance announcement', kind: 'bool', hint: 'The app shows the message with “Try again” and “Continue” (never a hard lock).' },
  { key: 'title', label: 'Title', kind: 'text', max: 80 },
  { key: 'showContact', label: 'Show support contact details', kind: 'bool' },
  { key: 'message', label: 'Message', kind: 'longtext', max: 500, wide: true },
  { key: 'startsAt', label: 'Starts at (optional)', kind: 'datetime', hint: 'Empty = immediately' },
  { key: 'endsAt', label: 'Ends at (optional)', kind: 'datetime', hint: 'Turns off automatically' },
];

export const MaintenancePanel: React.FC<PanelProps> = ({ value, onSaved }) => {
  const f = useSectionForm('maintenance', value, onSaved);
  const { showToast } = useCartWishlist();
  const [sending, setSending] = useState(false);
  const liveWeb = maintenanceActive(value || {}, 'website');
  const liveApp = maintenanceActive(value || {}, 'app');
  const announce = async () => {
    if (!window.confirm('Send this maintenance message as a push notification to all students now?')) return;
    setSending(true);
    try {
      await pushAdmin.create(
        { title: (f.draft.title || 'Scheduled maintenance').slice(0, 65), body: (f.draft.message || '').slice(0, 240), imageUrl: '', actionUrl: '', category: 'announcement' as any, courseId: '', bundleId: '', offerId: '', audience: 'all_students' as any, audienceCourseId: '', audienceBundleId: '' },
        { mode: 'now', confirmed: true, idempotencyKey: newKey() }
      );
      showToast('Maintenance announcement queued. Track it in Push notifications.', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSending(false);
    }
  };
  return (
    <div>
      <PanelHeader title="Maintenance mode" description="Turn on a maintenance page for the website and/or an announcement in the app, now or on a schedule." />
      <div className="flex flex-wrap gap-2 mb-5">
        <span className={`px-3 h-8 inline-flex items-center gap-2 rounded-full text-[14px] font-semibold ${liveWeb ? 'bg-amber-100 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`}><Monitor className="w-4 h-4" /> Website: {liveWeb ? 'MAINTENANCE' : 'live'}</span>
        <span className={`px-3 h-8 inline-flex items-center gap-2 rounded-full text-[14px] font-semibold ${liveApp ? 'bg-amber-100 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`}><Smartphone className="w-4 h-4" /> App: {liveApp ? 'ANNOUNCEMENT ON' : 'normal'}</span>
      </div>
      <Card><FieldGrid fields={MAINT} draft={f.draft} errors={f.errors} set={f.set} /></Card>
      <div className="mt-5 grid lg:grid-cols-2 gap-5">
        <Card title="Preview">
          <div className="rounded-2xl bg-[#F7F9FC] border border-[#E2E8F0] p-6 text-center">
            <div className="font-display text-[22px] font-extrabold text-[#111827]">{f.draft?.title || 'We’ll be back soon'}</div>
            <p className="mt-2 text-[15px] text-[#475569] whitespace-pre-line">{f.draft?.message}</p>
          </div>
        </Card>
        <Card title="Tell app users" description="Optional: send the message as a push notification (uses the existing notification system).">
          <button onClick={announce} disabled={sending || !f.draft?.message} className="ed-btn ed-btn-tonal ed-btn-sm"><Send className="w-4 h-4" /> {sending ? 'Sending…' : 'Send maintenance announcement'}</button>
        </Card>
      </div>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => f.save()} onReset={f.reset} savedAt={f.savedAt} />
    </div>
  );
};
