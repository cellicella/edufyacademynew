import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adiloIdFromUrl,
  embedUrlFromOembed,
  normaliseVideo,
  oembedRequestUrl,
  parseDuration,
  shapeOf,
  suggestMapping,
  titleSimilarity,
  unwrapList,
} from '../server/adiloLogic';
import { createAdiloLibrary } from '../server/adiloLibrary';

/* Real GET /v1/files/{id} payload shape (from an Edufy upload, November 2026) */
const REAL_FILE = {
  id: 'NxSjM8fj', tags: [], title: 'WhatsApp Video 2026-10-27 at 9.49.53 PM', views: null,
  project: { id: '2kUMMRll', drm: false, title: 'Edufy Academy Lessons', locked: false, private: false, archived: false, created_at: '2026-11-07 03:06:55', updated_at: '2026-11-07 12:00:26', description: 'Lesson videos uploaded from Edufy Academy' },
  created_at: '2026-11-07 12:00:26', updated_at: '2026-11-07 12:00:26', description: '', drm_protection: false, duration_formatted: '00:00:26', visual_watermarking: false,
};
/* Real oEmbed response from https://adilo.bigcommand.com/web/oembed (trimmed whitespace) */
const oembedFor = (id: string) => ({
  version: '1.0', type: 'video', title: 'x', width: 1920, height: 1080, provider_name: 'Adilo', provider_url: 'https://adilo.bigcommand.com/',
  html: `<div style="position: relative; padding-bottom: 56.25%;"><iframe allowtransparency="true" src="https://adilo.bigcommand.com/watch/${id}"  frameborder="0" allowfullscreen scrolling="no" style="position: absolute;"></iframe></div>`,
});

test('API responses are read defensively; the real file shape maps correctly', () => {
  assert.deepEqual(normaliseVideo(REAL_FILE), {
    id: 'NxSjM8fj', title: 'WhatsApp Video 2026-10-27 at 9.49.53 PM', durationSeconds: 26, durationFormatted: '00:00:26',
    projectId: '2kUMMRll', projectTitle: 'Edufy Academy Lessons', folderId: null, createdAt: '2026-11-07 12:00:26',
  });
  assert.equal(normaliseVideo({ id: '../x' }), null, 'ids are validated');
  assert.equal(normaliseVideo({ id: 'abcd1234', duration_seconds: 630 })?.durationFormatted, '00:10:30');
  assert.deepEqual(unwrapList({ payload: [{ id: 'a' }], meta: { total: 7 } }), { items: [{ id: 'a' }], total: 7 });
  assert.deepEqual(unwrapList({ payload: { data: [{ id: 'b' }] } }).items, [{ id: 'b' }]);
  assert.deepEqual(unwrapList(null), { items: [], total: null });
  assert.equal(parseDuration('00:10:30'), 630);
  assert.equal(parseDuration('10:30'), 630);
  assert.equal(parseDuration('45'), 45);
  assert.equal(parseDuration('soon'), null);
});

test('player link comes only from Adilo’s oEmbed embed code for the same video', () => {
  assert.equal(oembedRequestUrl('NxSjM8fj'), 'https://adilo.bigcommand.com/web/oembed?format=json&url=https%3A%2F%2Fadilo.bigcommand.com%2Fwatch%2FNxSjM8fj');
  assert.equal(embedUrlFromOembed(oembedFor('NxSjM8fj'), 'NxSjM8fj'), 'https://adilo.bigcommand.com/watch/NxSjM8fj');
  assert.equal(embedUrlFromOembed(oembedFor('OTHER123'), 'NxSjM8fj'), null, 'different video rejected');
  assert.equal(embedUrlFromOembed({ html: '<iframe src="https://evil.example/watch/NxSjM8fj"></iframe>' }, 'NxSjM8fj'), null, 'other hosts rejected');
  assert.equal(embedUrlFromOembed({ html: '<iframe src="http://adilo.bigcommand.com/watch/NxSjM8fj"></iframe>' }, 'NxSjM8fj'), null, 'http rejected');
  assert.equal(embedUrlFromOembed({ error: 'Config not found' }, 'NxSjM8fj'), null);
  assert.equal(adiloIdFromUrl('https://adilo.bigcommand.com/watch/y_dEKhMs'), 'y_dEKhMs');
  assert.equal(adiloIdFromUrl('https://example.com/watch/y_dEKhMs'), null);
});

test('diagnostics show field names and types only, never values', () => {
  const s = JSON.stringify(shapeOf({ payload: [REAL_FILE], meta: { total: 3 } }));
  assert.ok(s.includes('"duration_formatted":"string"'));
  assert.ok(!s.includes('NxSjM8fj') && !s.includes('WhatsApp'));
});

test('bulk mapping suggests lessons ↔ videos by title, each video once', () => {
  assert.ok(titleSimilarity('8.ENHANCING ATTENTION TO DETAIL NOTICING NUANCES', 'Enhancing attention to detail - noticing nuances.mp4') > 0.9);
  const m = suggestMapping(
    [{ id: 'l1', title: '1. Introduction to SEO' }, { id: 'l2', title: '2. Keyword research basics' }, { id: 'l3', title: '3. Something unrelated' }],
    [{ id: 'v1', title: 'Keyword Research Basics.mp4' }, { id: 'v2', title: 'Introduction to SEO' }, { id: 'v3', title: 'Introduction to SEO (copy)' }]
  );
  assert.deepEqual(m, { l1: 'v2', l2: 'v1' });
});

/* ------------------------------------------------------------------ service with fakes */
function fakeDb(tables: Record<string, any[]>) {
  const log: { op: string; table: string; value?: any; filters?: any }[] = [];
  const from = (table: string) => {
    const filters: ((r: any) => boolean)[] = [];
    const desc: any = {};
    let op: 'select' | 'insert' | 'update' = 'select';
    let value: any;
    let limit = Infinity;
    let order: { col: string; asc: boolean } | null = null;
    const rows = () => {
      let out = (tables[table] ||= []).filter((r) => filters.every((f) => f(r)));
      if (order) out = [...out].sort((a, b) => (a[order!.col] - b[order!.col]) * (order!.asc ? 1 : -1));
      return out.slice(0, limit);
    };
    const run = () => {
      if (op === 'insert') {
        const list = Array.isArray(value) ? value : [value];
        tables[table].push(...list.map((x: any) => ({ ...x })));
        log.push({ op, table, value });
        return { data: null, error: null };
      }
      if (op === 'update') {
        const hit = rows();
        hit.forEach((r) => Object.assign(r, value));
        log.push({ op, table, value, filters: desc });
        return { data: null, error: null };
      }
      return { data: rows(), error: null };
    };
    const q: any = {
      select: () => q,
      insert: (v: any) => ((op = 'insert'), (value = v), q),
      update: (v: any) => ((op = 'update'), (value = v), q),
      eq: (c: string, v: any) => (filters.push((r) => r[c] === v), (desc[c] = v), q),
      in: (c: string, v: any[]) => (filters.push((r) => v.includes(r[c])), q),
      or: () => (filters.push((r) => !!(r.adilo_file_id || r.adilo_embed_url || r.video_url)), q),
      order: (col: string, o: any) => ((order = { col, asc: o?.ascending !== false }), q),
      limit: (n: number) => ((limit = n), q),
      maybeSingle: async () => ({ data: rows()[0] || null, error: null }),
      then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
    };
    return q;
  };
  return { db: { from }, log, tables };
}

function setup(extraLessons: any[] = []) {
  const files: Record<string, any> = {
    vidAAAA1: { ...REAL_FILE, id: 'vidAAAA1', title: 'Keyword research basics', duration_formatted: '00:12:30' },
    vidBBBB2: { ...REAL_FILE, id: 'vidBBBB2', title: 'Introduction to SEO', duration_formatted: '00:05:00' },
    vidCCCC3: { ...REAL_FILE, id: 'vidCCCC3', title: 'Still processing', duration_formatted: '00:01:00' },
  };
  const calls: string[] = [];
  const request = async (_m: 'GET', path: string) => {
    calls.push(path);
    const fm = path.match(/^\/files\/([^/?]+)$/);
    if (fm) {
      if (!files[fm[1]]) throw Object.assign(new Error('Not found'), { status: 404 });
      return { payload: files[fm[1]] };
    }
    if (path.startsWith('/projects/2kUMMRll/files')) return { payload: Object.values(files), meta: { total: 3 } };
    if (path.startsWith('/projects?')) return { payload: [REAL_FILE.project], meta: { total: 1 } };
    throw new Error(`unexpected ${path}`);
  };
  const fetchImpl = (async (url: string) => {
    const id = decodeURIComponent(String(url)).split('/watch/')[1];
    if (id === 'vidCCCC3') return new Response(JSON.stringify({ error: 'Config not found' }), { status: 404 });
    return new Response(JSON.stringify(oembedFor(id)), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  const { db, log, tables } = fakeDb({
    courses: [{ id: 'course-1', title: 'SEO Course' }, { id: 'course-2', title: 'Other' }],
    course_sections: [{ id: 'sec-1', course_id: 'course-1', title: 'Module 1', section_order: 1 }],
    lessons: [
      { id: 'les-old', course_id: 'course-1', section_id: 'sec-1', title: '1. Introduction to SEO', type: 'video', lesson_order: 1, adilo_file_id: null, adilo_embed_url: null, video_url: null },
      { id: 'les-kw', course_id: 'course-1', section_id: 'sec-1', title: '2. Keyword research basics', type: 'video', lesson_order: 2, adilo_file_id: null, adilo_embed_url: 'https://adilo.bigcommand.com/watch/49ragFyA', video_url: null },
      { id: 'les-quiz', course_id: 'course-1', section_id: 'sec-1', title: 'Quiz', type: 'quiz', lesson_order: 3, adilo_file_id: null, adilo_embed_url: null, video_url: null },
      ...extraLessons,
    ],
  });
  const refreshed: string[] = [];
  const lib = createAdiloLibrary({
    db, request, configured: () => true, fetchImpl,
    requireAdmin: async () => ({ id: 'admin-1' }),
    refreshCourseTotals: async (id) => void refreshed.push(id),
  });
  return { lib, calls, log, tables, refreshed };
}

test('import creates lessons with the verified player link; duplicates and broken videos are reported', async () => {
  const { lib, tables, refreshed } = setup([
    { id: 'les-used', course_id: 'course-1', section_id: 'sec-1', title: 'Old intro', type: 'video', lesson_order: 4, adilo_file_id: 'vidBBBB2', adilo_embed_url: null, video_url: null },
  ]);
  const r = await lib.importLessons('admin-1', {
    courseId: 'course-1', sectionId: 'sec-1',
    items: [{ fileId: 'vidAAAA1', title: '  Keyword   research ' }, { fileId: 'vidAAAA1' }, { fileId: 'vidBBBB2' }, { fileId: 'vidCCCC3' }, { fileId: 'missing9' }, { fileId: 'bad id!' }],
  });
  assert.equal(r.created, 1);
  assert.equal(r.skipped, 2);
  assert.equal(r.failed, 3);
  assert.deepEqual(r.results.map((x) => x.status), ['created', 'skipped', 'skipped', 'failed', 'failed', 'failed']);
  assert.match(r.results[2].error!, /Already in this course/);
  assert.match(r.results[3].error!, /no player/i);
  assert.match(r.results[4].error!, /no longer exists/);
  const row = tables.lessons.find((l) => l.id === r.results[0].lessonId)!;
  assert.equal(row.title, 'Keyword research');
  assert.equal(row.adilo_file_id, 'vidAAAA1');
  assert.equal(row.adilo_embed_url, 'https://adilo.bigcommand.com/watch/vidAAAA1');
  assert.equal(row.video_duration, 750);
  assert.equal(row.duration_minutes, 13);
  assert.equal(row.video_status, 'library');
  assert.equal(row.section_id, 'sec-1');
  assert.equal(row.lesson_order, 5);
  assert.equal(row.video_metadata.source, 'adilo_api');
  assert.deepEqual(refreshed, ['course-1']);

  // Importing the same video again is skipped
  const again = await lib.importLessons('admin-1', { courseId: 'course-1', sectionId: 'sec-1', items: [{ fileId: 'vidAAAA1' }] });
  assert.equal(again.created, 0);
  assert.equal(again.skipped, 1);
});

test('a new section is created only when something is imported', async () => {
  const { lib, tables } = setup();
  const none = await lib.importLessons('admin-1', { courseId: 'course-1', newSectionTitle: 'Module 2', items: [{ fileId: 'vidCCCC3' }] });
  assert.equal(none.section, null);
  assert.equal(tables.course_sections.length, 1);
  const ok = await lib.importLessons('admin-1', { courseId: 'course-1', newSectionTitle: 'Module 2', items: [{ fileId: 'vidBBBB2' }] });
  assert.equal(ok.section?.created, true);
  assert.equal(tables.course_sections.length, 2);
  await assert.rejects(lib.importLessons('admin-1', { courseId: 'course-1', items: [{ fileId: 'vidBBBB2' }] }), /title for the new section/);
});

test('bulk mapping attaches videos to existing lessons; existing videos are kept unless replace', async () => {
  const { lib, tables } = setup();
  const r = await lib.mapLessons('admin-1', {
    courseId: 'course-1',
    mappings: [{ lessonId: 'les-old', fileId: 'vidBBBB2' }, { lessonId: 'les-kw', fileId: 'vidAAAA1' }, { lessonId: 'les-quiz', fileId: 'vidCCCC3' }, { lessonId: 'nope-1', fileId: 'vidAAAA1' }],
  });
  assert.deepEqual(r.results.map((x) => x.status), ['updated', 'skipped', 'skipped', 'failed']);
  assert.match(r.results[1].error!, /already has a video/);
  assert.match(r.results[2].error!, /Only video lessons/);
  const old = tables.lessons.find((l) => l.id === 'les-old')!;
  assert.equal(old.adilo_embed_url, 'https://adilo.bigcommand.com/watch/vidBBBB2');
  assert.equal(old.duration_minutes, 5);
  assert.equal(tables.lessons.find((l) => l.id === 'les-kw')!.adilo_embed_url, 'https://adilo.bigcommand.com/watch/49ragFyA', 'not replaced');

  const rep = await lib.mapLessons('admin-1', { courseId: 'course-1', replace: true, mappings: [{ lessonId: 'les-kw', fileId: 'vidAAAA1' }, { lessonId: 'les-old', fileId: 'vidAAAA1' }] });
  assert.deepEqual(rep.results.map((x) => x.status), ['updated', 'skipped']);
  assert.equal(tables.lessons.find((l) => l.id === 'les-kw')!.adilo_file_id, 'vidAAAA1');

  // A video used by another lesson of the course is not attached twice
  const dup = await lib.mapLessons('admin-1', { courseId: 'course-1', replace: true, mappings: [{ lessonId: 'les-old', fileId: 'vidAAAA1' }] });
  assert.match(dup.results[0].error!, /already used by/);
});

test('listing videos reports where each one is already used; results are cached briefly', async () => {
  const { lib, calls } = setup();
  const usage = await lib.usageMap();
  assert.equal(usage.get('id:49ragFyA')?.[0].lessonId, 'les-kw');
  const a = await lib.videos('2kUMMRll');
  await lib.videos('2kUMMRll');
  assert.equal(a.videos.length, 3);
  assert.equal(calls.filter((c) => c.startsWith('/projects/2kUMMRll/files')).length, 1);
  assert.equal((await lib.projects())[0].title, 'Edufy Academy Lessons');
});

test('pagination follows offsets and switches to page numbers when the API repeats a page', async () => {
  const all = Array.from({ length: 120 }, (_, i) => ({ id: `proj${String(i).padStart(4, '0')}`, title: `P${i}` }));
  const make = (mode: 'offset' | 'page') => async (_m: 'GET', path: string) => {
    const from = Number(path.match(/From=(\d+)/)![1]);
    const start = mode === 'offset' ? from - 1 : (from - 1) * 50;
    return { payload: all.slice(start, start + 50) };
  };
  for (const mode of ['offset', 'page'] as const) {
    const lib = createAdiloLibrary({ db: fakeDb({}).db, request: make(mode), configured: () => true, requireAdmin: async () => ({ id: 'a' }), refreshCourseTotals: async () => undefined });
    assert.equal((await lib.projects()).length, 120, mode);
  }
});

test('not connected → clear message, no API call', async () => {
  const lib = createAdiloLibrary({ db: fakeDb({}).db, request: async () => assert.fail('no call'), configured: () => false, requireAdmin: async () => ({ id: 'a' }), refreshCourseTotals: async () => undefined });
  await assert.rejects(lib.projects(), /ADILO_PUBLIC_KEY/);
});
