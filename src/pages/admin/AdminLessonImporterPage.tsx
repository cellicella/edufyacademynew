import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, UploadCloud, Trash2, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Download, Layers, Film } from 'lucide-react';
import { courseService, lessonImportService, LessonImportResult } from '../../services/api';
import { Course } from '../../types';
import { AdminPageHeader, ErrorBanner } from '../../components/admin/AdminUI';
import { useCartWishlist } from '../../context/CartWishlistContext';
import { AdiloLibraryImporter } from './AdiloLibraryImporter';

/* ---------------- CSV parsing (RFC 4180: quotes, commas & line breaks inside quotes) ---------------- */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Decode as UTF-8 (BOM stripped); UTF-16 files saved by Excel are detected by their BOM. */
async function readFileText(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf.subarray(2));
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder('utf-16be').decode(buf.subarray(2));
  return new TextDecoder('utf-8').decode(buf).replace(/^﻿/, '');
}

/* ---------------- client-side checks (the server re-validates everything) ---------------- */
const ADILO_HOST = 'adilo.bigcommand.com';
function extractAdiloUrl(input: string): { url: string | null; error?: string } {
  let raw = (input || '').trim();
  if (!raw) return { url: null, error: 'Video link is empty.' };
  if (/<\s*iframe/i.test(raw)) {
    const src = raw.match(/\ssrc\s*=\s*"([^"]+)"/i)?.[1] || raw.match(/\ssrc\s*=\s*'([^']+)'/i)?.[1];
    if (!src) return { url: null, error: 'The iframe code has no src link.' };
    raw = src.replace(/&amp;/gi, '&').trim();
  } else if (/[<>]/.test(raw)) return { url: null, error: 'Only an Adilo link or Adilo iframe code is allowed.' };
  if (raw.startsWith('//')) raw = `https:${raw}`;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return { url: null, error: 'The link must use https.' };
    if (u.host.toLowerCase() !== ADILO_HOST) return { url: null, error: `Only https://${ADILO_HOST} links are allowed.` };
    if (!/\/[A-Za-z0-9_-]{4,}/.test(u.pathname)) return { url: null, error: 'The link has no Adilo video ID.' };
    u.hash = '';
    return { url: u.toString() };
  } catch {
    return { url: null, error: 'Not a valid URL.' };
  }
}

type RowStatus = 'valid' | 'invalid' | 'duplicate' | 'checking';
interface Row {
  key: string;
  csvLine: number;
  title: string;
  embed: string;
  status: RowStatus;
  error: string | null;
}

const SAMPLE = 'topic_name,embed_video_link\nIntroduction to Digital Marketing,https://adilo.bigcommand.com/watch/VIDEO_ID_1\nSEO Basics,https://adilo.bigcommand.com/watch/VIDEO_ID_2\n';

export const AdminLessonImporterPage: React.FC = () => {
  const { showToast } = useCartWishlist();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [sectionMode, setSectionMode] = useState<'existing' | 'new'>('new');
  const [sectionId, setSectionId] = useState('');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<LessonImportResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [source, setSource] = useState<'csv' | 'adilo'>('csv');
  const fileRef = useRef<HTMLInputElement>(null);
  const checkSeq = useRef(0);

  const loadCourses = useCallback(() => courseService.getAdminCourses().then(setCourses).catch((e) => setError(e.message)), []);
  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const course = courses.find((c) => c.id === courseId);
  const targetSectionId = sectionMode === 'existing' && sectionId ? sectionId : null;

  /* Server check: authoritative validation + "Already exists" detection for the chosen section */
  const signature = rows.map((r) => `${r.key}\u0001${r.title}\u0001${r.embed}`).join('\u0002');
  useEffect(() => {
    if (!courseId || rows.length === 0) return;
    const seq = ++checkSeq.current;
    const t = setTimeout(async () => {
      try {
        const res = await lessonImportService.check(courseId, targetSectionId, rows.map((r) => ({ title: r.title, embed: r.embed })));
        if (seq !== checkSeq.current) return;
        setRows((prev) =>
          prev.map((r, i) => {
            const c = res.rows[i];
            return c ? { ...r, status: c.status, error: c.error } : r;
          })
        );
      } catch (e: any) {
        if (seq === checkSeq.current) setError(e.message);
      }
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, courseId, targetSectionId]);

  const localStatus = (title: string, embed: string): Pick<Row, 'status' | 'error'> => {
    const t = title.trim();
    if (!t) return { status: 'invalid', error: 'Topic name is empty.' };
    if (t.length > 200) return { status: 'invalid', error: 'Topic name is longer than 200 characters.' };
    const p = extractAdiloUrl(embed);
    return p.url ? { status: 'checking', error: null } : { status: 'invalid', error: p.error || 'Invalid video link.' };
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setResult(null);
    if (file.size > 5 * 1024 * 1024) return setError('The CSV file is larger than 5 MB.');
    try {
      const table = parseCsv(await readFileText(file));
      if (table.length < 2) throw new Error('The CSV has no lesson rows.');
      const header = table[0].map((h) => h.trim().toLowerCase().replace(/^﻿/, ''));
      const ti = header.indexOf('topic_name');
      const ei = header.indexOf('embed_video_link');
      if (ti < 0 || ei < 0) throw new Error('The first row must contain the columns topic_name and embed_video_link.');
      const parsed = table.slice(1).map((cols, i) => {
        const title = (cols[ti] || '').replace(/\s+/g, ' ').trim();
        const embed = (cols[ei] || '').trim();
        return { key: `r${i}-${Date.now()}`, csvLine: i + 2, title, embed, ...localStatus(title, embed) };
      });
      if (parsed.length > 500) throw new Error(`The CSV has ${parsed.length} rows — import at most 500 at a time.`);
      setRows(parsed);
      setFileName(file.name);
    } catch (e: any) {
      setRows([]);
      setFileName('');
      setError(e.message || 'Could not read the CSV file.');
    }
  };

  const updateRow = (key: string, fields: Partial<Pick<Row, 'title' | 'embed'>>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...fields, ...localStatus(fields.title ?? r.title, fields.embed ?? r.embed) } : r)));
  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));
  const removeInvalid = () => setRows((prev) => prev.filter((r) => r.status !== 'invalid'));

  const counts = useMemo(
    () => ({
      valid: rows.filter((r) => r.status === 'valid').length,
      invalid: rows.filter((r) => r.status === 'invalid').length,
      duplicate: rows.filter((r) => r.status === 'duplicate').length,
      checking: rows.filter((r) => r.status === 'checking').length,
    }),
    [rows]
  );

  const sectionReady = sectionMode === 'existing' ? !!sectionId : newSectionTitle.trim().length > 0;
  const canImport = !!courseId && sectionReady && counts.valid > 0 && counts.checking === 0 && !importing;

  const runImport = async (list: Row[]) => {
    setImporting(true);
    setError(null);
    try {
      const r = await lessonImportService.run({
        courseId,
        sectionId: targetSectionId,
        newSectionTitle: sectionMode === 'new' ? newSectionTitle.trim() : undefined,
        rows: list.map((x) => ({ title: x.title, embed: x.embed })),
      });
      setResult(r);
      setConfirming(false);
      // Further imports / retries go into the same section
      setSectionMode('existing');
      setSectionId(r.section.id);
      // Keep only the rows that failed for a retry
      const failedIdx = new Set(r.results.filter((x) => x.status === 'failed').map((x) => x.index));
      setRows(list.filter((_, i) => failedIdx.has(i)).map((x) => ({ ...x, status: 'checking' as RowStatus })));
      await loadCourses();
      showToast(`${r.created} lessons created, ${r.skipped} skipped, ${r.failed} failed`, r.failed ? 'warning' : 'success');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  const downloadSample = () => {
    const url = URL.createObjectURL(new Blob(['﻿' + SAMPLE], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'edufy-lessons-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const card = 'bg-white rounded-[24px] border border-[#E2E8F0] p-5 sm:p-7';
  const badge = (r: Row) =>
    r.status === 'valid' ? (
      <span className="text-[12px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">Valid</span>
    ) : r.status === 'duplicate' ? (
      <span className="text-[12px] font-semibold text-[#475569] bg-[#F1F5F9] px-2 py-1 rounded">{r.error?.startsWith('Same video') ? 'Duplicate in CSV' : 'Already Exists'}</span>
    ) : r.status === 'invalid' ? (
      <span className="text-[12px] font-semibold text-rose-700 bg-rose-50 px-2 py-1 rounded">Invalid</span>
    ) : (
      <span className="text-[12px] text-[#64748B] inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Checking</span>
    );

  return (
    <div>
      <AdminPageHeader
        eyebrow="Course management"
        title="Bulk lesson importer"
        description="Create video lessons in one go from a CSV of topic names and Adilo links, or straight from your Adilo library."
        actions={
          source === 'csv' ? (
            <button onClick={downloadSample} className="ed-btn ed-btn-outlined ed-btn-sm">
              <Download className="w-4 h-4" /> Sample CSV
            </button>
          ) : undefined
        }
      />
      {error && <ErrorBanner message={error} />}

      {/* Import summary */}
      {result && (
        <section className={`${card} mb-6`}>
          <div className="flex items-center gap-3">
            {result.failed ? <AlertTriangle className="w-7 h-7 text-amber-600" /> : <CheckCircle2 className="w-7 h-7 text-emerald-600" />}
            <h2 className="font-display text-[22px] font-bold">Import {result.failed ? 'finished with errors' : 'complete'}</h2>
          </div>
          <p className="mt-1 text-[15px] text-[#64748B]">
            {result.course.title} → {result.section.title}{result.section.created ? ' (new section)' : ''}
          </p>
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Total CSV rows', result.total, 'text-[#111827]'],
              ['Lessons created', result.created, 'text-emerald-700'],
              ['Skipped duplicates', result.skipped, 'text-[#475569]'],
              ['Failed rows', result.failed, result.failed ? 'text-rose-700' : 'text-[#111827]'],
            ].map(([label, value, cls]) => (
              <div key={label as string} className="p-4 rounded-2xl bg-[#F7F9FC]">
                <div className="text-[13px] text-[#64748B]">{label}</div>
                <div className={`font-display text-[28px] font-bold tabular-nums ${cls}`}>{value}</div>
              </div>
            ))}
          </div>
          {result.results.some((r) => r.status !== 'created') && (
            <ul className="mt-5 divide-y divide-[#EEF2F7] border-y border-[#EEF2F7] max-h-64 overflow-y-auto">
              {result.results.filter((r) => r.status !== 'created').map((r) => (
                <li key={r.index} className="py-2 flex flex-wrap gap-x-3 text-[14px]">
                  <span className={`w-20 font-semibold uppercase text-[12px] pt-0.5 ${r.status === 'failed' ? 'text-rose-700' : 'text-[#64748B]'}`}>{r.status}</span>
                  <span className="flex-1 min-w-0">{r.title || '(no topic name)'}</span>
                  <span className="w-full sm:w-auto text-[13px] text-[#64748B]">{r.error}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            {result.failed > 0 && rows.length > 0 && (
              <span className="text-[14px] text-[#475569] self-center">The {rows.length} failed rows are kept below — fix them and import again.</span>
            )}
            <Link to={`/admin/courses/${result.course.id}/edit`} className="ed-btn ed-btn-outlined ed-btn-sm">Open course editor</Link>
            <Link to={`/courses/${result.course.id}`} className="ed-btn ed-btn-text ed-btn-sm">View course page</Link>
          </div>
        </section>
      )}

      {/* 1 — course & section */}
      <section className={card}>
        <h2 className="font-display text-[20px] font-bold">1. Course and section</h2>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <label className="text-[14px] font-semibold text-[#334155]">Course</label>
            <select
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setSectionId('');
                setSectionMode('new');
                setResult(null);
                setRows((prev) => prev.map((r) => ({ ...r, ...localStatus(r.title, r.embed) })));
              }}
              className="ed-field mt-1.5"
            >
              <option value="">Choose a course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title} ({c.curriculum.length} sections · {c.totalLessons} lessons)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[14px] font-semibold text-[#334155]">Section</label>
            <div className="mt-1.5 inline-flex gap-1 p-1 bg-[#F1F5F9] rounded-full">
              {(['new', 'existing'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={!course || (m === 'existing' && course.curriculum.length === 0)}
                  onClick={() => setSectionMode(m)}
                  className={`h-9 px-4 rounded-full text-[14px] font-semibold disabled:opacity-40 ${sectionMode === m ? 'bg-white text-[#004AAD] shadow-sm' : 'text-[#475569]'}`}
                >
                  {m === 'new' ? 'Create new section' : 'Existing section'}
                </button>
              ))}
            </div>
            {sectionMode === 'new' ? (
              <input
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                disabled={!course}
                placeholder="New section title, e.g. Module 1 — Foundations"
                className="ed-field mt-2"
              />
            ) : (
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="ed-field mt-2">
                <option value="">Choose a section…</option>
                {course?.curriculum.map((s) => (
                  <option key={s.id} value={s.id}>{s.title} ({s.lessons.length} lessons)</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </section>

      {/* Source: CSV file or the Adilo library */}
      <div className="mt-6 inline-flex gap-1 p-1 bg-[#F1F5F9] rounded-full" role="tablist" aria-label="Import source">
        {([['csv', 'CSV file', FileSpreadsheet], ['adilo', 'Import from Adilo', Film]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={source === id}
            type="button"
            onClick={() => setSource(id)}
            className={`h-10 px-5 rounded-full text-[14px] font-semibold inline-flex items-center gap-2 ${source === id ? 'bg-white text-[#004AAD] shadow-sm' : 'text-[#475569]'}`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {source === 'adilo' && (
        <AdiloLibraryImporter
          course={course}
          sectionMode={sectionMode}
          sectionId={sectionId}
          newSectionTitle={newSectionTitle}
          notify={showToast}
          onImported={async (createdSectionId) => {
            await loadCourses();
            if (createdSectionId) {
              setSectionMode('existing');
              setSectionId(createdSectionId);
            }
          }}
        />
      )}

      {source === 'csv' && (
      <>
      {/* 2 — upload */}
      <section className={`${card} mt-6`}>
        <h2 className="font-display text-[20px] font-bold">2. Upload CSV</h2>
        <p className="mt-1 text-[15px] text-[#64748B]">
          Columns <code className="font-mono text-[13px] bg-[#F1F5F9] px-1.5 py-0.5 rounded">topic_name</code> and{' '}
          <code className="font-mono text-[13px] bg-[#F1F5F9] px-1.5 py-0.5 rounded">embed_video_link</code> (an Adilo watch link or the full Adilo iframe code). UTF-8, Tamil and English supported.
        </p>
        <button
          type="button"
          disabled={!courseId}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (courseId) onFile(e.dataTransfer.files?.[0]);
          }}
          className="mt-4 w-full flex flex-col items-center justify-center gap-1 py-8 rounded-2xl border-2 border-dashed border-[#CBD5E1] hover:border-[#004AAD] hover:bg-[#F7F9FC] transition disabled:opacity-50 disabled:hover:border-[#CBD5E1]"
        >
          {fileName ? <FileSpreadsheet className="w-8 h-8 text-[#004AAD]" /> : <UploadCloud className="w-8 h-8 text-[#004AAD]" />}
          <span className="text-[16px] font-semibold text-[#111827]">{fileName || (courseId ? 'Choose or drop a .csv file' : 'Choose a course first')}</span>
          {fileName && <span className="text-[13px] text-[#64748B]">Click to replace</span>}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            onFile(f);
          }}
        />
      </section>

      {/* 3 — preview */}
      {rows.length > 0 && (
        <section className={`${card} mt-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-[20px] font-bold">3. Review lessons</h2>
            <div className="flex flex-wrap items-center gap-2 text-[14px]">
              <span className="px-3 h-8 inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 font-semibold">{counts.valid} valid</span>
              <span className="px-3 h-8 inline-flex items-center rounded-full bg-rose-50 text-rose-800 font-semibold">{counts.invalid} invalid</span>
              <span className="px-3 h-8 inline-flex items-center rounded-full bg-[#F1F5F9] text-[#475569] font-semibold">{counts.duplicate} duplicates</span>
              {counts.invalid > 0 && (
                <button onClick={removeInvalid} className="ed-btn ed-btn-text ed-btn-sm !text-rose-600"><Trash2 className="w-4 h-4" /> Remove invalid</button>
              )}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto border border-[#E2E8F0] rounded-2xl">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-[#F7F9FC] text-[12px] uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="px-3 py-3 w-12">No</th>
                  <th className="px-3 py-3">Topic name</th>
                  <th className="px-3 py-3">Video embed URL</th>
                  <th className="px-3 py-3 w-40">Status</th>
                  <th className="px-3 py-3 w-12"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F7]">
                {rows.map((r, i) => (
                  <tr key={r.key} className={r.status === 'invalid' ? 'bg-rose-50/40' : r.status === 'duplicate' ? 'bg-[#F8FAFC]' : ''}>
                    <td className="px-3 py-2 tabular-nums text-[#64748B]">{i + 1}</td>
                    <td className="px-3 py-2 min-w-[220px]">
                      <input value={r.title} onChange={(e) => updateRow(r.key, { title: e.target.value })} className="w-full h-9 px-2 rounded-lg border border-[#CBD5E1]" />
                    </td>
                    <td className="px-3 py-2 min-w-[280px]">
                      <input
                        value={r.embed}
                        onChange={(e) => updateRow(r.key, { embed: e.target.value })}
                        className={`w-full h-9 px-2 rounded-lg border font-mono text-[12px] ${r.status === 'invalid' && !extractAdiloUrl(r.embed).url ? 'border-rose-400' : 'border-[#CBD5E1]'}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {badge(r)}
                      {r.error && r.status !== 'checking' && <div className="mt-1 text-[12px] text-[#64748B] leading-snug">{r.error}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => removeRow(r.key)} aria-label={`Remove row ${i + 1}`} className="p-2 rounded-lg text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 4 — import */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {!confirming ? (
              <button disabled={!canImport} onClick={() => setConfirming(true)} className="ed-btn ed-btn-filled">
                <Layers className="w-5 h-5" /> Import All Lessons
              </button>
            ) : (
              <div className="w-full p-4 rounded-2xl bg-[#E8EFFB] flex flex-wrap items-center gap-3">
                <span className="flex-1 min-w-[240px] text-[15px] text-[#003B8B]">
                  Create <b>{counts.valid}</b> video lessons in <b>{course?.title}</b> →{' '}
                  <b>{sectionMode === 'new' ? `new section “${newSectionTitle.trim()}”` : course?.curriculum.find((s) => s.id === sectionId)?.title}</b>.
                  {counts.duplicate + counts.invalid > 0 && ` ${counts.duplicate} duplicates and ${counts.invalid} invalid rows will be skipped.`}
                </span>
                <button onClick={() => setConfirming(false)} disabled={importing} className="ed-btn ed-btn-text ed-btn-sm">Cancel</button>
                <button onClick={() => runImport(rows)} disabled={importing} className="ed-btn ed-btn-filled ed-btn-sm">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {importing ? 'Importing…' : 'Confirm import'}
                </button>
              </div>
            )}
            {!confirming && !sectionReady && courseId && <span className="text-[14px] text-[#64748B]">Choose or name a section first.</span>}
            {!confirming && counts.checking > 0 && <span className="text-[14px] text-[#64748B] inline-flex items-center gap-1"><RefreshCw className="w-4 h-4 animate-spin" /> Validating…</span>}
          </div>
        </section>
      )}
      </>
      )}
    </div>
  );
};
