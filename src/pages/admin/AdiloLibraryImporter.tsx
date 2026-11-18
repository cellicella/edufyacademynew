import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Film, Link2, Loader2, RefreshCw, Search, Sparkles, Wand } from 'lucide-react';
import {
  AdiloImportResult,
  AdiloLibraryFolder,
  AdiloLibraryProject,
  AdiloLibraryVideo,
  AdiloMapResult,
  adiloLibraryService,
} from '../../services/api';
import { Course } from '../../types';
import { suggestMapping } from '../../../server/adiloLogic';

interface Props {
  course: Course | undefined;
  sectionMode: 'existing' | 'new';
  sectionId: string;
  newSectionTitle: string;
  /** Called after lessons were created/updated (reload courses, switch to the created section). */
  onImported: (sectionId: string | null) => Promise<void> | void;
  notify: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

type Action = 'create' | 'attach';
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const card = 'bg-white rounded-[24px] border border-[#E2E8F0] p-5 sm:p-7';
const hasVideo = (l: { adiloFileId?: string | null; adiloEmbedUrl?: string | null; videoUrl?: string }) => !!(l.adiloFileId || l.adiloEmbedUrl || l.videoUrl);

/**
 * "Import from Adilo": browse projects / folders / videos through the Edufy server (the Adilo keys never reach the
 * browser), then either create new lessons or attach the videos to existing lessons in bulk. The server re-checks
 * every video, takes the player link from Adilo's own embed code and skips videos already in the course.
 */
export const AdiloLibraryImporter: React.FC<Props> = ({ course, sectionMode, sectionId, newSectionTitle, onImported, notify }) => {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [projects, setProjects] = useState<AdiloLibraryProject[]>([]);
  const [projectId, setProjectId] = useState('');
  const [folders, setFolders] = useState<AdiloLibraryFolder[]>([]);
  const [folderId, setFolderId] = useState('all');
  const [videos, setVideos] = useState<AdiloLibraryVideo[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [q, setQ] = useState('');
  const [hideUsed, setHideUsed] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [action, setAction] = useState<Action>('create');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [replace, setReplace] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [importResult, setImportResult] = useState<AdiloImportResult | null>(null);
  const [mapResult, setMapResult] = useState<AdiloMapResult | null>(null);

  const loadProjects = useCallback(async () => {
    setError(null);
    setLoading('projects');
    try {
      const s = await adiloLibraryService.status();
      setConfigured(s.configured);
      if (!s.configured) return;
      const r = await adiloLibraryService.projects();
      setProjects(r.projects);
      if (r.projects.length === 1) setProjectId(r.projects[0].id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }, []);
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const loadVideos = useCallback(async () => {
    if (!projectId) return;
    setError(null);
    setLoading('videos');
    try {
      const [v, f] = await Promise.all([adiloLibraryService.videos(projectId, course?.id), adiloLibraryService.folders(projectId).catch(() => ({ folders: [] as AdiloLibraryFolder[] }))]);
      setVideos(v.videos);
      setTruncated(v.truncated);
      setFolders(f.folders);
    } catch (e: any) {
      setError(e.message);
      setVideos([]);
    } finally {
      setLoading(null);
    }
  }, [projectId, course?.id]);
  useEffect(() => {
    setSelected([]);
    setFolderId('all');
    setMapping({});
    loadVideos();
  }, [loadVideos]);

  const foldersUsable = videos.some((v) => v.folderId);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return videos
      .filter((v) => (folderId === 'all' || !foldersUsable ? true : v.folderId === folderId))
      .filter((v) => !(hideUsed && v.usedInCourse))
      .filter((v) => !term || v.title.toLowerCase().includes(term) || v.id.toLowerCase().includes(term))
      .sort((a, b) => collator.compare(a.title, b.title));
  }, [videos, q, folderId, foldersUsable, hideUsed]);

  const byId = useMemo(() => new Map(videos.map((v) => [v.id, v])), [videos]);
  const selectedVideos = useMemo(() => selected.map((id) => byId.get(id)).filter(Boolean).sort((a, b) => collator.compare(a!.title, b!.title)) as AdiloLibraryVideo[], [selected, byId]);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const selectable = filtered.filter((v) => !v.usedInCourse);
  const allVisibleSelected = selectable.length > 0 && selectable.every((v) => selected.includes(v.id));

  // Lessons for "attach": the chosen existing section, or every video lesson of the course
  const lessons = useMemo(() => {
    if (!course) return [];
    const secs = sectionMode === 'existing' && sectionId ? course.curriculum.filter((s) => s.id === sectionId) : course.curriculum;
    return secs.flatMap((s) => s.lessons.filter((l) => (l.type || 'video') === 'video').map((l) => ({ ...l, sectionTitle: s.title })));
  }, [course, sectionMode, sectionId]);
  const candidates = selectedVideos.length ? selectedVideos : filtered;

  const autoMatch = () => {
    const targets = lessons.filter((l) => replace || !hasVideo(l));
    const s = suggestMapping(targets.map((l) => ({ id: l.id, title: l.title })), candidates.map((v) => ({ id: v.id, title: v.title })));
    setMapping((m) => ({ ...m, ...s }));
    const n = Object.keys(s).length;
    notify(n ? `Matched ${n} lesson${n === 1 ? '' : 's'} by title — check them before saving.` : 'No confident title matches — choose the videos manually.', n ? 'info' : 'warning');
  };
  const mappedEntries = Object.entries(mapping).filter(([lid, vid]) => vid && lessons.some((l) => l.id === lid));
  const mappedVideoCounts = mappedEntries.reduce<Record<string, number>>((acc, [, v]) => ((acc[v] = (acc[v] || 0) + 1), acc), {});

  const sectionReady = sectionMode === 'existing' ? !!sectionId : newSectionTitle.trim().length > 0;
  const canCreate = !!course && sectionReady && selectedVideos.length > 0 && !loading;
  const canAttach = !!course && mappedEntries.length > 0 && !loading && !Object.values(mappedVideoCounts).some((n) => n > 1);

  const runCreate = async () => {
    if (!course) return;
    setLoading('import');
    setError(null);
    try {
      const r = await adiloLibraryService.importLessons({
        courseId: course.id,
        sectionId: sectionMode === 'existing' ? sectionId : null,
        newSectionTitle: sectionMode === 'new' ? newSectionTitle.trim() : undefined,
        items: selectedVideos.map((v) => ({ fileId: v.id, title: (titles[v.id] ?? v.title).trim() || v.title })),
      });
      setImportResult(r);
      setMapResult(null);
      setConfirming(false);
      const failed = new Set(r.results.filter((x) => x.status === 'failed').map((x) => x.fileId));
      setSelected((s) => s.filter((id) => failed.has(id)));
      notify(`${r.created} lessons created, ${r.skipped} skipped, ${r.failed} failed`, r.failed ? 'warning' : 'success');
      await onImported(r.section?.id || null);
      await loadVideos();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  };

  const runAttach = async () => {
    if (!course) return;
    setLoading('map');
    setError(null);
    try {
      const r = await adiloLibraryService.mapLessons({ courseId: course.id, replace, mappings: mappedEntries.map(([lessonId, fileId]) => ({ lessonId, fileId })) });
      setMapResult(r);
      setImportResult(null);
      setConfirming(false);
      setMapping({});
      notify(`${r.updated} lessons updated, ${r.skipped} skipped, ${r.failed} failed`, r.failed ? 'warning' : 'success');
      await onImported(null);
      await loadVideos();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  };

  if (configured === false) {
    return (
      <section className={`${card} mt-6`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
          <div className="text-[15px] text-[#334155] space-y-2">
            <h2 className="font-display text-[20px] font-bold text-[#111827]">Connect Adilo first</h2>
            <p>
              In hPanel → <b>api.edufyacademy.com</b> → Node.js → Environment variables, add <code className="font-mono text-[13px] bg-[#F1F5F9] px-1.5 py-0.5 rounded">ADILO_PUBLIC_KEY</code> and{' '}
              <code className="font-mono text-[13px] bg-[#F1F5F9] px-1.5 py-0.5 rounded">ADILO_SECRET_KEY</code> (Adilo → Settings → API Keys), then restart the API. The keys stay on the server.
            </p>
            <button onClick={loadProjects} className="ed-btn ed-btn-outlined ed-btn-sm"><RefreshCw className="w-4 h-4" /> Check again</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      {error && <div className="mt-6 p-4 rounded-2xl bg-rose-50 text-rose-800 text-[14px] flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{error}</div>}

      {(importResult || mapResult) && (
        <section className={`${card} mt-6`}>
          {importResult && (
            <>
              <h2 className="font-display text-[20px] font-bold flex items-center gap-2">
                {importResult.failed ? <AlertTriangle className="w-6 h-6 text-amber-600" /> : <CheckCircle2 className="w-6 h-6 text-emerald-600" />} Adilo import {importResult.failed ? 'finished with errors' : 'complete'}
              </h2>
              <p className="mt-1 text-[15px] text-[#64748B]">
                {importResult.course.title}{importResult.section ? ` → ${importResult.section.title}${importResult.section.created ? ' (new section)' : ''}` : ''} · {importResult.created} created · {importResult.skipped} skipped · {importResult.failed} failed
              </p>
            </>
          )}
          {mapResult && (
            <>
              <h2 className="font-display text-[20px] font-bold flex items-center gap-2">
                {mapResult.failed ? <AlertTriangle className="w-6 h-6 text-amber-600" /> : <CheckCircle2 className="w-6 h-6 text-emerald-600" />} Videos attached
              </h2>
              <p className="mt-1 text-[15px] text-[#64748B]">{mapResult.course.title} · {mapResult.updated} updated · {mapResult.skipped} skipped · {mapResult.failed} failed</p>
            </>
          )}
          {(() => {
            const issues = importResult
              ? importResult.results.filter((r) => r.status !== 'created').map((r) => ({ k: `${r.index}`, status: r.status, label: r.title || byId.get(r.fileId)?.title || r.fileId, error: r.error }))
              : mapResult!.results.filter((r) => r.status !== 'updated').map((r) => ({ k: `${r.index}`, status: r.status, label: lessons.find((l) => l.id === r.lessonId)?.title || r.lessonId, error: r.error }));
            return issues.length ? (
              <ul className="mt-4 divide-y divide-[#EEF2F7] border-y border-[#EEF2F7] max-h-56 overflow-y-auto">
                {issues.map((r) => (
                  <li key={r.k} className="py-2 flex flex-wrap gap-x-3 text-[14px]">
                    <span className={`w-20 font-semibold uppercase text-[12px] pt-0.5 ${r.status === 'failed' ? 'text-rose-700' : 'text-[#64748B]'}`}>{r.status}</span>
                    <span className="flex-1 min-w-0">{r.label}</span>
                    <span className="w-full sm:w-auto text-[13px] text-[#64748B]">{r.error}</span>
                  </li>
                ))}
              </ul>
            ) : null;
          })()}
        </section>
      )}

      {/* 2 — browse */}
      <section className={`${card} mt-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[20px] font-bold flex items-center gap-2"><Film className="w-5 h-5 text-[#004AAD]" /> 2. Choose Adilo videos</h2>
          <button onClick={() => (projectId ? loadVideos() : loadProjects())} disabled={!!loading} className="ed-btn ed-btn-text ed-btn-sm">
            <RefreshCw className={`w-4 h-4 ${loading === 'videos' || loading === 'projects' ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[13px] font-semibold text-[#334155]">Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="ed-field mt-1">
              <option value="">{loading === 'projects' ? 'Loading projects…' : 'Choose a project…'}</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[13px] font-semibold text-[#334155]">Folder</label>
            <select value={folderId} onChange={(e) => setFolderId(e.target.value)} disabled={!foldersUsable} className="ed-field mt-1">
              <option value="all">All folders{folders.length ? ` (${folders.length})` : ''}</option>
              {foldersUsable && folders.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
            {!!projectId && !foldersUsable && folders.length > 0 && <p className="mt-1 text-[12px] text-[#94A3B8]">Adilo’s API doesn’t say which folder each video is in, so all videos of the project are listed.</p>}
          </div>
          <div>
            <label className="text-[13px] font-semibold text-[#334155]">Search</label>
            <div className="relative mt-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title or video ID" className="ed-field !pl-9" />
            </div>
          </div>
        </div>

        {projectId && (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-4 text-[14px] text-[#475569]">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected((s) => (allVisibleSelected ? s.filter((id) => !selectable.some((v) => v.id === id)) : [...new Set([...s, ...selectable.map((v) => v.id)])]))} /> Select all shown</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={hideUsed} onChange={(e) => setHideUsed(e.target.checked)} /> Hide videos already in this course</label>
              <span className="ml-auto">{filtered.length} of {videos.length} videos · <b>{selected.length} selected</b></span>
            </div>
            {truncated && <p className="mt-2 text-[13px] text-amber-700">This project has more videos than can be listed at once — use search to find the rest.</p>}
            <div className="mt-3 overflow-x-auto border border-[#E2E8F0] rounded-2xl max-h-[460px] overflow-y-auto">
              <table className="w-full text-left text-[14px]">
                <thead className="bg-[#F7F9FC] text-[12px] uppercase tracking-wide text-[#64748B] sticky top-0">
                  <tr>
                    <th className="px-3 py-3 w-10"><span className="sr-only">Select</span></th>
                    <th className="px-3 py-3">Video title</th>
                    <th className="px-3 py-3 w-24">Duration</th>
                    <th className="px-3 py-3 w-32">Video ID</th>
                    <th className="px-3 py-3 w-48">Used in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F7]">
                  {loading === 'videos' && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-[#64748B]"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading videos from Adilo…</td></tr>
                  )}
                  {loading !== 'videos' && filtered.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-[#64748B]">No videos match.</td></tr>
                  )}
                  {loading !== 'videos' && filtered.map((v) => (
                    <tr key={v.id} className={v.usedInCourse ? 'bg-[#F8FAFC] text-[#94A3B8]' : selected.includes(v.id) ? 'bg-[#E8EFFB]/50' : ''}>
                      <td className="px-3 py-2"><input type="checkbox" aria-label={`Select ${v.title}`} disabled={v.usedInCourse} checked={selected.includes(v.id)} onChange={() => toggle(v.id)} /></td>
                      <td className="px-3 py-2 min-w-[240px]">{v.title}</td>
                      <td className="px-3 py-2 tabular-nums">{v.durationFormatted || '—'}</td>
                      <td className="px-3 py-2 font-mono text-[12px]">{v.id}</td>
                      <td className="px-3 py-2 text-[12px]">
                        {v.usedInCourse ? (
                          <span className="font-semibold text-[#475569] bg-[#F1F5F9] px-2 py-1 rounded">Already in this course</span>
                        ) : v.usage.length ? (
                          <span title={v.usage.map((u) => `${u.courseTitle} → ${u.lessonTitle}`).join('\n')} className="text-[#64748B]">{v.usage.length} lesson{v.usage.length === 1 ? '' : 's'} in other courses</span>
                        ) : (
                          <span className="text-[#94A3B8]">Not used</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* 3 — create or attach */}
      {projectId && (
        <section className={`${card} mt-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-[20px] font-bold">3. Add to the course</h2>
            <div className="inline-flex gap-1 p-1 bg-[#F1F5F9] rounded-full">
              {(['create', 'attach'] as const).map((a) => (
                <button key={a} type="button" onClick={() => { setAction(a); setConfirming(false); }} className={`h-9 px-4 rounded-full text-[14px] font-semibold ${action === a ? 'bg-white text-[#004AAD] shadow-sm' : 'text-[#475569]'}`}>
                  {a === 'create' ? 'Create new lessons' : 'Attach to existing lessons'}
                </button>
              ))}
            </div>
          </div>
          {!course && <p className="mt-3 text-[14px] text-[#64748B]">Choose a course in step 1 first.</p>}

          {course && action === 'create' && (
            <>
              <p className="mt-2 text-[14px] text-[#64748B]">One video lesson per selected video, added in this order to {sectionMode === 'new' ? (newSectionTitle.trim() ? `the new section “${newSectionTitle.trim()}”` : 'a new section (name it in step 1)') : course.curriculum.find((s) => s.id === sectionId)?.title || 'the section chosen in step 1'}. Lesson titles can be edited.</p>
              {selectedVideos.length === 0 ? (
                <p className="mt-4 text-[14px] text-[#94A3B8]">Select videos above.</p>
              ) : (
                <ol className="mt-4 space-y-2">
                  {selectedVideos.map((v, i) => (
                    <li key={v.id} className="flex flex-wrap items-center gap-3">
                      <span className="w-6 text-right tabular-nums text-[#64748B]">{i + 1}</span>
                      <input value={titles[v.id] ?? v.title} onChange={(e) => setTitles((t) => ({ ...t, [v.id]: e.target.value }))} maxLength={200} className="flex-1 min-w-[220px] h-9 px-2 rounded-lg border border-[#CBD5E1]" />
                      <span className="text-[13px] text-[#64748B] tabular-nums w-20">{v.durationFormatted || '—'}</span>
                      <span className="font-mono text-[12px] text-[#94A3B8] w-24">{v.id}</span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {!confirming ? (
                  <button disabled={!canCreate} onClick={() => setConfirming(true)} className="ed-btn ed-btn-filled"><Sparkles className="w-5 h-5" /> Create {selectedVideos.length || ''} lessons</button>
                ) : (
                  <div className="w-full p-4 rounded-2xl bg-[#E8EFFB] flex flex-wrap items-center gap-3">
                    <span className="flex-1 min-w-[240px] text-[15px] text-[#003B8B]">Create <b>{selectedVideos.length}</b> video lessons in <b>{course.title}</b>. Each video is checked with Adilo first; videos already in this course are skipped.</span>
                    <button onClick={() => setConfirming(false)} disabled={!!loading} className="ed-btn ed-btn-text ed-btn-sm">Cancel</button>
                    <button onClick={runCreate} disabled={!!loading} className="ed-btn ed-btn-filled ed-btn-sm">{loading === 'import' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {loading === 'import' ? 'Importing…' : 'Confirm import'}</button>
                  </div>
                )}
                {!confirming && !sectionReady && <span className="text-[14px] text-[#64748B]">Choose or name a section in step 1.</span>}
              </div>
            </>
          )}

          {course && action === 'attach' && (
            <>
              <p className="mt-2 text-[14px] text-[#64748B]">
                Pick a video for each lesson ({sectionMode === 'existing' && sectionId ? 'lessons of the section chosen in step 1' : 'all video lessons of the course'}). Choices come from the {selectedVideos.length ? `${selectedVideos.length} selected videos` : 'videos listed above'}.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <button onClick={autoMatch} disabled={!lessons.length || !candidates.length} className="ed-btn ed-btn-outlined ed-btn-sm"><Wand className="w-4 h-4" /> Match by title</button>
                <label className="inline-flex items-center gap-2 text-[14px] text-[#475569]"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Replace existing videos</label>
                {mappedEntries.length > 0 && <button onClick={() => setMapping({})} className="ed-btn ed-btn-text ed-btn-sm">Clear choices</button>}
              </div>
              {lessons.length === 0 ? (
                <p className="mt-4 text-[14px] text-[#94A3B8]">This {sectionMode === 'existing' && sectionId ? 'section' : 'course'} has no video lessons yet — use “Create new lessons”.</p>
              ) : (
                <div className="mt-4 overflow-x-auto border border-[#E2E8F0] rounded-2xl max-h-[460px] overflow-y-auto">
                  <table className="w-full text-left text-[14px]">
                    <thead className="bg-[#F7F9FC] text-[12px] uppercase tracking-wide text-[#64748B] sticky top-0">
                      <tr><th className="px-3 py-3">Lesson</th><th className="px-3 py-3 w-40">Current video</th><th className="px-3 py-3">Adilo video</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEF2F7]">
                      {lessons.map((l) => {
                        const locked = hasVideo(l) && !replace;
                        const chosen = mapping[l.id] || '';
                        const clash = chosen && mappedVideoCounts[chosen] > 1;
                        return (
                          <tr key={l.id} className={locked ? 'text-[#94A3B8]' : ''}>
                            <td className="px-3 py-2 min-w-[220px]"><div>{l.title}</div><div className="text-[12px] text-[#94A3B8]">{l.sectionTitle}</div></td>
                            <td className="px-3 py-2 text-[12px]">{l.adiloFileId ? <span className="font-mono">Adilo {l.adiloFileId}</span> : l.adiloEmbedUrl || l.videoUrl ? <span className="inline-flex items-center gap-1"><Link2 className="w-3 h-3" /> Video link</span> : <span className="text-amber-700">None</span>}</td>
                            <td className="px-3 py-2 min-w-[260px]">
                              <select value={chosen} disabled={locked} onChange={(e) => setMapping((m) => ({ ...m, [l.id]: e.target.value }))} className={`w-full h-9 px-2 rounded-lg border ${clash ? 'border-rose-400' : 'border-[#CBD5E1]'}`}>
                                <option value="">{locked ? 'Has a video (tick Replace)' : '— No change —'}</option>
                                {candidates.map((v) => <option key={v.id} value={v.id}>{v.title}{v.durationFormatted ? ` · ${v.durationFormatted}` : ''}</option>)}
                              </select>
                              {clash && <div className="mt-1 text-[12px] text-rose-600">This video is chosen for more than one lesson.</div>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {!confirming ? (
                  <button disabled={!canAttach} onClick={() => setConfirming(true)} className="ed-btn ed-btn-filled"><Link2 className="w-5 h-5" /> Attach {mappedEntries.length || ''} videos</button>
                ) : (
                  <div className="w-full p-4 rounded-2xl bg-[#E8EFFB] flex flex-wrap items-center gap-3">
                    <span className="flex-1 min-w-[240px] text-[15px] text-[#003B8B]">Attach <b>{mappedEntries.length}</b> Adilo videos to lessons in <b>{course.title}</b>{replace ? ', replacing their current videos' : ''}.</span>
                    <button onClick={() => setConfirming(false)} disabled={!!loading} className="ed-btn ed-btn-text ed-btn-sm">Cancel</button>
                    <button onClick={runAttach} disabled={!!loading} className="ed-btn ed-btn-filled ed-btn-sm">{loading === 'map' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {loading === 'map' ? 'Saving…' : 'Confirm'}</button>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
};
