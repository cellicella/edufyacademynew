import React, { useEffect, useState } from 'react';
import { Save, RotateCcw, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { Section, SettingsApiError, settingsAdmin } from '../../../services/settingsAdmin';
import { useSiteSettings } from '../../../context/SettingsContext';
import { useCartWishlist } from '../../../context/CartWishlistContext';

/* Shared building blocks for the Settings & Configuration panels. */

export type FieldKind = 'text' | 'longtext' | 'url' | 'email' | 'phone' | 'bool' | 'version' | 'datetime' | 'select' | 'number';
export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  hint?: string;
  max?: number;
  options?: { value: string; label: string }[];
  placeholder?: string;
  wide?: boolean;
}

export interface PanelProps {
  value: any;
  defaults: any;
  onSaved: (section: Section, value: any) => void;
}

/** Local draft + save/validation state for one settings section. */
export function useSectionForm(section: Section, initial: any, onSaved: PanelProps['onSaved']) {
  const { showToast } = useCartWishlist();
  const { refresh } = useSiteSettings();
  const [draft, setDraft] = useState<any>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => setDraft(initial), [initial]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const set = (key: string, v: any) => {
    setDraft((d: any) => ({ ...d, [key]: v }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  const save = async (override?: any) => {
    setSaving(true);
    setErrors({});
    try {
      const r = await settingsAdmin.save(section, override ?? draft);
      onSaved(section, r.value);
      setDraft(r.value);
      setSavedAt(Date.now());
      await refresh();
      showToast(r.unchanged ? 'No changes to save' : 'Saved. The website updates now; the app picks it up within a few minutes.', 'success');
      return true;
    } catch (e: any) {
      if (e instanceof SettingsApiError && e.errors) setErrors(e.errors);
      showToast(e.message || 'Could not save', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { draft, setDraft, set, errors, saving, dirty, save, savedAt, reset: () => { setDraft(initial); setErrors({}); } };
}

export const PanelHeader: React.FC<{ title: string; description?: React.ReactNode; children?: React.ReactNode }> = ({ title, description, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
    <div>
      <h2 className="font-display text-[26px] font-extrabold text-[#111827] leading-tight">{title}</h2>
      {description && <p className="mt-1.5 text-[15.5px] text-[#64748B] max-w-3xl">{description}</p>}
    </div>
    {children}
  </div>
);

export const Card: React.FC<{ title?: string; description?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, description, children, className = '' }) => (
  <section className={`bg-white rounded-[20px] border border-[#E2E8F0] p-5 sm:p-6 ${className}`}>
    {title && <h3 className="font-display text-[18px] font-bold text-[#111827]">{title}</h3>}
    {description && <p className="mt-1 text-[14px] text-[#64748B]">{description}</p>}
    <div className={title || description ? 'mt-5' : ''}>{children}</div>
  </section>
);

export const Note: React.FC<{ tone?: 'info' | 'warn' | 'ok'; children: React.ReactNode }> = ({ tone = 'info', children }) => {
  const s = { info: 'bg-[#E8EFFB] text-[#0B3A80] border-[#C9DAF7]', warn: 'bg-amber-50 text-amber-900 border-amber-200', ok: 'bg-emerald-50 text-emerald-900 border-emerald-200' }[tone];
  const Icon = tone === 'warn' ? AlertTriangle : tone === 'ok' ? CheckCircle2 : Info;
  return <div className={`p-3.5 rounded-xl border text-[14px] flex gap-2.5 ${s}`}><Icon className="w-4 h-4 mt-0.5 shrink-0" /><div>{children}</div></div>;
};

const toLocal = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const Field: React.FC<{ def: FieldDef; value: any; error?: string; onChange: (v: any) => void }> = ({ def, value, error, onChange }) => {
  const id = `f-${def.key}`;
  if (def.kind === 'bool') {
    return (
      <label htmlFor={id} className="flex items-start gap-3 cursor-pointer py-1">
        <input id={id} type="checkbox" className="w-5 h-5 mt-0.5" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        <span>
          <span className="text-[15px] font-semibold text-[#111827]">{def.label}</span>
          {def.hint && <span className="block text-[13px] text-[#64748B]">{def.hint}</span>}
        </span>
      </label>
    );
  }
  const common = { id, className: `ed-field mt-1.5 ${error ? '!border-rose-400' : ''}`, 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-err` : undefined };
  let input: React.ReactNode;
  if (def.kind === 'longtext') input = <textarea {...common} rows={3} className={`${common.className} !h-auto py-3`} maxLength={def.max} value={value || ''} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />;
  else if (def.kind === 'select') input = <select {...common} value={value || ''} onChange={(e) => onChange(e.target.value)}>{def.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
  else if (def.kind === 'datetime') input = <input {...common} type="datetime-local" value={toLocal(value)} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : '')} />;
  else input = (
    <input
      {...common}
      type={def.kind === 'email' ? 'email' : def.kind === 'url' ? 'url' : def.kind === 'phone' ? 'tel' : 'text'}
      inputMode={def.kind === 'phone' ? 'tel' : undefined}
      maxLength={def.max}
      value={value ?? ''}
      placeholder={def.placeholder || (def.kind === 'url' ? 'https://…' : def.kind === 'phone' ? '+91 98765 43210' : def.kind === 'version' ? '1.0.0' : '')}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  return (
    <label htmlFor={id} className={`block ${def.wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-[15px] font-semibold text-[#111827]">{def.label}</span>
      {def.hint && <span className="block text-[13px] text-[#64748B]">{def.hint}</span>}
      {input}
      {error && <span id={`${id}-err`} className="block mt-1 text-[13px] text-rose-600">{error}</span>}
    </label>
  );
};

export const FieldGrid: React.FC<{ fields: FieldDef[]; draft: any; errors: Record<string, string>; set: (k: string, v: any) => void }> = ({ fields, draft, errors, set }) => (
  <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
    {fields.map((f) => <Field key={f.key} def={f} value={draft?.[f.key]} error={errors[f.key]} onChange={(v) => set(f.key, v)} />)}
  </div>
);

export const SaveBar: React.FC<{ dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void; savedAt?: number | null; extra?: React.ReactNode }> = ({ dirty, saving, onSave, onReset, savedAt, extra }) => (
  <div className="sticky bottom-0 z-10 mt-6 -mx-1 px-1 py-3 bg-[#F7F9FC]/95 backdrop-blur flex flex-wrap items-center gap-3 border-t border-[#E2E8F0]">
    <button onClick={onSave} disabled={saving || !dirty} className="ed-btn ed-btn-filled ed-btn-sm disabled:opacity-50"><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save changes'}</button>
    {dirty && <button onClick={onReset} disabled={saving} className="ed-btn ed-btn-text ed-btn-sm"><RotateCcw className="w-4 h-4" /> Undo changes</button>}
    {!dirty && savedAt && <span className="text-[14px] text-emerald-700 font-semibold inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Saved</span>}
    {dirty && <span className="text-[14px] text-amber-700">Unsaved changes</span>}
    {extra}
  </div>
);

/** Asks for the admin's own password before sensitive changes (live payment keys). */
export const ReauthModal: React.FC<{ open: boolean; title: string; message: React.ReactNode; onCancel: () => void; onConfirm: (password: string) => void; busy?: boolean }> = ({ open, title, message, onCancel, onConfirm, busy }) => {
  const [pw, setPw] = useState('');
  useEffect(() => setPw(''), [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-[#111827]/50" onClick={onCancel} />
      <form className="relative w-full max-w-md bg-white rounded-[24px] shadow-2xl p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); if (pw) onConfirm(pw); }}>
        <h2 className="font-display text-[22px] font-bold text-[#111827]">{title}</h2>
        <div className="text-[15px] text-[#475569]">{message}</div>
        <label className="block">
          <span className="text-[15px] font-semibold text-[#111827]">Your admin password</span>
          <input type="password" autoComplete="current-password" className="ed-field mt-1.5" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </label>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="ed-btn ed-btn-outlined ed-btn-sm">Cancel</button>
          <button type="submit" disabled={!pw || busy} className="ed-btn ed-btn-filled ed-btn-sm">{busy ? 'Checking…' : 'Confirm'}</button>
        </div>
      </form>
    </div>
  );
};

export const StepList: React.FC<{ steps: { id: string; label: string; status: string; detail: string }[] }> = ({ steps }) => (
  <ul className="space-y-2">
    {steps.map((s) => {
      const tone = s.status === 'pass' ? 'text-emerald-700 bg-emerald-50' : s.status === 'fail' ? 'text-rose-700 bg-rose-50' : s.status === 'warn' ? 'text-amber-800 bg-amber-50' : 'text-[#334155] bg-[#F1F5F9]';
      const label = { pass: 'PASS', fail: 'FAIL', warn: 'CHECK', manual: 'MANUAL' }[s.status] || s.status;
      return (
        <li key={s.id} className="flex gap-3 items-start text-[14px]">
          <span className={`px-2 h-6 inline-flex items-center rounded-md text-[11.5px] font-bold shrink-0 ${tone}`}>{label}</span>
          <span><span className="font-semibold text-[#111827]">{s.label}.</span> <span className="text-[#475569]">{s.detail}</span></span>
        </li>
      );
    })}
  </ul>
);

export const fmtWhen = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
