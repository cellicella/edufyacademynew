import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCloudinaryClient, deliveryUrl, isCloudinaryUrl, parseCloudinaryEnv, publicIdFromUrl, signParams } from '../server/cloudinary';
import { cloudinaryIdsInText, folderFor, imageSrcs, migrationSource, replaceInHtml, sweepDecision } from '../server/imageLogic';

const SUPA = 'https://tyqdyfecdvclwsvcahod.supabase.co';
const CDN = 'https://res.cloudinary.com/demo123/image/upload';

test('configuration comes only from the server environment; placeholders are ignored', () => {
  assert.deepEqual(parseCloudinaryEnv({ CLOUDINARY_URL: 'cloudinary://111222:s3cr3t-Value_@demo123' }), { apiKey: '111222', apiSecret: 's3cr3t-Value_', cloudName: 'demo123' });
  assert.equal(parseCloudinaryEnv({ CLOUDINARY_URL: 'cloudinary://<your_api_key>:<your_api_secret>@demo123' }), null);
  assert.equal(parseCloudinaryEnv({}), null);
  assert.deepEqual(parseCloudinaryEnv({ CLOUDINARY_CLOUD_NAME: 'demo123', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's' }), { cloudName: 'demo123', apiKey: 'k', apiSecret: 's' });
});

test('request signature matches Cloudinary’s documented example', () => {
  const sig = signParams({ eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop', public_id: 'sample_image', timestamp: 1315060510, file: 'ignored', api_key: 'ignored' }, 'abcd');
  assert.equal(sig, 'bfd09f95f331f558cbd1320e67aa8d488770583e');
});

test('public_id and delivery URLs', () => {
  const u = `${CDN}/v1712345678/edufy/courses/abc_def.png`;
  assert.equal(isCloudinaryUrl(u), true);
  assert.equal(isCloudinaryUrl(u, 'demo123'), true);
  assert.equal(isCloudinaryUrl(u, 'other'), false);
  assert.equal(isCloudinaryUrl(`${SUPA}/storage/v1/object/public/x.png`), false);
  assert.equal(publicIdFromUrl(u), 'edufy/courses/abc_def');
  assert.equal(publicIdFromUrl(`${CDN}/f_auto,q_auto/v1712345678/edufy/courses/abc_def.png`), 'edufy/courses/abc_def');
  assert.equal(publicIdFromUrl(`${CDN}/c_limit,w_640/f_auto,q_auto/v1/my_folder/pic.jpg`), 'my_folder/pic');
  assert.equal(deliveryUrl(u), `${CDN}/f_auto,q_auto/v1712345678/edufy/courses/abc_def.png`);
  assert.equal(deliveryUrl(`${CDN}/f_auto,q_auto/v1712345678/edufy/courses/abc_def.png`, 'f_auto,q_auto,c_limit,w_640'), `${CDN}/f_auto,q_auto,c_limit,w_640/v1712345678/edufy/courses/abc_def.png`);
  assert.equal(deliveryUrl('https://images.unsplash.com/photo-1?w=800'), 'https://images.unsplash.com/photo-1?w=800');
});

test('migration moves Supabase and Unsplash images only — never Adilo, videos, documents or private files', () => {
  assert.deepEqual(migrationSource(`${SUPA}/storage/v1/object/public/course-thumbnails/u/1.png`, SUPA), { source: 'supabase' });
  assert.deepEqual(migrationSource(`${SUPA}/storage/v1/object/public/site-assets/logo/a.webp`, SUPA), { source: 'supabase' });
  assert.deepEqual(migrationSource('https://images.unsplash.com/photo-123?w=800&q=80', SUPA), { source: 'external' });
  assert.deepEqual(migrationSource(`${SUPA}/storage/v1/object/public/course-videos/u/1.mp4`, SUPA), { skip: 'video_or_document' });
  assert.deepEqual(migrationSource(`${SUPA}/storage/v1/object/sign/course-materials/a.pdf?token=x`, SUPA), { skip: 'video_or_document' });
  assert.deepEqual(migrationSource(`${SUPA}/storage/v1/object/sign/course-thumbnails/a.png?token=x`, SUPA), { skip: 'private_storage' });
  assert.deepEqual(migrationSource('https://adilo.bigcommand.com/thumbnail/abc', SUPA), { skip: 'adilo' });
  assert.deepEqual(migrationSource(`${CDN}/v1/edufy/x.png`, SUPA), { skip: 'already_cloudinary' });
  assert.deepEqual(migrationSource('x', SUPA), { skip: 'not_url' });
  assert.deepEqual(migrationSource('', SUPA), { skip: 'empty' });
  assert.deepEqual(migrationSource('https://example.com/a.png', SUPA), { skip: 'other_host' });
  assert.equal(folderFor('course'), 'edufy/courses');
  assert.equal(folderFor('nonsense'), 'edufy/uploads');
});

test('inline HTML images are replaced exactly; other text is untouched', () => {
  const a = `${SUPA}/storage/v1/object/public/course-thumbnails/a.png`;
  const html = `<p>See ${a}</p><img src="${a}" alt="x"><img class="y" src='${a}'><img src="${a}?v=2">`;
  const r = replaceInHtml(html, new Map([[a, `${CDN}/f_auto,q_auto/v1/edufy/blog/a.png`]]));
  assert.equal(r.count, 2);
  assert.ok(r.html.startsWith(`<p>See ${a}</p>`), 'plain text mention unchanged');
  assert.ok(r.html.includes(`src="${a}?v=2"`), 'different URL unchanged');
  assert.deepEqual(imageSrcs('<img src="a.png"><IMG alt="" src=\'b.jpg\'>'), ['a.png', 'b.jpg']);
  assert.deepEqual(cloudinaryIdsInText(`{"logo":"${CDN.replace('demo123', 'demo123')}/f_auto,q_auto/v9/edufy/site/logo.png"}`, 'demo123'), ['edufy/site/logo']);
});

test('unused images are deleted only after the grace period', () => {
  const now = Date.parse('2026-11-20T00:00:00Z');
  assert.equal(sweepDecision({ unused_since: null }, true, now), 'keep');
  assert.equal(sweepDecision({ unused_since: '2026-11-19T00:00:00Z' }, true, now), 'clear_unused');
  assert.equal(sweepDecision({ unused_since: null }, false, now), 'mark_unused');
  assert.equal(sweepDecision({ unused_since: '2026-11-15T00:00:00Z' }, false, now), 'keep');
  assert.equal(sweepDecision({ unused_since: '2026-11-12T00:00:00Z' }, false, now), 'delete');
});

test('client signs uploads and deletes; the secret is never sent', async () => {
  const calls: { url: string; form: FormData }[] = [];
  const fakeFetch = (async (url: string, init: any) => {
    calls.push({ url, form: init.body });
    const isUpload = url.endsWith('/upload');
    return new Response(JSON.stringify(isUpload ? { public_id: 'edufy/courses/x1', secure_url: `${CDN}/v5/edufy/courses/x1.png`, version: 5, format: 'png', width: 1280, height: 720, bytes: 1000 } : { result: 'ok' }), { status: 200 });
  }) as unknown as typeof fetch;
  const c = createCloudinaryClient({ cloudName: 'demo123', apiKey: 'key1', apiSecret: 'TOPSECRET' }, fakeFetch);
  const a = await c.upload(Buffer.from([1, 2, 3]), { folder: 'edufy/courses', mime: 'image/png', tags: ['edufy'] });
  assert.equal(a.public_id, 'edufy/courses/x1');
  assert.equal(a.width, 1280);
  assert.equal(await c.destroy('edufy/courses/x1'), 'ok');
  assert.equal(calls[0].url, 'https://api.cloudinary.com/v1_1/demo123/image/upload');
  assert.equal(calls[1].url, 'https://api.cloudinary.com/v1_1/demo123/image/destroy');
  for (const { form } of calls) {
    const fields = Object.fromEntries([...form.entries()].filter(([k]) => k !== 'file').map(([k, v]) => [k, String(v)]));
    assert.equal(fields.api_key, 'key1');
    assert.match(fields.signature, /^[0-9a-f]{40}$/);
    assert.ok(!Object.values(fields).some((v) => v.includes('TOPSECRET')), 'secret not in the request');
    const { signature, api_key, ...signed } = fields;
    assert.equal(signature, signParams(signed, 'TOPSECRET'));
  }
});
