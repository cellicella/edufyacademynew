import React, { useEffect, useState } from 'react';
import { CloudUpload, RefreshCw, RotateCcw, SearchCheck } from 'lucide-react';
import { ImagesStatus, MigrationReport, settingsAdmin } from '../../../services/settingsAdmin';
import { Card, Note, fmtWhen } from './settingsKit';

const SKIP_LABELS: Record<string, string> = {
  empty: 'empty fields', not_url: 'not an image address', already_cloudinary: 'already in Cloudinary', video_or_document: 'videos / documents (kept as they are)',
  adilo: 'Adilo video images (kept)', private_storage: 'private files (kept)', other_host: 'other websites (kept)',
};

const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'ghost' | 'danger' }> = ({ tone = 'ghost', className = '', ...p }) => (
  <button
    {...p}
    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[14px] font-bold disabled:opacity-50 ${
      tone === 'primary' ? 'bg-[#004AAD] text-white' : tone === 'danger' ? 'bg-white border border-red-200 text-red-700' : 'bg-white border border-[#E2E8F0] text-[#111827]'
    } ${className}`}
  />
);

/**
 * Cloudinary image CDN: shows whether it is configured, runs a dry run of the migration of existing
 * images, migrates them in small batches (the original files are kept) and can restore the original
 * addresses. All work happens on the server; the Cloudinary secret never reaches the browser.
 */
export const CloudinaryPanel: React.FC = () => {
  const [status, setStatus] = useState<ImagesStatus | null>(null);
  const [report, setReport] = useState<MigrationReport | null>(null);
  const [totals, setTotals] = useState<{ uploaded: number; failed: { url: string; error: string }[]; updated: Record<string, number> } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => settingsAdmin.images.status().then(setStatus).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const dryRun = async () => {
    setBusy('dry'); setError(null); setTotals(null);
    try {
      setReport(await settingsAdmin.images.migrate({ dryRun: true }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
      load();
    }
  };

  // Migrates in batches of 5 (each request stays well inside the hosting time limit) until done
  const migrate = async () => {
    if (!window.confirm('Copy the images to Cloudinary and switch the website and app to the Cloudinary addresses? The original files are kept, and you can restore the original addresses at any time.')) return;
    setBusy('migrate'); setError(null);
    const acc = { uploaded: 0, failed: [] as { url: string; error: string }[], updated: {} as Record<string, number> };
    try {
      for (let round = 0; round < 40; round++) {
        const r = await settingsAdmin.images.migrate({ dryRun: false, limit: 5 });
        acc.uploaded += r.uploadedNow || 0;
        for (const f of r.failures || []) if (!acc.failed.some((x) => x.url === f.url && x.error === f.error)) acc.failed.push(f);
        for (const [k, v] of Object.entries(r.referencesUpdated || {})) acc.updated[k] = (acc.updated[k] || 0) + v;
        setReport(r);
        setTotals({ ...acc });
        if (r.done || !r.uploadedNow) break; // finished, or only failures left
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
      load();
    }
  };

  const rollback = async () => {
    if (!window.confirm('Point every migrated image back to its original Supabase / Unsplash address? Cloudinary copies stay for 7 days.')) return;
    setBusy('rollback'); setError(null);
    try {
      const r = await settingsAdmin.images.rollback();
      setReport(null); setTotals(null);
      window.alert(`Restored: ${Object.entries(r.reverted).map(([k, v]) => `${k} ${v}`).join(', ') || 'nothing to restore'}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
      load();
    }
  };

  const migrated = status ? status.assets['migration:active'] || 0 : 0;

  return (
    <Card title="Cloudinary image CDN" description="New images from the admin panel are stored in Cloudinary and delivered as optimised WebP/AVIF at the right size. Existing images can be copied over here.">
      <div className="space-y-4">
        {!status ? (
          <p className="text-[14px] text-[#64748B]">Checking…</p>
        ) : status.configured ? (
          <Note tone="ok">Connected to Cloudinary cloud <b>{status.cloudName}</b>. {migrated} migrated image{migrated === 1 ? '' : 's'} so far.</Note>
        ) : (
          <Note tone="warn">Cloudinary is not configured on the server yet: add <code>CLOUDINARY_URL</code> to the API environment variables in hPanel, then restart the API. Until then images keep going to Supabase Storage.</Note>
        )}
        {error && <Note tone="warn">{error}</Note>}

        <div className="flex flex-wrap gap-2">
          <Btn onClick={dryRun} disabled={!!busy}><SearchCheck className="w-4 h-4" />{busy === 'dry' ? 'Checking…' : 'Dry run (no changes)'}</Btn>
          <Btn tone="primary" onClick={migrate} disabled={!!busy || !status?.configured || !report}><CloudUpload className="w-4 h-4" />{busy === 'migrate' ? 'Migrating…' : 'Migrate existing images'}</Btn>
          <Btn tone="danger" onClick={rollback} disabled={!!busy || !migrated}><RotateCcw className="w-4 h-4" />{busy === 'rollback' ? 'Restoring…' : 'Restore original addresses'}</Btn>
          <Btn onClick={load} disabled={!!busy}><RefreshCw className="w-4 h-4" />Refresh</Btn>
        </div>
        {!report && <p className="text-[13px] text-[#64748B]">Run the dry run first: it lists what would be copied and changes nothing.</p>}

        {report && (
          <div className="rounded-xl border border-[#E2E8F0] p-4 text-[14px] space-y-3">
            <div className="font-bold text-[#111827]">{report.dryRun ? 'Dry run report' : 'Migration report'}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Images found" value={report.distinctImages} />
              <Stat label="In Cloudinary" value={report.alreadyInCloudinary} />
              <Stat label="Still to copy" value={report.toUpload} />
              <Stat label="Failed" value={totals ? totals.failed.length : report.failedNow || 0} warn />
            </div>
            <div className="text-[#475569]">From Supabase Storage: {report.bySource.supabase} · from Unsplash: {report.bySource.external} · inside articles: {report.inlineHtmlImages} · in settings: {report.settingsImages}</div>
            <div className="text-[#475569]">Uses: {Object.entries(report.references).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}</div>
            {Object.keys(report.skipped).length > 0 && (
              <div className="text-[#64748B]">Not moved: {Object.entries(report.skipped).map(([k, v]) => `${v} ${SKIP_LABELS[k] || k}`).join(' · ')}</div>
            )}
            {totals && (
              <div className="text-[#475569]">
                Copied this session: <b>{totals.uploaded}</b> · addresses updated: {Object.entries(totals.updated).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}
              </div>
            )}
            {totals && totals.failed.length > 0 && (
              <ul className="text-red-700 list-disc pl-5">{totals.failed.map((f, i) => <li key={i}><span className="break-all">{f.url}</span>: {f.error}</li>)}</ul>
            )}
            {report.items && (
              <details>
                <summary className="cursor-pointer text-[#004AAD] font-semibold">Show the {report.items.length} images</summary>
                <ul className="mt-2 space-y-1 text-[13px]">
                  {report.items.map((it, i) => (
                    <li key={i} className="break-all"><span className={it.status === 'in_cloudinary' ? 'text-emerald-700' : 'text-[#64748B]'}>{it.status === 'in_cloudinary' ? '✓' : '•'}</span> {it.url} <span className="text-[#94A3B8]">→ {it.folder}, used {it.references}×</span></li>
                  ))}
                </ul>
              </details>
            )}
            {!report.dryRun && report.done && <Note tone="ok">All images are in Cloudinary. The original files were kept; delete them only after you have checked the website and app.</Note>}
          </div>
        )}
        {status?.lastRun && <p className="text-[13px] text-[#94A3B8]">Last run: {status.lastRun.kind.replace('_', ' ')} · {fmtWhen(status.lastRun.created_at)}</p>}
      </div>
    </Card>
  );
};

const Stat: React.FC<{ label: string; value: number; warn?: boolean }> = ({ label, value, warn }) => (
  <div className="rounded-lg bg-[#F7F9FC] p-3">
    <div className={`text-[20px] font-extrabold ${warn && value ? 'text-red-700' : 'text-[#111827]'}`}>{value}</div>
    <div className="text-[12px] text-[#64748B]">{label}</div>
  </div>
);
