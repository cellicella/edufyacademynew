import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractVideoSource, resolveVideo, escapeAttr } from '../src/logic/video';

test('direct Adilo watch URL is accepted unchanged', () => {
  assert.deepEqual(resolveVideo('https://adilo.bigcommand.com/watch/49ragFyA'), { kind: 'iframe', src: 'https://adilo.bigcommand.com/watch/49ragFyA' });
});

test('Adilo iframe embed code: only the src is used, &amp; decoded, whitespace trimmed', () => {
  const html = '<div style="width:860px"><iframe allowtransparency="true"   src="https://adilo.bigcommand.com/watch/49ragFyA?a=1&amp;b=2 " frameborder="0" allowfullscreen></iframe></div>';
  assert.equal(extractVideoSource(html), 'https://adilo.bigcommand.com/watch/49ragFyA?a=1&b=2');
  assert.deepEqual(resolveVideo(html), { kind: 'iframe', src: 'https://adilo.bigcommand.com/watch/49ragFyA?a=1&b=2' });
});

test('single-quoted iframe src and protocol-relative URL', () => {
  assert.equal(resolveVideo("<iframe src='//adilo.bigcommand.com/watch/abcd1234'></iframe>")?.src, 'https://adilo.bigcommand.com/watch/abcd1234');
});

test('YouTube and Vimeo links become embed URLs', () => {
  assert.equal(resolveVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.src, 'https://www.youtube.com/embed/dQw4w9WgXcQ?playsinline=1');
  assert.equal(resolveVideo('https://youtu.be/dQw4w9WgXcQ')?.src, 'https://www.youtube.com/embed/dQw4w9WgXcQ?playsinline=1');
  assert.equal(resolveVideo('https://vimeo.com/123456')?.src, 'https://player.vimeo.com/video/123456');
});

test('MP4 and Supabase storage files play as native video', () => {
  assert.equal(resolveVideo('https://cdn.example.com/a/b.mp4')?.kind, 'file');
  assert.equal(resolveVideo('https://x.supabase.co/storage/v1/object/public/course-videos/a')?.kind, 'file');
});

test('unsafe or unsupported input is rejected', () => {
  for (const bad of ['', '   ', null, undefined, 'http://adilo.bigcommand.com/watch/abc', 'javascript:alert(1)', '<script>alert(1)</script>',
    'https://evil.example.com/watch/abc', '<iframe src="https://evil.example.com/x"></iframe>', 'not a url', 'https://adilo.bigcommand.com/watch/a b']) {
    assert.equal(resolveVideo(bad as any), null, `should reject ${String(bad)}`);
  }
});

test('escapeAttr neutralises quotes and angle brackets', () => {
  assert.equal(escapeAttr('a"b<c>&'), 'a&quot;b&lt;c&gt;&amp;');
});
