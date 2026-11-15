import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptSiteUrl } from '../src/lib/siteUrl';
import { resolveVideo } from '../src/utils/videoEmbed';

test('site URL: https always accepted; localhost only when the page itself is local', () => {
  assert.equal(acceptSiteUrl('https://edufyacademy.com/', false), 'https://edufyacademy.com');
  assert.equal(acceptSiteUrl('http://localhost:5173', false), '', 'production page never uses a localhost link');
  assert.equal(acceptSiteUrl('http://127.0.0.1:3000', false), '');
  assert.equal(acceptSiteUrl('http://localhost:5173', true), 'http://localhost:5173', 'local development still works');
  assert.equal(acceptSiteUrl('http://edufyacademy.com', false), '', 'plain http is refused');
  assert.equal(acceptSiteUrl('javascript:alert(1)', true), '');
  assert.equal(acceptSiteUrl('', false), '');
});

test('video embeds: http://localhost is refused outside development builds; Adilo https links work', () => {
  assert.equal(resolveVideo('http://localhost:3000/video.mp4'), null);
  assert.equal(resolveVideo('http://127.0.0.1/video.mp4'), null);
  assert.notEqual(resolveVideo('https://adilo.bigcommand.com/watch/AbCdEf12'), null);
  assert.notEqual(resolveVideo('<iframe src="https://adilo.bigcommand.com/watch/AbCdEf12" allowfullscreen></iframe>'), null);
});
