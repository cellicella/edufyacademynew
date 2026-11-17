import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Globe, Palette, Monitor, Smartphone, Images, Phone, Share2, CreditCard, MessageCircle, Mail, Search, Settings2, Bell, Wrench, History, Users, RefreshCw,
  FileText, LogIn, KeyRound, Server,
} from 'lucide-react';
import { AdminSettingsResponse, CredentialView, Section, settingsAdmin } from '../../../services/settingsAdmin';
import { AppConfigPanel, BrandingPanel, ContactPanel, GeneralPanel, MaintenancePanel, NotificationsPanel, SeoPanel, SocialPanel } from './panelsBasic';
import { PaymentPanel, WhatsAppPanel } from './panelsSecure';
import { AuthMethodsPanel, DomainPanel, EmailTemplatesPanel, GoogleOAuthPanel, SmtpPanel } from './panelsEmailAuth';
import { Card, Note, PanelHeader, fmtWhen } from './settingsKit';
import { MediaLibrary } from '../../../components/admin/MediaLibrary';
import { CloudinaryPanel } from './CloudinaryPanel';
import { AdminBannersPage } from '../AdminBannersPage';
import { useCartWishlist } from '../../../context/CartWishlistContext';

const NAV: { id: string; label: string; icon: React.ElementType; perm: string }[] = [
  { id: 'general', label: 'General', icon: Globe, perm: 'general' },
  { id: 'branding', label: 'Branding & Logo', icon: Palette, perm: 'branding' },
  { id: 'website-banners', label: 'Website Banner Manager', icon: Monitor, perm: 'banners' },
  { id: 'app-banners', label: 'Mobile App Banner Manager', icon: Smartphone, perm: 'banners' },
  { id: 'media', label: 'Media Library', icon: Images, perm: 'media' },
  { id: 'contact', label: 'Contact', icon: Phone, perm: 'contact' },
  { id: 'social', label: 'Social Media', icon: Share2, perm: 'social' },
  { id: 'payment', label: 'Payment Gateway', icon: CreditCard, perm: 'payment' },
  { id: 'whatsapp', label: 'WhatsApp / Emovur', icon: MessageCircle, perm: 'whatsapp' },
  { id: 'smtp', label: 'SMTP & Email Configuration', icon: Mail, perm: 'email' },
  { id: 'email-templates', label: 'Email Templates', icon: FileText, perm: 'email' },
  { id: 'auth', label: 'Authentication & Login Methods', icon: LogIn, perm: 'super' },
  { id: 'google', label: 'Google OAuth Configuration', icon: KeyRound, perm: 'super' },
  { id: 'domain', label: 'Domain & Environment', icon: Server, perm: 'super' },
  { id: 'seo', label: 'SEO', icon: Search, perm: 'seo' },
  { id: 'app', label: 'Mobile App Configuration', icon: Settings2, perm: 'app' },
  { id: 'notifications', label: 'Push Notification Settings', icon: Bell, perm: 'notifications' },
  { id: 'maintenance', label: 'Maintenance Mode', icon: Wrench, perm: 'maintenance' },
  { id: 'permissions', label: 'Security & Admin Permissions', icon: Users, perm: 'super' },
  { id: 'audit', label: 'Configuration Audit Logs', icon: History, perm: 'audit' },
];
/** Old links (before the menu was reorganised) */
const LEGACY: Record<string, string> = { email: 'smtp' };

export const AdminSettingsPage: React.FC = () => {
  const { section: rawSection = 'general' } = useParams();
  const section = LEGACY[rawSection] || rawSection;
  const navigate = useNavigate();
  const [data, setData] = useState<AdminSettingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await settingsAdmin.load());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const can = (perm: string) => !!data && (perm === 'super' ? data.access.superAdmin : data.access.sections.includes(perm));
  const visible = NAV.filter((n) => can(n.perm));
  const current = NAV.find((n) => n.id === section) || NAV[0];

  useEffect(() => {
    if (data && !can(current.perm) && visible[0]) navigate(`/admin/settings/${visible[0].id}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, section]);

  const onSaved = (s: Section, value: any) => setData((d) => (d ? { ...d, settings: { ...d.settings, [s]: value }, meta: { ...d.meta, [s]: { updatedAt: new Date().toISOString(), version: (d.meta[s]?.version || 0) + 1 } } } : d));
  const onCred = (p: 'razorpay' | 'email' | 'emovur' | 'google' | 'auth_hook') => (v: CredentialView) => setData((d) => (d ? { ...d, credentials: { ...d.credentials, [p]: v } } : d));

  const panel = () => {
    if (!data) return null;
    const props = (s: Section) => ({ value: data.settings[s], defaults: data.defaults[s], onSaved });
    switch (current.id) {
      case 'general': return <GeneralPanel {...props('general')} />;
      case 'branding': return <BrandingPanel {...props('branding')} />;
      case 'website-banners': return <AdminBannersPage placement="website" />;
      case 'app-banners': return <AdminBannersPage placement="app" />;
      case 'media': return (
        <div>
          <PanelHeader title="Images & media" description="All site images in one place. New images are stored in the Cloudinary CDN (Supabase Storage until Cloudinary is configured); replacing an image updates it everywhere it is used, and images in use cannot be deleted." />
          <div className="mb-6"><CloudinaryPanel /></div>
          <MediaLibrary mode="manage" />
        </div>
      );
      case 'contact': return <ContactPanel {...props('contact')} />;
      case 'social': return <SocialPanel {...props('social')} />;
      case 'payment': return <PaymentPanel {...props('payment')} cred={data.credentials.razorpay} canEncrypt={data.canEncrypt} superAdmin={data.access.superAdmin} lastWebhook={data.lastWebhook} onCred={onCred('razorpay')} />;
      case 'whatsapp': return <WhatsAppPanel {...props('whatsapp')} cred={data.credentials.emovur} canEncrypt={data.canEncrypt} onCred={onCred('emovur')} />;
      case 'smtp': return <SmtpPanel {...props('email')} cred={data.credentials.email} canEncrypt={data.canEncrypt} superAdmin={data.access.superAdmin} onCred={onCred('email')} />;
      case 'email-templates': return <EmailTemplatesPanel {...props('email')} />;
      case 'auth': return <AuthMethodsPanel {...props('auth')} />;
      case 'google': return <GoogleOAuthPanel cred={data.credentials.google} canEncrypt={data.canEncrypt} onCred={onCred('google')} authSettings={data.settings.auth} />;
      case 'domain': return <DomainPanel {...props('domain')} hookCred={data.credentials.auth_hook} canEncrypt={data.canEncrypt} onHookCred={onCred('auth_hook')} />;
      case 'seo': return <SeoPanel {...props('seo')} />;
      case 'app': return <AppConfigPanel {...props('app')} />;
      case 'notifications': return <NotificationsPanel {...props('notifications')} />;
      case 'maintenance': return <MaintenancePanel {...props('maintenance')} />;
      case 'audit': return <AuditPanel />;
      case 'permissions': return <PermissionsPanel />;
      default: return null;
    }
  };

  return (
    <div>
      <div className="mb-6">
        <span className="ed-eyebrow">Admin</span>
        <h1 className="ed-display mt-2 text-[2rem] sm:text-[2.4rem] leading-tight">Settings & Configuration</h1>
        <p className="mt-1.5 text-[16px] text-[#64748B] max-w-3xl">Manage the website and the student app without code changes. Public settings are served to both from one place.</p>
      </div>
      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-[15px] text-rose-800">
          {error}
          <button onClick={load} className="ml-3 underline font-semibold">Try again</button>
        </div>
      )}
      {data?.migrationMissing && <div className="mb-6"><Note tone="warn">The settings tables are missing. Run <code>supabase/RUN_IN_SQL_EDITOR.sql</code> in the Supabase SQL Editor; until then defaults are shown and changes cannot be saved.</Note></div>}
      {!data && !error && <div className="py-20 text-center text-[#64748B]">Loading settings…</div>}
      {data && (
        <div className="grid lg:grid-cols-[250px_1fr] gap-6 items-start">
          <nav className="bg-white rounded-[20px] border border-[#E2E8F0] p-2 lg:sticky lg:top-4" aria-label="Settings sections">
            <ul className="flex lg:flex-col gap-1 overflow-x-auto">
              {visible.map((n) => {
                const Icon = n.icon;
                const active = n.id === current.id;
                return (
                  <li key={n.id} className="shrink-0">
                    <Link to={`/admin/settings/${n.id}`} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[14.5px] font-semibold whitespace-nowrap ${active ? 'bg-[#004AAD] text-white' : 'text-[#334155] hover:bg-[#F1F5F9]'}`} aria-current={active ? 'page' : undefined}>
                      <Icon className="w-4 h-4" /> {n.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="min-w-0">{panel()}</div>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ Audit log */
const AuditPanel: React.FC = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [section, setSection] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(true);
  const load = useCallback(async (before?: number) => {
    try {
      const r = await settingsAdmin.audit({ section: section || undefined, before, limit: 50 });
      setEntries((e) => (before ? [...e, ...r.entries] : r.entries));
      setMore(r.entries.length === 50);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [section]);
  useEffect(() => {
    load();
  }, [load]);
  const show = (v: unknown) => {
    if (v === null || v === undefined || v === '') return '—';
    return typeof v === 'string' ? v : JSON.stringify(v);
  };
  return (
    <div>
      <PanelHeader title="Audit log" description="Every settings change: what changed, previous and new (non-secret) values, who and when. Secrets are never recorded.">
        <div className="flex gap-2">
          <select className="ed-field !w-48" value={section} onChange={(e) => setSection(e.target.value)} aria-label="Filter section">
            <option value="">All sections</option>
            {['general', 'branding', 'banners', 'media', 'contact', 'social', 'payment', 'whatsapp', 'email', 'auth', 'domain', 'seo', 'app', 'notifications', 'maintenance', 'permissions'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => load()} className="ed-btn ed-btn-outlined ed-btn-sm" aria-label="Refresh"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </PanelHeader>
      {error && <Note tone="warn">{error}</Note>}
      <div className="bg-white rounded-[20px] border border-[#E2E8F0] overflow-x-auto">
        <table className="w-full text-left text-[14px]">
          <thead className="bg-[#F7F9FC] text-[12.5px] uppercase tracking-wide text-[#64748B]">
            <tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Who</th><th className="px-4 py-3">Section / action</th><th className="px-4 py-3">Change</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2F7] align-top">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3 whitespace-nowrap">{fmtWhen(e.created_at)}</td>
                <td className="px-4 py-3">{e.actor_email || 'system'}</td>
                <td className="px-4 py-3"><div className="font-semibold">{e.section}</div><div className="text-[#64748B]">{e.action}</div></td>
                <td className="px-4 py-3 max-w-[480px]">
                  {e.action === 'update' && e.changes && typeof e.changes === 'object' ? (
                    <ul className="space-y-1">
                      {Object.entries(e.changes).map(([k, v]: any) => (
                        <li key={k} className="break-words"><span className="font-semibold">{k}</span>: <span className="text-rose-700 line-through">{show(v?.from)}</span> → <span className="text-emerald-700">{show(v?.to)}</span></li>
                      ))}
                    </ul>
                  ) : (
                    <code className="text-[12.5px] break-words whitespace-pre-wrap">{JSON.stringify(e.changes)}</code>
                  )}
                  {e.error && <div className="text-rose-700 mt-1">{e.error}</div>}
                </td>
                <td className="px-4 py-3"><span className={`px-2 h-6 inline-flex items-center rounded-md text-[12px] font-bold ${e.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{e.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!entries.length && !error && <div className="py-12 text-center text-[#64748B]">No changes recorded yet.</div>}
      </div>
      {more && entries.length > 0 && <div className="mt-4 text-center"><button onClick={() => load(entries[entries.length - 1].id)} className="ed-btn ed-btn-outlined ed-btn-sm">Load older</button></div>}
    </div>
  );
};

/* ------------------------------------------------------------------ Permissions */
const SECTION_LABEL: Record<string, string> = { ...Object.fromEntries(NAV.map((n) => [n.perm, n.label])), banners: 'Banner managers', email: 'SMTP & email templates' };
const PermissionsPanel: React.FC = () => {
  const { showToast } = useCartWishlist();
  const [data, setData] = useState<{ sections: string[]; users: any[] } | null>(null);
  const [editing, setEditing] = useState<{ id: string; isSuperAdmin: boolean; sections: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    try {
      setData(await settingsAdmin.permissions.list());
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const save = async () => {
    if (!editing) return;
    try {
      await settingsAdmin.permissions.save(editing.id, { isSuperAdmin: editing.isSuperAdmin, sections: editing.sections });
      showToast('Permissions saved', 'success');
      setEditing(null);
      load();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };
  const effectiveLabel: Record<string, string> = { super_admin: 'Super admin (full access)', restricted_admin: 'Admin (limited)', instructor_with_access: 'Instructor (granted sections)', no_access: 'No settings access' };
  return (
    <div>
      <PanelHeader title="Admin permissions" description="Admins without restrictions have full access (so nobody is locked out). Restrict an admin to chosen sections, or grant an instructor specific sections. Payment credentials and permissions are super-admin only." />
      {error && <Note tone="warn">{error}</Note>}
      <Card>
        <ul className="divide-y divide-[#EEF2F7]">
          {data?.users.map((u) => (
            <li key={u.id} className="py-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-[#111827]">{u.name || u.email} <span className="text-[13px] font-medium text-[#64748B]">· {u.role}</span></div>
                  <div className="text-[13.5px] text-[#64748B]">{u.email} · {effectiveLabel[u.effective]}{u.row && !u.row.is_super_admin && u.row.sections?.length ? `: ${u.row.sections.map((s: string) => SECTION_LABEL[s] || s).join(', ')}` : ''}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing({ id: u.id, isSuperAdmin: u.role === 'admin' && (!u.row || u.row.is_super_admin), sections: u.row?.sections || [] })} className="ed-btn ed-btn-tonal ed-btn-sm">Edit</button>
                  {u.row && <button onClick={() => settingsAdmin.permissions.reset(u.id).then(load).catch((e) => showToast(e.message, 'error'))} className="ed-btn ed-btn-text ed-btn-sm">Reset</button>}
                </div>
              </div>
              {editing && editing.id === u.id && (
                <div className="mt-3 p-4 rounded-xl bg-[#F7F9FC] border border-[#E2E8F0] space-y-3">
                  {u.role === 'admin' && (
                    <label className="flex items-center gap-3 font-semibold"><input type="checkbox" className="w-5 h-5" checked={editing.isSuperAdmin} onChange={(e) => { const v = e.target.checked; setEditing((ed) => ed && { ...ed, isSuperAdmin: v }); }} /> Super admin (full access)</label>
                  )}
                  {!editing.isSuperAdmin && (
                    <div className="grid sm:grid-cols-3 gap-2">
                      {data.sections.filter((s) => !(u.role === 'instructor' && s === 'payment')).map((s) => (
                        <label key={s} className="flex items-center gap-2 text-[14px]">
                          <input type="checkbox" className="w-4 h-4" checked={editing.sections.includes(s)} onChange={(e) => { const on = e.target.checked; setEditing((ed) => ed && { ...ed, sections: on ? [...ed.sections, s] : ed.sections.filter((x) => x !== s) }); }} />
                          {SECTION_LABEL[s] || s}
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2"><button onClick={save} className="ed-btn ed-btn-filled ed-btn-sm">Save</button><button onClick={() => setEditing(null)} className="ed-btn ed-btn-text ed-btn-sm">Cancel</button></div>
                </div>
              )}
            </li>
          ))}
        </ul>
        {data && !data.users.length && <div className="py-8 text-center text-[#64748B]">No admins or instructors found.</div>}
      </Card>
    </div>
  );
};
