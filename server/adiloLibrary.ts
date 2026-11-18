/**
 * "Import from Adilo" — browse the Adilo library from the admin panel and turn videos into lessons
 * (new lessons, or videos attached to existing lessons in bulk).
 *
 * Security: every route is admin-only; the Adilo keys stay in the server environment (ADILO_PUBLIC_KEY /
 * ADILO_SECRET_KEY) and are only used by the `request` function passed in from server.ts. Nothing here returns
 * keys, signed URLs or download links. Videos imported this way are marked video_status = 'library' and are
 * never deleted from Adilo by Edufy (only detached from lessons).
 *
 * Player links come from Adilo's oEmbed embed code — see server/adiloLogic.ts for the verified details.
 */
import crypto from 'node:crypto';
import type { Express, Request, Response } from 'express';
import {
  AdiloFolder,
  AdiloProject,
  AdiloVideo,
  adiloIdFromUrl,
  embedUrlFromOembed,
  isAdiloId,
  lessonMinutes,
  normaliseFolder,
  normaliseProject,
  normaliseVideo,
  oembedRequestUrl,
  shapeOf,
  unwrapList,
  videoKey,
} from './adiloLogic';

type AdiloRequest = (method: 'GET', path: string) => Promise<any>;

interface Deps {
  db: any;
  request: AdiloRequest;
  configured: () => boolean;
  /** Returns the admin user or throws (401/403). */
  requireAdmin: (req: Request) => Promise<{ id: string }>;
  refreshCourseTotals: (courseId: string) => Promise<void>;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export class LibraryError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const PAGE = 50; // Adilo "To" = amount of results (docs default 50)
const MAX_PAGES = 40;
const MAX_IMPORT = 200;
const MAX_MAP = 300;
const LIST_TTL_MS = 60_000;
const RESOLVE_TTL_MS = 10 * 60_000;
const TITLE_MAX = 200;
const validRowId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{3,80}$/.test(v);
const cleanTitle = (v: unknown) =>
  String(v ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export interface ResolvedVideo extends AdiloVideo {
  embedUrl: string;
}

export interface VideoUsage {
  courseId: string;
  courseTitle: string;
  sectionTitle: string | null;
  lessonId: string;
  lessonTitle: string;
}

export function createAdiloLibrary(deps: Deps) {
  const fetchImpl = deps.fetchImpl || fetch;
  const now = deps.now || Date.now;
  const listCache = new Map<string, { at: number; value: any }>();
  const resolveCache = new Map<string, { at: number; value: ResolvedVideo }>();

  const cached = async <T>(key: string, load: () => Promise<T>): Promise<T> => {
    const hit = listCache.get(key);
    if (hit && now() - hit.at < LIST_TTL_MS) return hit.value as T;
    const value = await load();
    listCache.set(key, { at: now(), value });
    return value;
  };

  const ensureConfigured = () => {
    if (!deps.configured()) throw new LibraryError(503, 'Adilo is not connected yet: add ADILO_PUBLIC_KEY and ADILO_SECRET_KEY to the API environment variables in hPanel, then restart the API.');
  };

  /**
   * Reads every page of a list endpoint. The docs describe From ("start filter, default 1") and To ("amount of
   * results"), without saying whether From is a page or an offset — offsets are tried first, and if the second
   * request repeats the first page, page numbers are used instead. Duplicates are always removed.
   */
  async function listAll(path: string): Promise<{ items: any[]; truncated: boolean }> {
    const seen = new Set<string>();
    const items: any[] = [];
    let mode: 'offset' | 'page' = 'offset';
    let page = 1;
    let switched = false;
    for (let i = 0; i < MAX_PAGES; i++) {
      const from = mode === 'offset' ? items.length + 1 : page;
      const r = unwrapList(await deps.request('GET', `${path}${path.includes('?') ? '&' : '?'}From=${from}&To=${PAGE}`));
      let added = 0;
      for (const it of r.items) {
        const id = String(it?.id ?? '');
        if (!id || seen.has(id)) continue;
        seen.add(id);
        items.push(it);
        added++;
      }
      if (r.total !== null && items.length >= r.total) return { items, truncated: false };
      // Second request gave nothing new (empty or the first page again): From is a page number, not an offset
      if (added === 0 || (i === 1 && mode === 'offset' && r.items.length === 0)) {
        if (mode === 'offset' && !switched && i === 1) {
          mode = 'page';
          switched = true;
          page = 2;
          continue;
        }
        return { items, truncated: false };
      }
      if (r.items.length < PAGE) return { items, truncated: false };
      page++;
    }
    return { items, truncated: true };
  }

  async function projects(): Promise<AdiloProject[]> {
    ensureConfigured();
    return cached('projects', async () => {
      const { items } = await listAll('/projects');
      return items.map((p) => normaliseProject(p)).filter(Boolean) as AdiloProject[];
    });
  }

  async function folders(projectId: string): Promise<AdiloFolder[]> {
    ensureConfigured();
    if (!isAdiloId(projectId)) throw new LibraryError(422, 'Invalid Adilo project.');
    return cached(`folders:${projectId}`, async () => {
      const { items } = await listAll(`/projects/${encodeURIComponent(projectId)}/folders`);
      return items.map((f) => normaliseFolder(f, projectId)).filter(Boolean) as AdiloFolder[];
    });
  }

  async function videos(projectId: string): Promise<{ videos: AdiloVideo[]; truncated: boolean }> {
    ensureConfigured();
    if (!isAdiloId(projectId)) throw new LibraryError(422, 'Invalid Adilo project.');
    return cached(`files:${projectId}`, async () => {
      const { items, truncated } = await listAll(`/projects/${encodeURIComponent(projectId)}/files`);
      return { videos: items.map((f) => normaliseVideo(f, projectId)).filter(Boolean) as AdiloVideo[], truncated };
    });
  }

  /** File details from the API + the player URL from Adilo's oEmbed embed code. */
  async function resolve(fileId: string): Promise<ResolvedVideo> {
    ensureConfigured();
    if (!isAdiloId(fileId)) throw new LibraryError(422, 'Invalid Adilo video ID.');
    const hit = resolveCache.get(fileId);
    if (hit && now() - hit.at < RESOLVE_TTL_MS) return hit.value;

    let details: AdiloVideo | null;
    try {
      details = normaliseVideo((await deps.request('GET', `/files/${encodeURIComponent(fileId)}`))?.payload);
    } catch (e: any) {
      if (e?.status === 404) throw new LibraryError(404, 'This video no longer exists in Adilo.');
      throw e;
    }
    if (!details || details.id !== fileId) throw new LibraryError(502, 'Adilo returned no details for this video.');

    let res: globalThis.Response;
    try {
      res = await fetchImpl(oembedRequestUrl(fileId), { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(12_000) });
    } catch {
      throw new LibraryError(502, 'Could not reach the Adilo player to get the embed code. Try again.');
    }
    if (res.status === 404) throw new LibraryError(409, 'Adilo has no player for this video yet (still processing, or not published).');
    if (!res.ok) throw new LibraryError(502, `The Adilo player answered ${res.status}. Try again.`);
    const json = await res.json().catch(() => null);
    const embedUrl = embedUrlFromOembed(json, fileId);
    if (!embedUrl) throw new LibraryError(502, 'Adilo’s embed code did not contain a player link for this video.');

    const value: ResolvedVideo = { ...details, embedUrl };
    resolveCache.set(fileId, { at: now(), value });
    return value;
  }

  async function resolveMany(ids: string[], concurrency = 4) {
    const out: { fileId: string; ok: boolean; video?: ResolvedVideo; error?: string }[] = new Array(ids.length);
    let next = 0;
    const worker = async () => {
      while (next < ids.length) {
        const i = next++;
        try {
          out[i] = { fileId: ids[i], ok: true, video: await resolve(ids[i]) };
        } catch (e: any) {
          out[i] = { fileId: ids[i], ok: false, error: e?.message || 'Could not load this video.' };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
    return out;
  }

  /** Where each Adilo video is already used (by file id or by the id inside a player link). */
  async function usageMap(courseId?: string): Promise<Map<string, VideoUsage[]>> {
    let q = deps.db.from('lessons').select('id, title, course_id, section_id, adilo_file_id, adilo_embed_url, video_url').or('adilo_file_id.not.is.null,adilo_embed_url.not.is.null,video_url.not.is.null');
    if (courseId) q = q.eq('course_id', courseId);
    const { data: lessons, error } = await q;
    if (error) throw new LibraryError(500, `Could not read lessons: ${error.message}`);
    const courseIds = [...new Set((lessons || []).map((l: any) => l.course_id))];
    const sectionIds = [...new Set((lessons || []).map((l: any) => l.section_id).filter(Boolean))];
    const [{ data: courses }, { data: sections }] = await Promise.all([
      courseIds.length ? deps.db.from('courses').select('id, title').in('id', courseIds) : Promise.resolve({ data: [] }),
      sectionIds.length ? deps.db.from('course_sections').select('id, title').in('id', sectionIds) : Promise.resolve({ data: [] }),
    ]);
    const courseTitle = new Map((courses || []).map((c: any) => [c.id, c.title]));
    const sectionTitle = new Map((sections || []).map((s: any) => [s.id, s.title]));
    const map = new Map<string, VideoUsage[]>();
    for (const l of lessons || []) {
      const ids = new Set([l.adilo_file_id, adiloIdFromUrl(l.adilo_embed_url), adiloIdFromUrl(l.video_url)].filter((x): x is string => isAdiloId(x)));
      for (const id of ids) {
        const list = map.get(videoKey(id)) || [];
        list.push({ courseId: l.course_id, courseTitle: (courseTitle.get(l.course_id) as string) || 'Course', sectionTitle: (sectionTitle.get(l.section_id) as string) || null, lessonId: l.id, lessonTitle: l.title });
        map.set(videoKey(id), list);
      }
    }
    return map;
  }

  async function loadCourse(courseId: unknown) {
    if (!validRowId(courseId)) throw new LibraryError(422, 'Choose a valid course.');
    const { data } = await deps.db.from('courses').select('id, title').eq('id', courseId).maybeSingle();
    if (!data) throw new LibraryError(404, 'Course not found.');
    return data as { id: string; title: string };
  }

  async function loadSection(courseId: string, sectionId: unknown) {
    if (sectionId === undefined || sectionId === null || sectionId === '') return null;
    if (!validRowId(sectionId)) throw new LibraryError(422, 'Choose a valid section.');
    const { data } = await deps.db.from('course_sections').select('id, title, course_id').eq('id', sectionId).maybeSingle();
    if (!data || data.course_id !== courseId) throw new LibraryError(404, 'That section does not belong to this course.');
    return { id: data.id as string, title: data.title as string };
  }

  async function createSection(courseId: string, rawTitle: unknown) {
    const title = cleanTitle(rawTitle).slice(0, TITLE_MAX);
    if (!title) throw new LibraryError(422, 'Enter a title for the new section, or choose an existing section.');
    const { data: last } = await deps.db.from('course_sections').select('section_order').eq('course_id', courseId).order('section_order', { ascending: false }).limit(1).maybeSingle();
    const id = `sec-${crypto.randomBytes(5).toString('hex')}`;
    const { error } = await deps.db.from('course_sections').insert({ id, course_id: courseId, title, section_order: (last?.section_order || 0) + 1 });
    if (error) throw new LibraryError(500, `Could not create the section: ${error.message}`);
    return { id, title };
  }

  const videoFields = (v: ResolvedVideo, adminId: string, at: string) => ({
    adilo_file_id: v.id,
    adilo_project_id: v.projectId,
    adilo_embed_url: v.embedUrl,
    video_title: v.title,
    video_duration: v.durationSeconds,
    video_status: 'library',
    video_metadata: { source: 'adilo_api', imported_by: adminId, imported_at: at, duration_formatted: v.durationFormatted, project_title: v.projectTitle, embed_source: 'adilo_oembed' },
    video_created_at: at,
    video_updated_at: at,
  });

  /** Creates one video lesson per selected Adilo video (duplicates in the course are skipped). */
  async function importLessons(adminId: string, body: any) {
    const items: any[] = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) throw new LibraryError(422, 'Select at least one Adilo video.');
    if (items.length > MAX_IMPORT) throw new LibraryError(422, `Import at most ${MAX_IMPORT} videos at a time.`);
    const course = await loadCourse(body?.courseId);
    let section = await loadSection(course.id, body?.sectionId);
    if (!section && !cleanTitle(body?.newSectionTitle)) throw new LibraryError(422, 'Enter a title for the new section, or choose an existing section.');

    const usage = await usageMap(course.id);
    type Result = { index: number; fileId: string; title: string; status: 'created' | 'skipped' | 'failed'; lessonId: string | null; error: string | null };
    const results: Result[] = [];
    const pending: { index: number; fileId: string; title: string }[] = [];
    const seen = new Map<string, number>();
    items.forEach((it, index) => {
      const fileId = String(it?.fileId ?? '');
      const title = cleanTitle(it?.title).slice(0, TITLE_MAX);
      if (!isAdiloId(fileId)) return results.push({ index, fileId, title, status: 'failed', lessonId: null, error: 'Invalid Adilo video ID.' });
      if (seen.has(fileId)) return results.push({ index, fileId, title, status: 'skipped', lessonId: null, error: `Selected twice (same video as item ${seen.get(fileId)! + 1}).` });
      seen.set(fileId, index);
      const used = usage.get(videoKey(fileId));
      if (used?.length) return results.push({ index, fileId, title, status: 'skipped', lessonId: used[0].lessonId, error: `Already in this course: “${used[0].lessonTitle}”.` });
      pending.push({ index, fileId, title });
    });

    const resolved = await resolveMany(pending.map((p) => p.fileId));
    const at = new Date(now()).toISOString();
    const rows: { index: number; row: any }[] = [];
    pending.forEach((p, i) => {
      const r = resolved[i];
      if (!r.ok || !r.video) return results.push({ index: p.index, fileId: p.fileId, title: p.title, status: 'failed', lessonId: null, error: r.error || 'Could not load this video.' });
      const title = p.title || r.video.title.slice(0, TITLE_MAX);
      rows.push({
        index: p.index,
        row: { id: `les-${crypto.randomBytes(5).toString('hex')}`, course_id: course.id, title, type: 'video', is_free_preview: false, duration_minutes: lessonMinutes(r.video.durationSeconds) ?? 10, ...videoFields(r.video, adminId, at) },
      });
    });

    let sectionCreated = false;
    if (rows.length) {
      if (!section) {
        section = await createSection(course.id, body?.newSectionTitle);
        sectionCreated = true;
      }
      const { data: lastLesson } = await deps.db.from('lessons').select('lesson_order').eq('section_id', section.id).order('lesson_order', { ascending: false }).limit(1).maybeSingle();
      let order = (lastLesson?.lesson_order || 0) + 1;
      rows.sort((a, b) => a.index - b.index).forEach((r) => Object.assign(r.row, { section_id: section!.id, lesson_order: order++ }));
      for (let i = 0; i < rows.length; i += 50) {
        const chunk = rows.slice(i, i + 50);
        const { error } = await deps.db.from('lessons').insert(chunk.map((c) => c.row));
        if (!error) {
          chunk.forEach((c) => results.push({ index: c.index, fileId: c.row.adilo_file_id, title: c.row.title, status: 'created', lessonId: c.row.id, error: null }));
          continue;
        }
        for (const c of chunk) {
          const { error: oneErr } = await deps.db.from('lessons').insert(c.row);
          results.push(oneErr ? { index: c.index, fileId: c.row.adilo_file_id, title: c.row.title, status: 'failed', lessonId: null, error: `Database error: ${oneErr.message}` } : { index: c.index, fileId: c.row.adilo_file_id, title: c.row.title, status: 'created', lessonId: c.row.id, error: null });
        }
      }
      if (results.some((r) => r.status === 'created')) await deps.refreshCourseTotals(course.id);
    }
    results.sort((a, b) => a.index - b.index);
    return {
      course,
      section: section ? { ...section, created: sectionCreated } : null,
      total: items.length,
      created: results.filter((r) => r.status === 'created').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    };
  }

  /** Attaches Adilo videos to existing video lessons (bulk). Existing videos are kept unless `replace` is set. */
  async function mapLessons(adminId: string, body: any) {
    const mappings: any[] = Array.isArray(body?.mappings) ? body.mappings : [];
    if (!mappings.length) throw new LibraryError(422, 'Choose a video for at least one lesson.');
    if (mappings.length > MAX_MAP) throw new LibraryError(422, `Map at most ${MAX_MAP} lessons at a time.`);
    const replace = body?.replace === true;
    const course = await loadCourse(body?.courseId);

    const lessonIds = [...new Set(mappings.map((m) => String(m?.lessonId ?? '')).filter(validRowId))];
    const { data: lessonRows, error } = lessonIds.length
      ? await deps.db.from('lessons').select('id, title, type, course_id, adilo_file_id, adilo_embed_url, video_url').in('id', lessonIds)
      : { data: [], error: null };
    if (error) throw new LibraryError(500, `Could not read lessons: ${error.message}`);
    const lessons = new Map((lessonRows || []).map((l: any) => [l.id, l]));

    // Videos already used by other lessons of this course (lessons in this request are re-evaluated below)
    const usage = await usageMap(course.id);
    const requested = new Set(lessonIds);
    const usedElsewhere = (fileId: string) => (usage.get(videoKey(fileId)) || []).find((u) => !requested.has(u.lessonId));

    type Result = { index: number; lessonId: string; fileId: string; status: 'updated' | 'skipped' | 'failed'; error: string | null };
    const results: Result[] = [];
    const pending: { index: number; lessonId: string; fileId: string }[] = [];
    const seenFile = new Map<string, number>();
    const seenLesson = new Set<string>();
    mappings.forEach((m, index) => {
      const lessonId = String(m?.lessonId ?? '');
      const fileId = String(m?.fileId ?? '');
      const lesson: any = lessons.get(lessonId);
      const fail = (status: 'skipped' | 'failed', error: string) => results.push({ index, lessonId, fileId, status, error });
      if (!lesson || lesson.course_id !== course.id) return fail('failed', 'Lesson not found in this course.');
      if (!isAdiloId(fileId)) return fail('failed', 'Invalid Adilo video ID.');
      if (seenLesson.has(lessonId)) return fail('skipped', 'This lesson was listed twice.');
      if (seenFile.has(fileId)) return fail('skipped', `The same video is already chosen for item ${seenFile.get(fileId)! + 1}.`);
      if ((lesson.type || 'video') !== 'video') return fail('skipped', 'Only video lessons can get a video.');
      const currentId = lesson.adilo_file_id || adiloIdFromUrl(lesson.adilo_embed_url) || adiloIdFromUrl(lesson.video_url);
      if (currentId === fileId) return fail('skipped', 'This lesson already uses this video.');
      if ((lesson.adilo_file_id || lesson.adilo_embed_url || lesson.video_url) && !replace) return fail('skipped', 'The lesson already has a video (tick “Replace existing videos” to change it).');
      const other = usedElsewhere(fileId);
      if (other) return fail('skipped', `This video is already used by “${other.lessonTitle}” in this course.`);
      seenLesson.add(lessonId);
      seenFile.set(fileId, index);
      pending.push({ index, lessonId, fileId });
    });

    const resolved = await resolveMany([...new Set(pending.map((p) => p.fileId))]);
    const byId = new Map(resolved.map((r) => [r.fileId, r]));
    const at = new Date(now()).toISOString();
    for (const p of pending) {
      const r = byId.get(p.fileId)!;
      if (!r.ok || !r.video) {
        results.push({ index: p.index, lessonId: p.lessonId, fileId: p.fileId, status: 'failed', error: r.error || 'Could not load this video.' });
        continue;
      }
      const minutes = lessonMinutes(r.video.durationSeconds);
      const { error: upErr } = await deps.db
        .from('lessons')
        .update({ ...videoFields(r.video, adminId, at), video_url: null, ...(minutes ? { duration_minutes: minutes } : {}) })
        .eq('id', p.lessonId)
        .eq('course_id', course.id);
      results.push(upErr ? { index: p.index, lessonId: p.lessonId, fileId: p.fileId, status: 'failed', error: `Database error: ${upErr.message}` } : { index: p.index, lessonId: p.lessonId, fileId: p.fileId, status: 'updated', error: null });
    }
    if (results.some((r) => r.status === 'updated')) await deps.refreshCourseTotals(course.id);
    results.sort((a, b) => a.index - b.index);
    return {
      course,
      total: mappings.length,
      updated: results.filter((r) => r.status === 'updated').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    };
  }

  /** Field names and types of the live responses (no values) — to confirm the API shape after connecting. */
  async function inspect() {
    ensureConfigured();
    const projectsRaw = await deps.request('GET', '/projects?From=1&To=1');
    const first = unwrapList(projectsRaw).items[0];
    const out: Record<string, unknown> = { projects: shapeOf(projectsRaw) };
    if (first?.id && isAdiloId(String(first.id))) {
      const pid = encodeURIComponent(String(first.id));
      const [foldersRaw, filesRaw] = await Promise.all([
        deps.request('GET', `/projects/${pid}/folders?From=1&To=1`).catch((e: any) => ({ error: e?.message })),
        deps.request('GET', `/projects/${pid}/files?From=1&To=1`).catch((e: any) => ({ error: e?.message })),
      ]);
      out.folders = shapeOf(foldersRaw);
      out.files = shapeOf(filesRaw);
      const file = unwrapList(filesRaw).items[0];
      if (file?.id && isAdiloId(String(file.id))) {
        out.file = shapeOf(await deps.request('GET', `/files/${encodeURIComponent(String(file.id))}`).catch((e: any) => ({ error: e?.message })));
        try {
          const r = await fetchImpl(oembedRequestUrl(String(file.id)), { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(12_000) });
          const j = await r.json().catch(() => null);
          out.oembed = { status: r.status, shape: shapeOf(j), embedUrlFound: !!embedUrlFromOembed(j, String(file.id)) };
        } catch (e: any) {
          out.oembed = { error: e?.message || 'oEmbed request failed' };
        }
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ routes */
  function registerRoutes(app: Express) {
    const send = (res: Response, err: any) => {
      const status = Number(err?.status) || 500;
      if (status >= 500 && !(err instanceof LibraryError)) console.error('[Adilo library]', err?.message || err);
      res.status(status).json({ error: err?.message || 'Adilo request failed.' });
    };
    const route = (fn: (req: Request, admin: { id: string }) => Promise<unknown>) => async (req: Request, res: Response) => {
      try {
        const admin = await deps.requireAdmin(req);
        res.json(await fn(req, admin));
      } catch (err) {
        send(res, err);
      }
    };

    app.get('/api/admin/adilo/library/status', route(async () => ({ configured: deps.configured() })));
    app.get('/api/admin/adilo/projects', route(async () => ({ projects: await projects() })));
    app.get('/api/admin/adilo/projects/:projectId/folders', route(async (req) => ({ folders: await folders(String(req.params.projectId)) })));
    app.get(
      '/api/admin/adilo/projects/:projectId/files',
      route(async (req) => {
        const { videos: list, truncated } = await videos(String(req.params.projectId));
        const courseId = validRowId(req.query.courseId) ? String(req.query.courseId) : undefined;
        const usage = await usageMap();
        return {
          truncated,
          videos: list.map((v) => {
            const used = usage.get(videoKey(v.id)) || [];
            return { ...v, usage: used, usedInCourse: courseId ? used.some((u) => u.courseId === courseId) : false };
          }),
        };
      })
    );
    app.post(
      '/api/admin/adilo/resolve',
      route(async (req) => {
        const ids = Array.isArray(req.body?.fileIds) ? [...new Set(req.body.fileIds.map((x: unknown) => String(x)))] : [];
        if (!ids.length || ids.length > 100) throw new LibraryError(422, 'Send between 1 and 100 video IDs.');
        if (!ids.every(isAdiloId)) throw new LibraryError(422, 'Invalid Adilo video ID.');
        return { results: await resolveMany(ids as string[]) };
      })
    );
    app.get('/api/admin/adilo/inspect', route(async () => inspect()));
    app.post('/api/admin/adilo/import', route(async (req, admin) => importLessons(admin.id, req.body)));
    app.post('/api/admin/adilo/map', route(async (req, admin) => mapLessons(admin.id, req.body)));
  }

  return { projects, folders, videos, resolve, resolveMany, usageMap, importLessons, mapLessons, inspect, registerRoutes };
}
