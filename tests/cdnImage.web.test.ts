import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cdnAvatar, cdnImage, cdnSrcSet, isCdnImage } from '../src/lib/cdnImage';

const STORED = 'https://res.cloudinary.com/j2sjtw3l/image/upload/f_auto,q_auto/v1763300000/edufy/courses/abc123.png';

test('Cloudinary images get automatic format, quality and the requested width', () => {
  assert.equal(isCdnImage(STORED), true);
  assert.equal(cdnImage(STORED, 640), 'https://res.cloudinary.com/j2sjtw3l/image/upload/f_auto,q_auto,c_limit,w_640/v1763300000/edufy/courses/abc123.png');
  assert.equal(cdnImage(STORED), 'https://res.cloudinary.com/j2sjtw3l/image/upload/f_auto,q_auto/v1763300000/edufy/courses/abc123.png');
  assert.equal(cdnAvatar(STORED, 32), 'https://res.cloudinary.com/j2sjtw3l/image/upload/f_auto,q_auto,c_fill,w_64,h_64,g_auto/v1763300000/edufy/courses/abc123.png');
  assert.equal(cdnSrcSet(STORED, [320, 640]), 'https://res.cloudinary.com/j2sjtw3l/image/upload/f_auto,q_auto,c_limit,w_320/v1763300000/edufy/courses/abc123.png 320w, https://res.cloudinary.com/j2sjtw3l/image/upload/f_auto,q_auto,c_limit,w_640/v1763300000/edufy/courses/abc123.png 640w');
});

test('other images are left exactly as they are', () => {
  const unsplash = 'https://images.unsplash.com/photo-1?w=800&auto=format';
  const supa = 'https://tyqdyfecdvclwsvcahod.supabase.co/storage/v1/object/public/course-thumbnails/a.png';
  assert.equal(cdnImage(unsplash, 640), unsplash);
  assert.equal(cdnImage(supa, 640), supa);
  assert.equal(cdnImage(undefined, 640), undefined);
  assert.equal(cdnImage(null, 640), null);
  assert.equal(cdnSrcSet(unsplash), undefined);
});
