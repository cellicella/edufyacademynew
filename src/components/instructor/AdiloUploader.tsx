import React, { useRef, useState } from 'react';
import { UploadCloud, Film, CheckCircle2, AlertTriangle, Trash2, RefreshCw, X, Link2 } from 'lucide-react';
import { adiloService } from '../../services/api';
import { Lesson } from '../../types';

const MAX_BYTES = 5 * 1024 * 1024 * 1024; // must match the server limit
const CONCURRENCY = 3;

const fmtBytes = (b: number) =>
  b >= 1073741824 ? `${(b / 1073741824).toFixed(2)} GB` : b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
const fmtDuration = (s?: number | null) => {
  if (!s) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};

/** Reads the duration of a local video file via a hidden <video> element. */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(url);
      Number.isFinite(d) && d > 0 ? resolve(Math.round(d)) : reject(new Error('Could not read the video duration.'));
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This file could not be read as a video.'));
    };
    v.src = url;
  });
}

/** PUT a part directly to the Adilo signed URL; resolves with the ETag, or null if the header is not readable. */
function putDirect(url: string, blob: Blob, onProgress: (loaded: number) => void, xhrs: Set<XMLHttpRequest>): Promise<string | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhrs.add(xhr);
    xhr.open('PUT', url);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      xhrs.delete(xhr);
      const etag = xhr.getResponseHeader('ETag');
      resolve(xhr.status >= 200 && xhr.status < 300 && etag ? etag.replace(/"/g, '') : null);
    };
    xhr.onerror = () => {
      xhrs.delete(xhr);
      resolve(null); // usually storage CORS — fall back to the server relay
    };
    xhr.onabort = () => {
      xhrs.delete(xhr);
      resolve(null);
    };
    xhr.send(blob);
  });
}

interface Props {
  lesson: Lesson;
  courseId?: string | null;
  onChange: (fields: Partial<Lesson>) => void;
  notify?: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

type Phase = 'idle' | 'preparing' | 'uploading' | 'completing' | 'done' | 'error';

export const AdiloUploader: React.FC<Props> = ({ lesson, courseId, onChange, notify }) => {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [embedInput, setEmbedInput] = useState(lesson.adiloEmbedUrl || '');
  // Lessons created by the CSV importer carry only a player link (no uploaded Adilo file)
  const [linkOnly] = useState(!lesson.adiloFileId && !!lesson.adiloEmbedUrl);
  const cancelled = useRef(false);
  const xhrs = useRef(new Set<XMLHttpRequest>());
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = phase === 'preparing' || phase === 'uploading' || phase === 'completing';
  // Imported from the Adilo library (not uploaded through Edufy): never deleted from Adilo, only detached
  const fromLibrary = lesson.videoStatus === 'library';

  const validate = (f: File): string | null => {
    if (f.type !== 'video/mp4' || !f.name.toLowerCase().endsWith('.mp4')) return 'Please choose an MP4 video (.mp4).';
    if (f.size <= 0) return 'The selected file is empty.';
    if (f.size > MAX_BYTES) return `Videos must be 5 GB or smaller (this file is ${fmtBytes(f.size)}).`;
    return null;
  };

  const cancel = () => {
    cancelled.current = true;
    xhrs.current.forEach((x) => x.abort());
    setPhase('idle');
    setProgress(0);
    setFile(null);
  };

  const upload = async (f: File) => {
    const invalid = validate(f);
    if (invalid) {
      setError(invalid);
      setPhase('error');
      return;
    }
    cancelled.current = false;
    setFile(f);
    setError(null);
    setProgress(0);
    setPhase('preparing');
    const previousFileId = fromLibrary ? null : lesson.adiloFileId || null;

    try {
      const durationSeconds = await readDuration(f);
      const { uploadId, partSize, totalParts } = await adiloService.start({
        filename: f.name,
        filesize: f.size,
        durationSeconds,
        mimeType: 'video/mp4',
        courseId: courseId || null,
      });
      if (cancelled.current) return;
      setPhase('uploading');

      const loadedByPart = new Array(totalParts).fill(0);
      const report = () => setProgress(Math.min(99, Math.round((loadedByPart.reduce((a, b) => a + b, 0) / f.size) * 100)));
      const parts: { PartNumber: number; ETag: string }[] = [];
      let next = 1;

      const worker = async () => {
        while (next <= totalParts && !cancelled.current) {
          const partNumber = next++;
          const start = (partNumber - 1) * partSize;
          const blob = f.slice(start, Math.min(start + partSize, f.size));
          const onProgress = (loaded: number) => {
            loadedByPart[partNumber - 1] = loaded;
            report();
          };
          const { url } = await adiloService.signPart(uploadId, partNumber);
          let etag = await putDirect(url, blob, onProgress, xhrs.current);
          if (!etag && !cancelled.current) {
            onProgress(0);
            etag = await adiloService.proxyPart(uploadId, partNumber, blob, onProgress);
          }
          if (cancelled.current) return;
          if (!etag) throw new Error(`Part ${partNumber} did not return an ETag.`);
          loadedByPart[partNumber - 1] = blob.size;
          report();
          parts.push({ PartNumber: partNumber, ETag: etag });
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, totalParts) }, worker));
      if (cancelled.current) return;

      setPhase('completing');
      const result = await adiloService.complete(
        uploadId,
        parts.sort((a, b) => a.PartNumber - b.PartNumber)
      );

      onChange({
        type: 'video',
        adiloFileId: result.fileId,
        adiloEmbedUrl: result.embedUrl,
        videoTitle: result.title,
        videoDuration: result.durationSeconds,
        videoStatus: result.status,
        durationMinutes: Math.max(1, Math.round(result.durationSeconds / 60)),
      });
      setEmbedInput(result.embedUrl || '');
      setProgress(100);
      setPhase('done');
      notify?.('Video uploaded to Adilo. Save the course to attach it to this lesson.', 'success');

      // Replacing: remove the previous Adilo file once the new one is in place
      if (previousFileId && previousFileId !== result.fileId) {
        adiloService
          .deleteFile(previousFileId)
          .then(() => notify?.('Previous video removed from Adilo.', 'info'))
          .catch((e) => notify?.(`New video uploaded, but the old one could not be deleted: ${e.message}`, 'warning'));
      }
    } catch (e: any) {
      if (cancelled.current) return;
      setError(e?.message || 'Upload failed.');
      setPhase('error');
    }
  };

  const remove = async () => {
    if (!lesson.adiloFileId) return;
    if (fromLibrary) {
      if (!window.confirm('Remove this video from the lesson? It stays in your Adilo library. Save the course to apply.')) return;
      onChange({ adiloFileId: null, adiloEmbedUrl: null, videoTitle: null, videoDuration: null, videoStatus: null });
      setEmbedInput('');
      setPhase('idle');
      setFile(null);
      notify?.('Video removed from the lesson (kept in Adilo). Save the course to apply.', 'info');
      return;
    }
    if (!window.confirm('Delete this video from Adilo? Learners will no longer be able to watch it.')) return;
    setDeleting(true);
    try {
      await adiloService.deleteFile(lesson.adiloFileId);
      onChange({ adiloFileId: null, adiloEmbedUrl: null, videoTitle: null, videoDuration: null, videoStatus: null });
      setEmbedInput('');
      setPhase('idle');
      setFile(null);
      notify?.('Video deleted from Adilo.', 'info');
    } catch (e: any) {
      notify?.(e.message || 'Could not delete the video.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const embedValid = !embedInput || /^https:\/\/adilo\.bigcommand\.com\//.test(embedInput.match(/src=["']([^"']+)["']/i)?.[1] || embedInput.trim());

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[14px] font-semibold text-[#334155] flex items-center gap-1.5">
          <Film className="w-4 h-4 text-[#004AAD]" /> Adilo video hosting
        </div>
        {lesson.adiloFileId && <span className="text-[12px] font-mono text-[#64748B]">ID {lesson.adiloFileId}</span>}
      </div>

      {/* Current video */}
      {lesson.adiloFileId && !busy && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-[#F7F9FC]">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-[#111827] truncate">{lesson.videoTitle || 'Uploaded video'}</div>
            <div className="text-[13px] text-[#64748B]">
              {lesson.videoDuration ? `${fmtDuration(lesson.videoDuration)} · ` : ''}{fromLibrary ? 'From your Adilo library' : `Status: ${lesson.videoStatus || 'uploaded'}`}
            </div>
          </div>
          <button type="button" onClick={() => inputRef.current?.click()} className="ed-btn ed-btn-tonal ed-btn-sm">
            <RefreshCw className="w-4 h-4" /> Replace
          </button>
          <button type="button" onClick={remove} disabled={deleting} className="ed-btn ed-btn-text ed-btn-sm !text-rose-600">
            <Trash2 className="w-4 h-4" /> {fromLibrary ? 'Remove' : deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      )}

      {linkOnly && !lesson.adiloFileId && !busy && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F7F9FC] text-[14px] text-[#334155]">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> Linked Adilo video (imported from CSV) — edit the player link below.
        </div>
      )}

      {/* Picker */}
      {!lesson.adiloFileId && !linkOnly && !busy && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-1 py-6 rounded-xl border-2 border-dashed border-[#CBD5E1] hover:border-[#004AAD] hover:bg-[#F7F9FC] transition"
        >
          <UploadCloud className="w-7 h-7 text-[#004AAD]" />
          <span className="text-[15px] font-semibold text-[#111827]">Upload MP4 to Adilo</span>
          <span className="text-[13px] text-[#64748B]">MP4 only · up to 5 GB · uploaded in 10 MB parts</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,.mp4"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) upload(f);
        }}
      />

      {/* Progress */}
      {busy && file && (
        <div className="p-3 rounded-xl bg-[#F7F9FC] space-y-2">
          <div className="flex items-center justify-between gap-3 text-[14px]">
            <span className="font-medium text-[#111827] truncate">{file.name}</span>
            <span className="text-[#64748B] shrink-0">{fmtBytes(file.size)}</span>
          </div>
          <div className="h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
            <div className="h-full bg-[#004AAD] transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between text-[13px] text-[#64748B]">
            <span>
              {phase === 'preparing' && 'Reading video & starting upload…'}
              {phase === 'uploading' && `Uploading… ${progress}%`}
              {phase === 'completing' && 'Finalising with Adilo…'}
            </span>
            {phase !== 'completing' && (
              <button type="button" onClick={cancel} className="inline-flex items-center gap-1 text-rose-600">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {phase === 'error' && error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 text-rose-800 text-[14px]">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Player link (the Adilo API docs do not define an embed URL field) */}
      {(lesson.adiloFileId || linkOnly) && !busy && (
        <div className="space-y-1.5">
          <label className="text-[13px] font-semibold text-[#334155] flex items-center gap-1.5">
            <Link2 className="w-4 h-4" /> Adilo player link {lesson.adiloEmbedUrl ? '' : <span className="text-amber-700 font-normal">(required for playback)</span>}
          </label>
          <input
            value={embedInput}
            onChange={(e) => {
              setEmbedInput(e.target.value);
              const raw = e.target.value.match(/src=["']([^"']+)["']/i)?.[1] || e.target.value.trim();
              onChange({ adiloEmbedUrl: /^https:\/\/adilo\.bigcommand\.com\//.test(raw) ? raw : null });
            }}
            placeholder="Paste the embed link or iframe code from Adilo → Share → Embed"
            className={`ed-field !h-11 text-[14px] ${embedValid ? '' : '!border-rose-400'}`}
          />
          {!embedValid && <p className="text-[12px] text-rose-600">The link must start with https://adilo.bigcommand.com/</p>}
        </div>
      )}
    </div>
  );
};
