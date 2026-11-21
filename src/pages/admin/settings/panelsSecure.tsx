import React, { useEffect, useState } from 'react';
import { ShieldCheck, FlaskConical, Zap, Trash2, KeyRound } from 'lucide-react';
import { Card, FieldDef, FieldGrid, Note, PanelHeader, PanelProps, ReauthModal, SaveBar, StepList, fmtWhen, useSectionForm } from './settingsKit';
import { WhatsAppFields } from './panelsBasic';
import { CredProvider, CredentialView, SettingsApiError, TestStep, settingsAdmin } from '../../../services/settingsAdmin';
import { useCartWishlist } from '../../../context/CartWishlistContext';
import { API_BASE_URL } from '../../../services/api';

type Provider = CredProvider;
type CredAction = 'save' | 'activate' | 'revert';

export interface CredField {
  key: string; label: string; secret?: boolean; type?: 'select' | 'textarea'; options?: { value: string; label: string }[]; placeholder?: string; hint?: string;
  /** Show this field only when it applies (e.g. SMTP host only for the SMTP provider). Hidden fields are not sent. */
  show?: (form: Record<string, string>) => boolean;
}

/**
 * Secure credential card: values are sent once to the server, stored encrypted, and never shown again
 * (only masked hints). New values are saved as "pending", tested on the server, then activated.
 */
export const CredentialCard: React.FC<{
  provider: Provider;
  title: string;
  description: React.ReactNode;
  view: CredentialView | undefined;
  canEncrypt: boolean;
  fields: CredField[];
  /** Extra re-authentication rules (Razorpay live keys are built in). */
  requiresPassword?: (action: CredAction, form: Record<string, string>, pending: CredentialView['pending']) => boolean;
  reauthMessage?: (action: CredAction) => string;
  /** Providers with nothing to test end-to-end from here (stored for Supabase, etc.) */
  activateWithoutTest?: boolean;
  testExtra?: React.ReactNode;
  testPayload?: () => Record<string, unknown>;
  onChanged: (v: CredentialView) => void;
  children?: React.ReactNode;
}> = ({ provider, title, description, view, canEncrypt, fields, requiresPassword, reauthMessage, activateWithoutTest, testExtra, testPayload, onChanged, children }) => {
  const { showToast } = useCartWishlist();
  const [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, f.type === 'select' ? f.options?.[0]?.value || '' : ''])));
  const [busy, setBusy] = useState<string | null>(null);
  const [steps, setSteps] = useState<TestStep[] | null>(null);
  const [reauth, setReauth] = useState<null | { action: 'save' | 'activate' | 'revert' }>(null);

  useEffect(() => {
    // Pre-fill non-secret values from the pending or active configuration
    const cfg = view?.pending?.publicConfig || view?.active?.publicConfig || {};
    setForm((f) => ({ ...f, ...Object.fromEntries(fields.filter((x) => !x.secret && cfg[x.key]).map((x) => [x.key, cfg[x.key]])) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.pending?.updatedAt, view?.active?.updatedAt]);

  const reload = async () => onChanged(await settingsAdmin.credentials.get(provider));

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e: any) {
      if (e instanceof SettingsApiError && e.extra?.reauth) showToast(e.message, 'warning');
      else showToast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const doSave = (password?: string) =>
    run('Saving…', async () => {
      const visibleValues = Object.fromEntries(Object.entries(form).filter(([k]) => { const fd = fields.find((x) => x.key === k); return !fd?.show || fd.show(form); }));
      await settingsAdmin.credentials.save(provider, { ...visibleValues, password });
      setForm((f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, fields.find((x) => x.key === k)?.secret ? '' : v])));
      setSteps(null);
      showToast('Saved securely as pending. Now run "Test configuration".', 'success');
      await reload();
    });
  const doTest = (slot: 'pending' | 'active') =>
    run('Testing…', async () => {
      const r = await settingsAdmin.credentials.test(provider, slot, testPayload?.() || {});
      setSteps(r.steps);
      showToast(r.ok ? 'Test passed' : 'Test found problems. See the results below.', r.ok ? 'success' : 'warning');
      await reload();
    });
  const doActivate = (password?: string) =>
    run('Activating…', async () => {
      const r = await settingsAdmin.credentials.activate(provider, password);
      onChanged(r.view);
      setSteps(null);
      showToast('Activated. New payments/emails now use these credentials.', 'success');
    });
  const doRevert = (password?: string) =>
    run('Reverting…', async () => {
      const r = await settingsAdmin.credentials.discard(provider, 'active', password);
      onChanged(r.view);
      showToast('Admin-panel credentials removed. The server environment keys are used again.', 'success');
    });

  const pending = view?.pending;
  const active = view?.active;
  const needsPw = (action: CredAction) =>
    provider === 'razorpay' && (action === 'revert' || (action === 'save' ? form.mode === 'live' : pending?.publicConfig?.mode === 'live'));

  const ask = (action: CredAction) => {
    if (needsPw(action) || requiresPassword?.(action, form, pending ?? null)) setReauth({ action });
    else if (action === 'save') doSave();
    else if (action === 'activate') doActivate();
    else doRevert();
  };

  return (
    <Card title={title} description={description}>
      <div className="grid md:grid-cols-2 gap-4 mb-5">
        <div className="rounded-xl border border-[#E2E8F0] p-4">
          <div className="text-[12px] font-bold uppercase tracking-wide text-[#64748B]">In use now</div>
          {view?.inUse ? (
            <div className="mt-1.5 text-[14.5px] text-[#111827] space-y-0.5">
              <div className="font-semibold flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-600" /> {view.inUse.source === 'admin' ? 'Admin panel (encrypted)' : 'Server environment (.env)'}</div>
              {Object.entries(view.inUse).filter(([k]) => k !== 'source').map(([k, v]) => <div key={k} className="text-[#475569]">{k}: <span className="font-mono">{String(v)}</span></div>)}
              {active?.hints && Object.entries(active.hints).map(([k, v]) => v && <div key={k} className="text-[#475569]">{k}: <span className="font-mono">{v}</span></div>)}
              {active?.verifiedAt && <div className="text-[13px] text-emerald-700">Verified {fmtWhen(active.verifiedAt)}</div>}
            </div>
          ) : (
            <div className="mt-1.5 text-[14.5px] text-rose-700">Not configured</div>
          )}
        </div>
        <div className="rounded-xl border border-[#E2E8F0] p-4">
          <div className="text-[12px] font-bold uppercase tracking-wide text-[#64748B]">Waiting for activation</div>
          {pending ? (
            <div className="mt-1.5 text-[14.5px] text-[#111827] space-y-0.5">
              {Object.entries(pending.publicConfig).map(([k, v]) => v && <div key={k}>{k}: <span className="font-mono">{v}</span></div>)}
              {Object.entries(pending.hints).map(([k, v]) => v && <div key={k} className="text-[#475569]">{k}: <span className="font-mono">{v}</span></div>)}
              <div className={`text-[13px] font-semibold ${pending.status === 'verified' ? 'text-emerald-700' : pending.status === 'failed' ? 'text-rose-700' : 'text-amber-700'}`}>
                {pending.status === 'verified' ? 'Test passed — ready to activate' : pending.status === 'failed' ? `Test failed: ${pending.lastError || ''}` : 'Not tested yet'}
              </div>
            </div>
          ) : (
            <div className="mt-1.5 text-[14.5px] text-[#64748B]">Nothing pending</div>
          )}
        </div>
      </div>

      {!canEncrypt ? (
        <Note tone="warn">Saving credentials here needs <code>SETTINGS_ENCRYPTION_KEY</code> on the server (see ENVIRONMENT_VARIABLES.md). Until then the server environment keys are used, and you can still run a test of them.</Note>
      ) : (
        <form className="grid sm:grid-cols-2 gap-4" autoComplete="off" onSubmit={(e) => { e.preventDefault(); ask('save'); }}>
          {fields.filter((f) => !f.show || f.show(form)).map((f) => (
            <label key={f.key} className={`block ${f.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
              <span className="text-[15px] font-semibold text-[#111827]">{f.label}</span>
              {f.hint && <span className="block text-[13px] text-[#64748B]">{f.hint}</span>}
              {f.type === 'select' ? (
                <select className="ed-field mt-1.5" value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
              ) : f.type === 'textarea' ? (
                <textarea className="ed-field mt-1.5 !h-auto py-2.5 font-mono text-[13px]" rows={2} placeholder={f.placeholder} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              ) : (
                <input
                  className="ed-field mt-1.5 font-mono"
                  type={f.secret ? 'password' : 'text'}
                  autoComplete={f.secret ? 'new-password' : 'off'}
                  placeholder={f.secret ? (active?.hints?.[f.key] || pending?.hints?.[f.key] ? 'Leave empty to keep the saved value' : f.placeholder) : f.placeholder}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value.trim() })}
                />
              )}
            </label>
          ))}
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <button type="submit" disabled={!!busy} className="ed-btn ed-btn-filled ed-btn-sm"><KeyRound className="w-4 h-4" /> Save securely</button>
          </div>
        </form>
      )}

      <div className="mt-5 pt-5 border-t border-[#EEF2F7] flex flex-wrap items-center gap-2">
        {testExtra}
        <button onClick={() => doTest(pending ? 'pending' : 'active')} disabled={!!busy || (!pending && !view?.inUse)} className="ed-btn ed-btn-tonal ed-btn-sm"><FlaskConical className="w-4 h-4" /> Test configuration{pending ? ' (pending)' : ''}</button>
        {pending && <button onClick={() => ask('activate')} disabled={!!busy || (pending.status !== 'verified' && provider !== 'emovur' && !activateWithoutTest)} className="ed-btn ed-btn-filled ed-btn-sm"><Zap className="w-4 h-4" /> Activate</button>}
        {pending && <button onClick={() => run('Discarding…', async () => { const r = await settingsAdmin.credentials.discard(provider, 'pending'); onChanged(r.view); setSteps(null); })} disabled={!!busy} className="ed-btn ed-btn-text ed-btn-sm">Discard pending</button>}
        {active && <button onClick={() => window.confirm('Remove the admin-panel credentials and go back to the server environment keys?') && ask('revert')} disabled={!!busy} className="ed-btn ed-btn-text ed-btn-sm !text-rose-600"><Trash2 className="w-4 h-4" /> Use environment keys</button>}
        {busy && <span className="text-[14px] text-[#004AAD] font-semibold">{busy}</span>}
      </div>
      {steps && <div className="mt-4"><StepList steps={steps} /></div>}
      {children}

      <ReauthModal
        open={!!reauth}
        title="Confirm with your password"
        message={
          reauth && reauthMessage
            ? reauthMessage(reauth.action)
            : reauth?.action === 'activate' ? 'You are activating LIVE payment credentials. Real customer payments will use them immediately.' : reauth?.action === 'revert' ? 'Payments will switch back to the keys in the server environment.' : 'You are saving LIVE payment credentials.'
        }
        busy={!!busy}
        onCancel={() => setReauth(null)}
        onConfirm={(pw) => {
          const a = reauth?.action;
          setReauth(null);
          if (a === 'save') doSave(pw);
          else if (a === 'activate') doActivate(pw);
          else doRevert(pw);
        }}
      />
    </Card>
  );
};

/* ------------------------------------------------------------------ Payment */
const PAYMENT: FieldDef[] = [
  { key: 'enabled', label: 'Online payments enabled', kind: 'bool', wide: true, hint: 'Off = checkout shows “temporarily unavailable” on the website and app (the server refuses new orders).' },
  { key: 'displayName', label: 'Payment gateway display name', kind: 'text', max: 60 },
  { key: 'currency', label: 'Currency', kind: 'select', options: [{ value: 'INR', label: 'INR (₹)' }], hint: 'Course prices are stored in rupees, so INR is the only safe choice.' },
  { key: 'instructions', label: 'Payment instructions (shown at checkout)', kind: 'longtext', max: 400, wide: true },
];

export const PaymentPanel: React.FC<PanelProps & { cred?: CredentialView; canEncrypt: boolean; superAdmin: boolean; lastWebhook: { at: string; event: string } | null; onCred: (v: CredentialView) => void }> = ({ value, onSaved, cred, canEncrypt, superAdmin, lastWebhook, onCred }) => {
  const f = useSectionForm('payment', value, onSaved);
  // The webhook goes to the API server (e.g. https://api.edufyacademy.com), not the website domain
  const apiBase = /^https?:\/\//i.test(API_BASE_URL) ? API_BASE_URL : `${window.location.origin}${API_BASE_URL.startsWith('/') ? '' : '/'}${API_BASE_URL}`;
  const webhookUrl = `${apiBase.replace(/^http:/, 'https:').replace(/\/+$/, '')}/payments/webhook`;
  return (
    <div>
      <PanelHeader title="Payment gateway (Razorpay)" description="Payment status, credentials and a full server-side test. Secrets never reach the browser or the app." />
      <div className="space-y-5">
        <Card title="Checkout">
          <FieldGrid fields={PAYMENT} draft={f.draft} errors={f.errors} set={f.set} />
          <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => f.save()} onReset={f.reset} savedAt={f.savedAt} />
        </Card>
        {superAdmin ? (
          <CredentialCard
            provider="razorpay"
            title="Razorpay credentials"
            description="Razorpay Dashboard → Account & Settings → API Keys. Live keys need your password, and keys are used only after a successful test and activation."
            view={cred}
            canEncrypt={canEncrypt}
            onChanged={onCred}
            fields={[
              { key: 'mode', label: 'Mode', type: 'select', options: [{ value: 'test', label: 'Test mode (rzp_test_…)' }, { value: 'live', label: 'Live mode (rzp_live_…)' }] },
              { key: 'keyId', label: 'Key ID', placeholder: 'rzp_live_XXXXXXXXXXXX' },
              { key: 'keySecret', label: 'Key Secret', secret: true, placeholder: 'Key secret' },
              { key: 'webhookSecret', label: 'Webhook secret (optional)', secret: true, placeholder: 'Same text as in Razorpay → Webhooks', hint: 'Empty = keep the server environment webhook secret.' },
            ]}
          />
        ) : (
          <Note tone="warn">Only a super administrator can view or change payment credentials.</Note>
        )}
        <Card title="Webhook" description="Backup for enrollment if a student closes the browser right after paying.">
          <div className="text-[14.5px] text-[#334155] space-y-1.5">
            <div>URL: <code className="px-1.5 py-0.5 rounded bg-[#F1F5F9] break-all">{webhookUrl}</code></div>
            <div>Events: <code>payment.captured</code>, <code>order.paid</code>, <code>refund.processed</code></div>
            <div>Last verified webhook: {lastWebhook ? <strong className="text-emerald-700">{fmtWhen(lastWebhook.at)} ({lastWebhook.event})</strong> : <span className="text-amber-700">none received yet</span>}</div>
          </div>
        </Card>
        <Note>Supported payment methods (UPI, cards, net banking, wallets, EMI) are switched on or off in your Razorpay Dashboard → Payment Methods; Razorpay checkout shows whatever your account allows.</Note>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ WhatsApp page = public fields + Emovur */
export const WhatsAppPanel: React.FC<PanelProps & { cred?: CredentialView; canEncrypt: boolean; onCred: (v: CredentialView) => void }> = ({ value, defaults, onSaved, cred, canEncrypt, onCred }) => (
  <div>
    <PanelHeader title="WhatsApp settings" description="The floating website button, pre-filled messages and the app’s WhatsApp support link." />
    <div className="space-y-5">
      <WhatsAppFields value={value} defaults={defaults} onSaved={onSaved} />
      <CredentialCard
        provider="emovur"
        title="Emovur API (WhatsApp Business messaging)"
        description="Stored encrypted on the server and never sent to the website or app."
        view={cred}
        canEncrypt={canEncrypt}
        onChanged={onCred}
        fields={[
          { key: 'apiBaseUrl', label: 'API base URL', placeholder: 'https://…' },
          { key: 'accountId', label: 'Account / phone number ID', placeholder: 'Optional' },
          { key: 'apiToken', label: 'API token', secret: true, placeholder: 'Token' },
        ]}
      />
      <Note tone="warn">Emovur messaging is not part of the current codebase, so automatic WhatsApp messages are not sent yet. The credentials are kept securely for when the integration is added (needs Emovur’s API documentation).</Note>
    </div>
  </div>
);
