import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, RefreshCw, RotateCcw, Send, Copy, ExternalLink, UploadCloud, Megaphone } from 'lucide-react';
import { Card, FieldDef, FieldGrid, Note, PanelHeader, PanelProps, ReauthModal, SaveBar, StepList, fmtWhen, useSectionForm } from './settingsKit';
import { CredentialCard } from './panelsSecure';
import { AuthCheckStatus, AuthStatus, CredentialView, EmailLogResponse, EmailTemplateInfo, TestStep, settingsAdmin } from '../../../services/settingsAdmin';
import { useCartWishlist } from '../../../context/CartWishlistContext';

const copy = async (text: string, toast: (m: string, t: any) => void) => {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied', 'success');
  } catch {
    toast('Copy failed: select the text and copy it manually.', 'warning');
  }
};

const CopyValue: React.FC<{ value: string }> = ({ value }) => {
  const { showToast } = useCartWishlist();
  if (!value) return <span className="text-[#94A3B8]">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 max-w-full">
      <code className="px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[13px] break-all">{value}</code>
      <button type="button" onClick={() => copy(value, showToast)} className="p-1 rounded hover:bg-[#E2E8F0]" aria-label={`Copy ${value}`}><Copy className="w-3.5 h-3.5" /></button>
    </span>
  );
};

/* ================================================================== 10. SMTP & Email Configuration */
const SENDER: FieldDef[] = [
  { key: 'enabled', label: 'Send automatic emails', kind: 'bool', wide: true, hint: 'Off = nothing is sent (emails are logged as skipped). Sign-up verification and password reset still need a working provider when the Supabase email hook is on.' },
  { key: 'senderName', label: 'Sender name', kind: 'text', max: 60, placeholder: 'Edufy Academy' },
  { key: 'senderEmail', label: 'Sender email', kind: 'email', hint: 'Must be allowed to send from your SMTP account (e.g. a mailbox or verified domain).', placeholder: 'no-reply@yourdomain.com' },
  { key: 'replyTo', label: 'Reply-to email', kind: 'email', placeholder: 'support@yourdomain.com' },
  { key: 'supportEmail', label: 'Support email (shown in emails)', kind: 'email' },
  { key: 'brandColor', label: 'Brand colour (buttons and header line)', kind: 'text', max: 7, placeholder: '#004AAD' },
  { key: 'footerText', label: 'Footer text', kind: 'longtext', max: 300, wide: true, hint: '{year} is replaced with the current year. Logo: Settings → Branding & Logo → Email logo.' },
];

const isSmtp = (f: Record<string, string>) => (f.provider || 'smtp') === 'smtp';

export const SmtpPanel: React.FC<PanelProps & { cred?: CredentialView; canEncrypt: boolean; superAdmin: boolean; onCred: (v: CredentialView) => void }> = ({ value, onSaved, cred, canEncrypt, superAdmin, onCred }) => {
  const f = useSectionForm('email', value, onSaved);
  const { showToast } = useCartWishlist();
  const [testTo, setTestTo] = useState('');
  const [testSteps, setTestSteps] = useState<TestStep[] | null>(null);
  const [sending, setSending] = useState(false);

  const sendTest = async () => {
    setSending(true);
    setTestSteps(null);
    try {
      const r = await settingsAdmin.email.test(testTo);
      setTestSteps(r.steps);
      showToast(r.ok ? r.message : 'The email was not accepted. See the steps below.', r.ok ? 'success' : 'warning');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PanelHeader title="SMTP & email configuration" description="The mail account all automatic emails are sent from: welcome, verification, password reset, purchases, enrollments, certificates and announcements. Emails are queued and retried automatically; a failed email never blocks a sign-up or an enrollment." />
      <div className="space-y-5">
        <Card title="Sender">
          <FieldGrid fields={SENDER} draft={f.draft} errors={f.errors} set={f.set} />
          <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => f.save()} onReset={f.reset} savedAt={f.savedAt} />
        </Card>

        {superAdmin ? (
          <CredentialCard
            provider="email"
            title="SMTP server"
            description="Host, port and login from your email provider (e.g. Hostinger, Zoho, Google Workspace, Brevo SMTP). The password is encrypted on the server, shown only masked, and never sent to the website, the app or the logs."
            view={cred}
            canEncrypt={canEncrypt}
            onChanged={onCred}
            requiresPassword={(action) => action !== 'save'}
            reauthMessage={(a) => (a === 'activate' ? 'All automatic emails will be sent through this SMTP account from now on.' : 'Emails will go back to the provider in the server environment (if any).')}
            fields={[
              { key: 'provider', label: 'Sending method', type: 'select', options: [{ value: 'smtp', label: 'SMTP server' }, { value: 'brevo', label: 'Brevo API' }, { value: 'resend', label: 'Resend API' }] },
              { key: 'host', label: 'SMTP host', placeholder: 'smtp.yourprovider.com', show: isSmtp },
              { key: 'port', label: 'Port', placeholder: '587', hint: '465 = SSL/TLS, 587 = STARTTLS', show: isSmtp },
              { key: 'security', label: 'Encryption', type: 'select', options: [{ value: 'starttls', label: 'STARTTLS (port 587)' }, { value: 'ssl', label: 'SSL/TLS (port 465)' }, { value: 'none', label: 'None (local relay only)' }], show: isSmtp },
              { key: 'username', label: 'Username', placeholder: 'no-reply@yourdomain.com', show: isSmtp },
              { key: 'password', label: 'Password', secret: true, placeholder: 'SMTP password', show: isSmtp },
              { key: 'apiKey', label: 'API key', secret: true, placeholder: 'API key', show: (fm) => !isSmtp(fm) },
            ]}
            testExtra={<input className="ed-field !w-64" type="email" placeholder="Send the test to (your email)" value={testTo} onChange={(e) => setTestTo(e.target.value)} aria-label="Test recipient" />}
            testPayload={() => ({ to: testTo })}
          >
            <p className="mt-3 text-[13px] text-[#64748B]">“Test configuration” connects to the server, checks encryption and the login, and sends a real test email. It passes only when the mail server accepts the message for delivery.</p>
          </CredentialCard>
        ) : (
          <Note tone="warn">Only a super administrator can change the SMTP account.</Note>
        )}

        <Card title="Send test email" description="Uses the account that is active now (admin panel, or the SMTP_* variables on the server).">
          <div className="flex flex-wrap gap-2">
            <input className="ed-field !w-72" type="email" placeholder="you@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} aria-label="Send test to" />
            <button onClick={sendTest} disabled={!testTo || sending} className="ed-btn ed-btn-tonal ed-btn-sm"><Send className="w-4 h-4" /> {sending ? 'Sending…' : 'Send test email'}</button>
          </div>
          {testSteps && <div className="mt-4"><StepList steps={testSteps} /></div>}
        </Card>

        <EmailLogsCard />
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------- email logs */
const STATUS_TONE: Record<string, string> = {
  sent: 'bg-emerald-50 text-emerald-700', queued: 'bg-blue-50 text-blue-700', sending: 'bg-blue-50 text-blue-700',
  failed: 'bg-rose-50 text-rose-700', skipped: 'bg-amber-50 text-amber-800', cancelled: 'bg-slate-100 text-slate-600',
};

const EmailLogsCard: React.FC = () => {
  const { showToast } = useCartWishlist();
  const [data, setData] = useState<EmailLogResponse | null>(null);
  const [filter, setFilter] = useState({ status: '', template: '', q: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await settingsAdmin.email.logs({ ...filter, limit: 100 }));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [filter]);
  useEffect(() => {
    load();
  }, [load]);

  const retry = async (id?: string) => {
    setBusy(id || 'all');
    try {
      if (id) await settingsAdmin.email.retry(id);
      else {
        const r = await settingsAdmin.email.retryFailed();
        showToast(`${r.count} email(s) queued again`, 'success');
      }
      setTimeout(load, 1500);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <Card title="Email log" description="Every automatic email with its status, attempts and the mail server’s reply. Temporary failures are retried automatically (1 min, 5 min, 15 min, 1 h, 3 h).">
      <div className="flex flex-wrap gap-2 mb-4">
        <select className="ed-field !w-40" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} aria-label="Status">
          <option value="">All statuses</option>
          {['sent', 'queued', 'failed', 'skipped'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className="ed-field !w-56" placeholder="Search recipient" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} aria-label="Search recipient" />
        <button onClick={load} className="ed-btn ed-btn-outlined ed-btn-sm" aria-label="Refresh"><RefreshCw className="w-4 h-4" /></button>
        {!!data?.counts.failed && <button onClick={() => retry()} disabled={!!busy} className="ed-btn ed-btn-tonal ed-btn-sm"><RotateCcw className="w-4 h-4" /> Retry all failed ({data.counts.failed})</button>}
      </div>
      {data && (
        <div className="flex flex-wrap gap-3 mb-3 text-[13.5px] text-[#475569]">
          {Object.entries(data.counts).map(([k, v]) => <span key={k}><span className={`px-2 py-0.5 rounded-md font-bold ${STATUS_TONE[k] || ''}`}>{k}</span> {v}</span>)}
          <span>· Sending via <strong>{data.provider ? data.provider.toUpperCase() : 'not configured'}</strong></span>
          <span>· Worker last ran {fmtWhen(data.worker.lastRunAt)}</span>
        </div>
      )}
      {error && <Note tone="warn">{error}</Note>}
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-left text-[13.5px]">
          <thead className="text-[12px] uppercase tracking-wide text-[#64748B]">
            <tr><th className="px-2 py-2">When</th><th className="px-2 py-2">Email</th><th className="px-2 py-2">To</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Server reply / error</th><th className="px-2 py-2" /></tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2F7] align-top">
            {data?.entries.map((e) => (
              <tr key={e.id}>
                <td className="px-2 py-2 whitespace-nowrap">{fmtWhen(e.sent_at || e.created_at)}</td>
                <td className="px-2 py-2">{e.template.replace(/_/g, ' ')}</td>
                <td className="px-2 py-2 break-all">{e.to_email}</td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-md text-[12px] font-bold ${STATUS_TONE[e.status] || ''}`}>{e.status}</span>
                  <div className="text-[12px] text-[#64748B]">attempt {e.attempts}/{e.max_attempts}{e.status === 'queued' && e.attempts > 0 ? ` · next ${fmtWhen(e.next_attempt_at)}` : ''}</div>
                </td>
                <td className="px-2 py-2 max-w-[360px] break-words text-[#475569]">{e.last_error || e.provider_response || '—'}</td>
                <td className="px-2 py-2">{['failed', 'skipped'].includes(e.status) && <button onClick={() => retry(e.id)} disabled={!!busy} className="ed-btn ed-btn-text ed-btn-sm">Retry</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && !data.entries.length && <div className="py-8 text-center text-[#64748B]">No emails yet.</div>}
      </div>
    </Card>
  );
};

/* ================================================================== 11. Email Templates */
export const EmailTemplatesPanel: React.FC<PanelProps> = ({ value, onSaved }) => {
  const f = useSectionForm('email', value, onSaved);
  const { showToast } = useCartWishlist();
  const [defs, setDefs] = useState<EmailTemplateInfo[]>([]);
  const [tab, setTab] = useState('welcome');
  const [preview, setPreview] = useState<{ subject: string; html: string; missing: string[] } | null>(null);
  const editor = React.useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    settingsAdmin.email.templates().then((r) => setDefs(r.templates)).catch((e) => showToast(e.message, 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const def = defs.find((d) => d.id === tab);
  const tpl = f.draft?.templates?.[tab] || { enabled: true, subject: '', html: '' };
  const setTpl = (patch: any) => f.setDraft({ ...f.draft, templates: { ...f.draft.templates, [tab]: { ...tpl, ...patch } } });
  const groups = useMemo(() => [...new Set(defs.map((d) => d.group))], [defs]);
  const globals = ['student_name', 'student_email', 'website_name', 'website_url', 'login_url', 'dashboard_url', 'support_email', 'support_phone', 'year'];

  const insert = (v: string) => {
    const el = editor.current;
    const token = `{{${v}}}`;
    if (!el) return setTpl({ html: `${tpl.html}${token}` });
    const s = el.selectionStart ?? tpl.html.length;
    const e = el.selectionEnd ?? s;
    setTpl({ html: tpl.html.slice(0, s) + token + tpl.html.slice(e) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + token.length, s + token.length);
    });
  };

  const doPreview = async () => {
    try {
      setPreview(await settingsAdmin.email.preview(tab, { subject: tpl.subject, html: tpl.html }));
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };
  const restore = async () => {
    if (!window.confirm('Replace this template with the original Edufy text? Your edits to it will be lost.')) return;
    try {
      const r = await settingsAdmin.email.restore(tab);
      onSaved('email', r.value);
      setPreview(null);
      showToast('Default template restored', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  return (
    <div>
      <PanelHeader title="Email templates" description="Subject and message for every automatic email. Placeholders like {{student_name}} are filled in by the server; values are escaped and no code in a template is ever executed." />
      <div className="space-y-5">
        <Card>
          {groups.map((g) => (
            <div key={g} className="mb-3">
              <div className="text-[12px] font-bold uppercase tracking-wide text-[#64748B] mb-1.5">{g}</div>
              <div className="flex flex-wrap gap-2">
                {defs.filter((d) => d.group === g).map((d) => {
                  const on = f.draft?.templates?.[d.id]?.enabled !== false;
                  return (
                    <button key={d.id} onClick={() => { setTab(d.id); setPreview(null); }} className={`px-3.5 h-9 rounded-full text-[14px] font-semibold ${tab === d.id ? 'bg-[#004AAD] text-white' : 'bg-[#F1F5F9] text-[#334155]'}`}>
                      {d.label} {!on && <span className="opacity-70">(off)</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>

        {def && (
          <Card title={def.label} description={<>Sent when: {def.trigger}{def.authHook ? ' Sent through your SMTP only when the Supabase “Send Email” hook is enabled (Settings → Domain & Environment); otherwise Supabase sends its own email.' : ''}</>}>
            <label className="flex items-center gap-3 mb-4"><input type="checkbox" className="w-5 h-5" checked={tpl.enabled !== false} onChange={(e) => setTpl({ enabled: e.target.checked })} /> <span className="font-semibold">Send this email</span></label>
            <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Subject</span>
              <input className="ed-field mt-1.5" maxLength={150} value={tpl.subject} onChange={(e) => setTpl({ subject: e.target.value })} /></label>
            <div className="mt-3">
              <div className="text-[13px] text-[#64748B] mb-1.5">Insert a placeholder (click):</div>
              <div className="flex flex-wrap gap-1.5">
                {[...def.vars, ...globals].map((v) => (
                  <button key={v} type="button" onClick={() => insert(v)} className={`px-2 h-7 rounded-md text-[12.5px] font-mono ${def.required.includes(v) ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-[#F1F5F9] text-[#334155]'}`} title={def.required.includes(v) ? 'Required: the email is not sent without it' : undefined}>
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            </div>
            <label className="block mt-3"><span className="text-[15px] font-semibold text-[#111827]">Message (HTML: h1, h2, p, strong, em, a, br, ul, ol, li, table)</span>
              <textarea ref={editor} className="ed-field mt-1.5 !h-auto py-3 font-mono text-[13px]" rows={12} value={tpl.html} onChange={(e) => setTpl({ html: e.target.value })} /></label>
            {(f.errors[`templates.${tab}`] || f.errors[`templates.${tab}.html`] || f.errors[`templates.${tab}.subject`]) && (
              <p className="mt-1 text-[13px] text-rose-600">{f.errors[`templates.${tab}`] || f.errors[`templates.${tab}.html`] || f.errors[`templates.${tab}.subject`]}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={doPreview} className="ed-btn ed-btn-tonal ed-btn-sm"><Eye className="w-4 h-4" /> Preview with sample data</button>
              <button onClick={restore} className="ed-btn ed-btn-text ed-btn-sm"><RotateCcw className="w-4 h-4" /> Restore default</button>
            </div>
            {preview && (
              <div className="mt-4 rounded-xl border border-[#E2E8F0] overflow-hidden">
                <div className="px-4 py-2 bg-[#F7F9FC] text-[14px]"><strong>Subject:</strong> {preview.subject}</div>
                {!!preview.missing.length && <div className="px-4 py-2 text-[13px] bg-amber-50 text-amber-900">Missing required values: {preview.missing.join(', ')}. Check Domain & Environment.</div>}
                <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="w-full h-[520px] bg-white" />
              </div>
            )}
          </Card>
        )}
        <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => f.save()} onReset={f.reset} savedAt={f.savedAt} />
        <AnnouncementCard />
      </div>
    </div>
  );
};

const AnnouncementCard: React.FC = () => {
  const { showToast } = useCartWishlist();
  const [form, setForm] = useState({ title: '', body: '', audience: 'all_students' as 'all_students' | 'enrolled' });
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const check = await settingsAdmin.email.announcement(form);
      if (!check.needsConfirmation) return;
      if (!window.confirm(`Send “${form.title}” to ${check.recipients} student(s)? This cannot be undone.`)) return;
      const r = await settingsAdmin.email.announcement({ ...form, confirm: true });
      showToast(`${r.queued} email(s) queued. Track them in SMTP & Email → Email log.`, 'success');
      setForm({ ...form, title: '', body: '' });
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Send an announcement email" description="Uses the “Announcement” template. Plain text; blank lines start a new paragraph. Students receive one email each.">
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block"><span className="text-[15px] font-semibold">Title</span><input className="ed-field mt-1.5" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label className="block"><span className="text-[15px] font-semibold">Recipients</span>
          <select className="ed-field mt-1.5" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as any })}>
            <option value="all_students">All students</option>
            <option value="enrolled">Students with an active enrollment</option>
          </select>
        </label>
        <label className="block sm:col-span-2"><span className="text-[15px] font-semibold">Message</span><textarea className="ed-field mt-1.5 !h-auto py-3" rows={5} maxLength={4000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
      </div>
      <button onClick={send} disabled={busy || !form.title || !form.body} className="mt-4 ed-btn ed-btn-filled ed-btn-sm"><Megaphone className="w-4 h-4" /> {busy ? 'Preparing…' : 'Send announcement'}</button>
    </Card>
  );
};

/* ================================================================== 12. Authentication & Login Methods */
const AUTH_FIELDS: FieldDef[] = [
  { key: 'googleEnabled', label: 'Google Sign-In', kind: 'bool', hint: 'Shows “Continue with Google” on the login and register pages (needs Google enabled in Supabase: see Google OAuth Configuration).' },
  { key: 'oneTapEnabled', label: 'Google One Tap', kind: 'bool', hint: 'Small Google prompt on public pages for signed-out visitors. Needs the Web Client ID below.' },
  { key: 'emailPasswordEnabled', label: 'Email & password', kind: 'bool', hint: 'Can only be hidden while Google is on. Administrators can always use /login?method=email.' },
  { key: 'magicLinkEnabled', label: 'Email sign-in link (magic link)', kind: 'bool', hint: 'Passwordless link for existing accounts.' },
  { key: 'preferredMethod', label: 'Preferred login method (shown first)', kind: 'select', options: [{ value: 'google', label: 'Google' }, { value: 'email', label: 'Email' }] },
  { key: 'googleButtonText', label: 'Google button text', kind: 'select', options: [{ value: 'continue_with', label: 'Continue with Google' }, { value: 'signin_with', label: 'Sign in with Google' }, { value: 'signup_with', label: 'Sign up with Google' }] },
  { key: 'googleClientId', label: 'Google Web Client ID (public)', kind: 'text', wide: true, placeholder: '1234567890-abc123.apps.googleusercontent.com', hint: 'Enables Google’s official button and One Tap on the website. This ID is public by design; the Client Secret goes in Google OAuth Configuration and never reaches the browser.' },
];

export const AuthMethodsPanel: React.FC<PanelProps> = ({ value, onSaved }) => {
  const f = useSectionForm('auth', value, onSaved);
  const d = f.draft || {};
  const warn = !d.emailPasswordEnabled && !d.googleEnabled ? 'Turn on Google before hiding email & password.' : d.preferredMethod === 'google' && !d.googleEnabled ? 'The preferred method must be switched on.' : '';
  return (
    <div>
      <PanelHeader title="Authentication & login methods" description="Which sign-in options students see on the website and in the app. Changes apply immediately (the app refreshes within a few minutes)." />
      <div className="space-y-5">
        <Card>
          <FieldGrid fields={AUTH_FIELDS} draft={f.draft} errors={f.errors} set={f.set} />
          {warn && <div className="mt-4"><Note tone="warn">{warn}</Note></div>}
          <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => f.save()} onReset={f.reset} savedAt={f.savedAt} />
        </Card>
        <Note>
          Lock-out protection: the server refuses settings that leave no working sign-in method, the Supabase email provider is never switched off from here, and <code>/login?method=email</code> always shows the email form for administrators.
        </Note>
        <Note>
          Account linking: when someone signs in with Google using the same verified email as an existing account, Supabase links the Google identity to that account, so enrollments, progress and certificates stay with it. Admin roles are never taken from Google profile data.
        </Note>
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------- status helpers */
const CHECK_LABEL: Record<AuthCheckStatus, { text: string; tone: string }> = {
  configured: { text: 'Configured', tone: 'bg-emerald-50 text-emerald-700' },
  supabase_manual: { text: 'Needs Supabase update', tone: 'bg-amber-50 text-amber-800' },
  google_console: { text: 'Check Google Cloud Console', tone: 'bg-blue-50 text-blue-800' },
  deploy: { text: 'Needs deployment / rebuild', tone: 'bg-purple-50 text-purple-800' },
  missing: { text: 'Not set', tone: 'bg-rose-50 text-rose-700' },
};

function useAuthStatus() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setStatus(await settingsAdmin.auth.status());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { status, error, reload: load };
}

const StatusList: React.FC<{ status: AuthStatus; only?: string[] }> = ({ status, only }) => (
  <ul className="divide-y divide-[#EEF2F7]">
    {status.checks.filter((c) => !only || only.includes(c.id)).map((c) => (
      <li key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
        <span className={`px-2 h-6 inline-flex items-center rounded-md text-[12px] font-bold shrink-0 w-fit ${CHECK_LABEL[c.status].tone}`}>{CHECK_LABEL[c.status].text}</span>
        <div className="min-w-0">
          <div className="font-semibold text-[#111827] text-[14.5px]">{c.label}</div>
          <div className="text-[13.5px] text-[#475569] break-words">{c.detail}</div>
          {c.value && <div className="mt-1 space-y-1">{c.value.split('\n').map((v) => <div key={v}><CopyValue value={v} /></div>)}</div>}
        </div>
      </li>
    ))}
  </ul>
);

const ApplyButton: React.FC<{ label: string; apply: Record<string, boolean>; disabled?: boolean; message: string; onDone: () => void }> = ({ label, apply, disabled, message, onDone }) => {
  const { showToast } = useCartWishlist();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} disabled={disabled || busy} className="ed-btn ed-btn-filled ed-btn-sm"><UploadCloud className="w-4 h-4" /> {busy ? 'Applying…' : label}</button>
      <ReauthModal
        open={open}
        title="Apply to Supabase Auth"
        message={message}
        busy={busy}
        onCancel={() => setOpen(false)}
        onConfirm={async (pw) => {
          setOpen(false);
          setBusy(true);
          try {
            const r = await settingsAdmin.auth.apply(pw, apply);
            showToast(`Updated in Supabase: ${r.applied.join(', ')}`, 'success');
            onDone();
          } catch (e: any) {
            showToast(e.message, 'error');
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
};

/* ================================================================== 13. Google OAuth Configuration */
export const GoogleOAuthPanel: React.FC<{ cred?: CredentialView; canEncrypt: boolean; onCred: (v: CredentialView) => void; authSettings: any }> = ({ cred, canEncrypt, onCred, authSettings }) => {
  const { status, error, reload } = useAuthStatus();
  return (
    <div>
      <PanelHeader title="Google OAuth configuration" description="Google Sign-In runs through Supabase Auth. The Client Secret is stored encrypted here and sent only to Supabase; it never reaches the website or the app." />
      <div className="space-y-5">
        {error && <Note tone="warn">{error}</Note>}
        <Card title="1. Google Cloud Console" description="console.cloud.google.com → APIs & Services → Credentials → Create credentials → OAuth client ID.">
          <ol className="list-decimal pl-5 space-y-2 text-[14.5px] text-[#334155]">
            <li><strong>OAuth consent screen</strong>: app name “Edufy Academy”, support email, your logo, authorised domain = your website domain, scopes <code>email</code>, <code>profile</code>, <code>openid</code>. Publish the app (Testing mode only allows listed test users).</li>
            <li><strong>Web application</strong> client:
              <div className="mt-1">Authorised JavaScript origins: <CopyValue value={status?.urls.siteUrl || ''} /></div>
              <div className="mt-1">Authorised redirect URI: <CopyValue value={status?.callbackUrl || ''} /></div>
            </li>
            <li><strong>Android</strong> clients (for the app’s native Google button, optional): package <code>com.edufyacademy.student</code> + the SHA-1 of the debug keystore and of the Play App Signing key (Play Console → Setup → App signing).</li>
          </ol>
        </Card>
        <CredentialCard
          provider="google"
          title="2. Client ID & Secret"
          description="Paste the Web client ID and secret. Android client IDs are added to Supabase so native Android ID tokens are accepted."
          view={cred}
          canEncrypt={canEncrypt}
          onChanged={onCred}
          activateWithoutTest
          requiresPassword={() => true}
          reauthMessage={(a) => (a === 'save' ? 'You are saving the Google OAuth client secret.' : a === 'activate' ? 'These Google credentials will be used for “Apply to Supabase”.' : 'The stored Google credentials will be removed (Supabase keeps its current setting).')}
          fields={[
            { key: 'clientId', label: 'Web Client ID', placeholder: '1234567890-abc.apps.googleusercontent.com' },
            { key: 'clientSecret', label: 'Client Secret', secret: true, placeholder: 'GOCSPX-…' },
            { key: 'androidClientIds', label: 'Android Client IDs (optional, comma separated)', type: 'textarea', placeholder: '1234567890-android.apps.googleusercontent.com' },
          ]}
        />
        <Card title="3. Supabase Google provider">
          {status ? (
            <>
              <StatusList status={status} only={['google_provider', 'google_console', 'redirects']} />
              <div className="mt-4 flex flex-wrap gap-2 items-center">
                {status.management.enabled ? (
                  <ApplyButton label="Apply Google provider to Supabase" apply={{ google: true, redirects: true }} disabled={!cred?.active} message="Enables Google in Supabase Auth with the active Client ID/Secret and adds the website and app redirect URLs." onDone={reload} />
                ) : (
                  <Note>Set <code>SUPABASE_MANAGEMENT_TOKEN</code> on the server to apply this automatically. Otherwise: Supabase Dashboard → Authentication → Sign In / Providers → Google → enable, paste the Client ID(s) (web first, then Android, comma separated) and the Client Secret → Save.</Note>
                )}
                <button onClick={reload} className="ed-btn ed-btn-outlined ed-btn-sm" aria-label="Refresh status"><RefreshCw className="w-4 h-4" /></button>
              </div>
            </>
          ) : (
            <div className="text-[#64748B]">Loading status…</div>
          )}
        </Card>
        {authSettings && !authSettings.googleClientId && <Note>Also paste the Web Client ID in <strong>Authentication & Login Methods</strong> to show Google’s official button and enable One Tap on the website.</Note>}
      </div>
    </div>
  );
};

/* ================================================================== 14. Domain & Environment */
const PROFILES = [
  { id: 'production', label: 'Production', hint: 'Live site. https only, no localhost.' },
  { id: 'staging', label: 'Staging', hint: 'Test copy of the site. https only.' },
  { id: 'development', label: 'Development', hint: 'Local testing. http allowed only for localhost / LAN.' },
] as const;
const PATHS: { key: string; label: string }[] = [
  { key: 'login', label: 'Login page' }, { key: 'register', label: 'Register page' }, { key: 'resetPassword', label: 'Password reset page' },
  { key: 'authCallback', label: 'Email verification / sign-in callback' }, { key: 'dashboard', label: 'Student dashboard' },
];

export const DomainPanel: React.FC<PanelProps & { hookCred?: CredentialView; canEncrypt: boolean; onHookCred: (v: CredentialView) => void }> = ({ value, onSaved, hookCred, canEncrypt, onHookCred }) => {
  const f = useSectionForm('domain', value, onSaved);
  const { status, error, reload } = useAuthStatus();
  const d = f.draft || { activeProfile: 'production', profiles: {}, paths: {} };
  const setProfile = (p: string, k: string, v: any) => f.setDraft({ ...d, profiles: { ...d.profiles, [p]: { ...(d.profiles?.[p] || {}), [k]: v } } });
  const setPath = (k: string, v: string) => f.setDraft({ ...d, paths: { ...d.paths, [k]: v } });
  const err = (k: string) => f.errors[k];
  const save = async () => {
    const changingProfile = value?.activeProfile !== d.activeProfile;
    if (changingProfile && !window.confirm(`Switch the active environment to ${d.activeProfile}? Email links and redirects will use its addresses immediately.`)) return;
    if (await f.save()) reload();
  };

  return (
    <div>
      <PanelHeader title="Domain & environment" description="The addresses used in emails, sign-in redirects and links. The website reads them at runtime; Supabase Auth and Google keep their own copy, shown below with what still needs updating." />
      <div className="space-y-5">
        <Card title="Active environment">
          <div className="grid sm:grid-cols-3 gap-3">
            {PROFILES.map((p) => (
              <label key={p.id} className={`rounded-xl border p-3 cursor-pointer ${d.activeProfile === p.id ? 'border-[#004AAD] bg-[#EEF4FF]' : 'border-[#E2E8F0]'}`}>
                <input type="radio" name="activeProfile" className="mr-2" checked={d.activeProfile === p.id} onChange={() => f.setDraft({ ...d, activeProfile: p.id })} />
                <span className="font-semibold">{p.label}</span>
                <span className="block text-[13px] text-[#64748B] mt-1">{p.hint}</span>
              </label>
            ))}
          </div>
          {err('activeProfile') && <p className="mt-2 text-[13px] text-rose-600">{err('activeProfile')}</p>}
        </Card>

        {PROFILES.map((p) => (
          <Card key={p.id} title={`${p.label} addresses`} description={d.activeProfile === p.id ? 'Active now.' : 'Saved for later; not used until this environment is activated.'}>
            <div className="grid sm:grid-cols-2 gap-4">
              {(['siteUrl', 'apiUrl', 'adminUrl'] as const).map((k) => (
                <label key={k} className="block">
                  <span className="text-[15px] font-semibold">{{ siteUrl: 'Website URL', apiUrl: 'API URL (if different)', adminUrl: 'Admin dashboard URL (if different)' }[k]}</span>
                  <input className={`ed-field mt-1.5 font-mono ${err(`profiles.${p.id}.${k}`) ? '!border-rose-400' : ''}`} placeholder={p.id === 'development' ? 'http://localhost:5173' : 'https://'} value={d.profiles?.[p.id]?.[k] || ''} onChange={(e) => setProfile(p.id, k, e.target.value.trim())} />
                  {err(`profiles.${p.id}.${k}`) && <span className="block mt-1 text-[13px] text-rose-600">{err(`profiles.${p.id}.${k}`)}</span>}
                </label>
              ))}
              <label className="block sm:col-span-2">
                <span className="text-[15px] font-semibold">Extra allowed redirect URLs (one per line)</span>
                <span className="block text-[13px] text-[#64748B]">For example a www address. The app’s <code>edufyacademy://</code> links are always included.</span>
                <textarea className="ed-field mt-1.5 !h-auto py-2.5 font-mono text-[13px]" rows={2} value={(d.profiles?.[p.id]?.extraRedirects || []).join('\n')} onChange={(e) => setProfile(p.id, 'extraRedirects', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} />
                {Object.entries(f.errors).filter(([k]) => k.startsWith(`profiles.${p.id}.extraRedirects`)).map(([k, v]) => <span key={k} className="block mt-1 text-[13px] text-rose-600">{v}</span>)}
              </label>
            </div>
          </Card>
        ))}

        <Card title="Page paths" description="Relative paths on the website (start with /).">
          <div className="grid sm:grid-cols-2 gap-4">
            {PATHS.map((p) => (
              <label key={p.key} className="block"><span className="text-[15px] font-semibold">{p.label}</span>
                <input className={`ed-field mt-1.5 font-mono ${err(`paths.${p.key}`) ? '!border-rose-400' : ''}`} value={d.paths?.[p.key] || ''} onChange={(e) => setPath(p.key, e.target.value.trim())} />
                {err(`paths.${p.key}`) && <span className="block mt-1 text-[13px] text-rose-600">{err(`paths.${p.key}`)}</span>}
              </label>
            ))}
          </div>
          <SaveBar dirty={f.dirty} saving={f.saving} onSave={save} onReset={f.reset} savedAt={f.savedAt} />
        </Card>

        <Card title="Sync status" description="A database setting cannot change Supabase Auth or Google by itself. Each item shows whether it is already in place.">
          {error && <Note tone="warn">{error}</Note>}
          {status ? (
            <>
              <div className="mb-3 text-[14px] text-[#475569]">Active: <strong>{status.environment}</strong> · Server mode: <code>{status.nodeEnv}</code> · Supabase project: <code>{status.management.ref || '—'}</code>{status.management.error && <span className="text-rose-700"> · {status.management.error}</span>}</div>
              <StatusList status={status} />
              <div className="mt-4 flex flex-wrap gap-2 items-center">
                {status.management.enabled ? (
                  <>
                    <ApplyButton label="Apply Site URL & redirect URLs" apply={{ siteUrl: true, redirects: true }} disabled={!status.urls.siteUrl} message={`Sets the Supabase Site URL to ${status.urls.siteUrl || '—'} and adds the required redirect URLs (existing ones are kept).`} onDone={reload} />
                    <ApplyButton label="Enable email hook (send auth emails via SMTP)" apply={{ emailHook: true }} disabled={!status.hookUrl} message={`Supabase will send verification, password-reset and magic-link emails through ${status.hookUrl} (your SMTP and templates). Make sure SMTP is active and the test email works first.`} onDone={reload} />
                  </>
                ) : (
                  <Note>
                    <strong>Manual steps</strong> (or set <code>SUPABASE_MANAGEMENT_TOKEN</code> on the server to apply automatically): Supabase Dashboard → Authentication → URL Configuration → set <em>Site URL</em> and add each redirect URL above. For emails through your SMTP: Authentication → Hooks → Send Email hook → HTTPS → URL <code>{status.hookUrl || '(API URL)/api/auth/email-hook'}</code> → generate a secret and paste it below.
                  </Note>
                )}
                <button onClick={reload} className="ed-btn ed-btn-outlined ed-btn-sm" aria-label="Refresh status"><RefreshCw className="w-4 h-4" /></button>
                <a href={`https://supabase.com/dashboard/project/${status.management.ref || ''}/auth/url-configuration`} target="_blank" rel="noreferrer noopener" className="ed-btn ed-btn-text ed-btn-sm"><ExternalLink className="w-4 h-4" /> Open Supabase URL settings</a>
              </div>
            </>
          ) : (
            !error && <div className="text-[#64748B]">Loading status…</div>
          )}
        </Card>

        <CredentialCard
          provider="auth_hook"
          title="Supabase email hook secret (manual setup)"
          description="Only needed when you set up the Send Email hook by hand in the Supabase dashboard: paste the secret Supabase generated (v1,whsec_…). “Enable email hook” above creates and stores one automatically."
          view={hookCred}
          canEncrypt={canEncrypt}
          onChanged={onHookCred}
          activateWithoutTest
          requiresPassword={() => true}
          reauthMessage={() => 'This secret authenticates Supabase’s calls to the email hook.'}
          fields={[{ key: 'secret', label: 'Hook secret', secret: true, placeholder: 'v1,whsec_…' }]}
        />
        <Note tone="warn">The mobile app’s API and website addresses are built into the app (EXPO_PUBLIC_API_URL / EXPO_PUBLIC_WEB_URL). After changing domains, update them in EAS and publish a new build. Production builds never include development addresses.</Note>
      </div>
    </div>
  );
};

