import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Search, Copy, Trash2, RefreshCw, X, Image as ImageIcon, Check, AlertTriangle } from 'lucide-react';
import { ASSET_TYPE_LABELS, MediaItem, formatBytes, prepareImage, settingsAdmin } from '../../services/settingsAdmin';
import { useCartWishlist } from '../../context/CartWishlistContext';

/**
 * Media library (Supabase Storage bucket "site-assets", records in media_assets).
 * mode="manage": full manager (upload many, search, filter, replace, copy URL, delete unused).
 * mode="pick": same grid, clicking an image returns its URL.
 */
export const MediaLibrary: React.FC<{ mode?: 'manage' | 'pick'; assetType?: string; onPick?: (url: string) => void }> = ({ mode = 'manage', assetType, onPick }) => {
  const { showToast } = useCartWishlist();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [type, setType] = useState(assetType || '');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState(assetType || 'other');
  const replaceFor = useRef<MediaItem | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async (offset = 0) => {
    setLoading(true);
    try {
      const r = await settingsAdmin.media.list({ type: type || undefined, q: q.trim() || undefined, offset });
      setItems((prev) => (offset ? [...prev, ...r.items] : r.items));
      setTotal(r.total);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [type, q]);

  useEffect(() => {
    const t = window.setTimeout(() => load(0), 250);
    return () => window.clearTimeout(t);
  }, [load]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    let ok = 0;
    for (const file of Array.from(files).slice(0, 20)) {
      setBusy(`Uploading ${file.name}…`);
      try {
        const p = await prepareImage(file, uploadType);
        const r = await settingsAdmin.media.upload({ fileBase64: p.base64, fileName: p.fileName, assetType: uploadType });
        ok++;
        if (mode === 'pick' && files.length === 1) onPick?.(r.item.url);
      } catch (e: any) {
        showToast(`${file.name}: ${e.message}`, 'error');
      }
    }
    setBusy(null);
    if (ok) showToast(`${ok} image${ok > 1 ? 's' : ''} uploaded`, 'success');
    load(0);
  };

  const replace = async (file?: File) => {
    const m = replaceFor.current;
    if (!file || !m) return;
    setBusy(`Replacing ${m.file_name || 'image'}…`);
    try {
      const p = await prepareImage(file, m.asset_type);
      await settingsAdmin.media.update(m.id, { fileBase64: p.base64, fileName: p.fileName });
      showToast(m.usages.length ? `Image replaced and updated in ${m.usages.length} place(s)` : 'Image replaced', 'success');
      load(0);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setBusy(null);
      replaceFor.current = null;
    }
  };

  const remove = async (m: MediaItem) => {
    if (m.usages.length) return showToast(`In use: ${m.usages.slice(0, 3).join(', ')}. Replace it there first.`, 'warning');
    if (!window.confirm(`Delete “${m.file_name || 'this image'}” permanently?`)) return;
    try {
      await settingsAdmin.media.remove(m.id);
      showToast('Image deleted', 'success');
      setItems((list) => list.filter((x) => x.id !== m.id));
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Image URL copied', 'success');
    } catch {
      window.prompt('Copy the image URL:', url);
    }
  };

  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input className="ed-field !pl-10" placeholder="Search by file name or description" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {!assetType && (
          <select className="ed-field lg:!w-56" value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
            <option value="">All types</option>
            {Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
        <div className="flex gap-2">
          {!assetType && (
            <select className="ed-field !w-44" value={uploadType} onChange={(e) => setUploadType(e.target.value)} aria-label="Type for new uploads">
              {Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
          <label className="ed-btn ed-btn-filled ed-btn-sm cursor-pointer shrink-0">
            <Upload className="w-4 h-4" /> Upload
            <input type="file" multiple={mode === 'manage'} accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon" className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
          </label>
        </div>
      </div>

      {busy && <div className="mb-4 p-3 rounded-xl bg-[#E8EFFB] text-[#004AAD] text-[14px] font-semibold">{busy}</div>}
      {error && (
        <div className="mb-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-[15px] text-rose-800 flex gap-2"><AlertTriangle className="w-5 h-5 shrink-0" />{error}</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((m) => (
          <div key={m.id} className="group bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden flex flex-col">
            <button
              type="button"
              onClick={() => (mode === 'pick' ? onPick?.(m.url) : copy(m.url))}
              className="aspect-video bg-[repeating-conic-gradient(#F1F5F9_0_25%,#fff_0_50%)] bg-[length:16px_16px] flex items-center justify-center overflow-hidden"
              title={mode === 'pick' ? 'Use this image' : 'Copy URL'}
            >
              <img src={m.url} alt={m.alt_text || ''} loading="lazy" className="max-w-full max-h-full object-contain" />
            </button>
            <div className="p-3 text-[13px] space-y-1 flex-1">
              <div className="font-semibold text-[#111827] truncate" title={m.file_name || ''}>{m.file_name || 'Untitled'}</div>
              <div className="text-[#64748B]">
                {ASSET_TYPE_LABELS[m.asset_type] || m.asset_type} · {m.width && m.height ? `${m.width}×${m.height}` : m.mime_type.replace('image/', '').toUpperCase()} · {formatBytes(m.size_bytes)}
              </div>
              {m.usages.length > 0 ? (
                <div className="text-emerald-700" title={m.usages.join('\n')}><Check className="w-3.5 h-3.5 inline" /> In use ({m.usages.length})</div>
              ) : (
                <div className="text-[#94A3B8]">Not used</div>
              )}
            </div>
            {mode === 'manage' && (
              <div className="flex border-t border-[#EEF2F7]">
                <button onClick={() => copy(m.url)} className="flex-1 py-2 hover:bg-[#F7F9FC] text-[#334155]" title="Copy URL" aria-label="Copy URL"><Copy className="w-4 h-4 mx-auto" /></button>
                <button onClick={() => { replaceFor.current = m; replaceInput.current?.click(); }} className="flex-1 py-2 hover:bg-[#F7F9FC] text-[#334155]" title="Replace image everywhere it is used" aria-label="Replace"><RefreshCw className="w-4 h-4 mx-auto" /></button>
                <button onClick={() => remove(m)} disabled={m.usages.length > 0} className="flex-1 py-2 hover:bg-rose-50 text-rose-600 disabled:opacity-30" title={m.usages.length ? 'In use, cannot delete' : 'Delete'} aria-label="Delete"><Trash2 className="w-4 h-4 mx-auto" /></button>
              </div>
            )}
          </div>
        ))}
      </div>
      <input ref={replaceInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon" className="hidden" onChange={(e) => { replace(e.target.files?.[0]); e.target.value = ''; }} />
      {!loading && !items.length && !error && (
        <div className="py-14 text-center text-[#64748B]"><ImageIcon className="w-8 h-8 mx-auto mb-2 text-[#94A3B8]" />No images yet. Upload your first one.</div>
      )}
      {items.length < total && (
        <div className="mt-6 text-center"><button onClick={() => load(items.length)} className="ed-btn ed-btn-outlined ed-btn-sm">Load more ({total - items.length})</button></div>
      )}
    </div>
  );
};

/** Modal wrapper around the library in pick mode. */
export const MediaPickerModal: React.FC<{ open: boolean; assetType?: string; title?: string; onClose: () => void; onPick: (url: string) => void }> = ({ open, assetType, title, onClose, onPick }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label={title || 'Choose an image'}>
      <div className="fixed inset-0 bg-[#111827]/40" onClick={onClose} />
      <div className="relative w-full max-w-5xl bg-white rounded-[28px] shadow-2xl my-8 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-[22px] font-bold text-[#111827]">{title || 'Choose an image'}</h2>
          <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-[#F1F5F9] flex items-center justify-center" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <MediaLibrary mode="pick" assetType={assetType} onPick={(u) => { onPick(u); onClose(); }} />
      </div>
    </div>
  );
};

/** Image setting: preview + choose/upload from the library + remove. */
export const ImageField: React.FC<{
  label: string;
  value: string;
  onChange: (url: string) => void;
  assetType: string;
  hint?: string;
  error?: string;
  previewClass?: string;
  dark?: boolean;
}> = ({ label, value, onChange, assetType, hint, error, previewClass = 'h-24', dark }) => {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [value]);
  return (
    <div>
      <span className="text-[15px] font-semibold text-[#111827]">{label}</span>
      {hint && <p className="text-[13px] text-[#64748B]">{hint}</p>}
      <div className="mt-2 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className={`${previewClass} w-full sm:w-48 rounded-xl border border-[#E2E8F0] flex items-center justify-center overflow-hidden ${dark ? 'bg-[#0B1220]' : 'bg-[repeating-conic-gradient(#F1F5F9_0_25%,#fff_0_50%)] bg-[length:16px_16px]'}`}>
          {value && !broken ? <img src={value} alt="" className="max-w-full max-h-full object-contain" onError={() => setBroken(true)} /> : <span className="text-[13px] text-[#94A3B8] px-2 text-center">{broken ? 'Image could not be loaded' : 'Default'}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setOpen(true)} className="ed-btn ed-btn-tonal ed-btn-sm"><Upload className="w-4 h-4" /> {value ? 'Replace' : 'Upload / choose'}</button>
          {value && <button type="button" onClick={() => onChange('')} className="ed-btn ed-btn-text ed-btn-sm !text-rose-600"><X className="w-4 h-4" /> Remove (use default)</button>}
        </div>
      </div>
      {error && <p className="mt-1 text-[13px] text-rose-600">{error}</p>}
      <MediaPickerModal open={open} assetType={assetType} title={label} onClose={() => setOpen(false)} onPick={onChange} />
    </div>
  );
};
