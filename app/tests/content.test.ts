import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities, htmlToText, parseHtml } from '../src/logic/html';
import { mergeCategories } from '../src/logic/courses';
import { SOCIAL_PROFILES } from '../src/logic/social';
import { isSafeInternalPath } from '../src/logic/deepLinks';

test('html parser: blocks, inline formatting and lists', () => {
  const b = parseHtml('<h2>Title &amp; more</h2><p>Hello <strong>bold</strong> and <em>it</em> <a href="https://x.com">link</a></p><ul><li>One</li><li>Two</li></ul><ol><li>A</li></ol><blockquote>Quote</blockquote><hr><pre>code\n  line</pre>');
  assert.equal(b[0].type, 'h2');
  assert.equal((b[0] as any).inlines[0].text, 'Title & more');
  const p = b[1] as any;
  assert.equal(p.type, 'p');
  assert.ok(p.inlines.find((i: any) => i.text === 'bold' && i.bold));
  assert.ok(p.inlines.find((i: any) => i.text === 'it' && i.italic));
  assert.ok(p.inlines.find((i: any) => i.text === 'link' && i.href === 'https://x.com'));
  assert.deepEqual(b.filter((x) => x.type === 'li').map((x: any) => [x.ordered, x.index]), [[false, 1], [false, 2], [true, 1]]);
  assert.ok(b.find((x) => x.type === 'quote'));
  assert.ok(b.find((x) => x.type === 'hr'));
  assert.equal((b.find((x) => x.type === 'pre') as any).text, 'code\n  line');
});

test('html parser: never keeps scripts, unsafe links or insecure images', () => {
  const b = parseHtml('<p onclick="alert(1)">Hi<script>alert(1)</script></p><a href="javascript:alert(1)">bad</a><img src="http://insecure/x.png"><img src="https://ok/x.png" alt="ok"><iframe src="https://evil"></iframe><style>p{}</style>');
  const text = JSON.stringify(b);
  assert.ok(!/alert|iframe|style|javascript/.test(text));
  assert.equal(b.filter((x) => x.type === 'img').length, 1);
  const link = (b.find((x) => x.type === 'p' && (x as any).inlines.some((i: any) => i.text === 'bad')) as any).inlines.find((i: any) => i.text === 'bad');
  assert.equal(link.href, undefined);
});

test('html helpers', () => {
  assert.equal(decodeEntities('&lt;b&gt; &#39;x&#39; &#x2014; &nbsp;'), "<b> 'x' —  ".replace(' ', ' '));
  assert.equal(htmlToText('<p>Hello <b>world</b></p>'), 'Hello world');
  assert.deepEqual(parseHtml(''), []);
  assert.deepEqual(parseHtml('<p>   </p>'), []);
});

test('categories: admin order, active only, only categories with courses, fallback', () => {
  const courses: any[] = [
    { categorySlug: 'web', category: 'Web' }, { categorySlug: 'web', category: 'Web' }, { categorySlug: 'ai', category: 'AI' }, { categorySlug: 'x', category: 'X' },
  ];
  const rows = [
    { slug: 'ai', name: 'Artificial Intelligence', position: 1, is_active: true },
    { slug: 'web', name: 'Web Development', position: 2, is_active: true, image_url: 'http://insecure' },
    { slug: 'empty', name: 'Empty', position: 3, is_active: true },
    { slug: 'x', name: 'Hidden', position: 0, is_active: false },
  ];
  const m = mergeCategories(rows, courses);
  assert.deepEqual(m.map((c) => [c.slug, c.name, c.count]), [['ai', 'Artificial Intelligence', 1], ['web', 'Web Development', 2]]);
  assert.equal(m[1].imageUrl, null);
  // table not available → derived from courses
  assert.deepEqual(mergeCategories(null, courses).map((c) => c.slug), ['web', 'ai', 'x']);
});

test('social profiles are the official https URLs', () => {
  assert.deepEqual(SOCIAL_PROFILES.map((s) => s.url), [
    'https://www.facebook.com/edufyacademy360/',
    'https://www.instagram.com/edufyacademy_learning/',
    'https://www.linkedin.com/company/edufyacademy360/',
    'https://x.com/edufyacademy247',
    'https://in.pinterest.com/elseduacademy/',
    'https://www.reddit.com/user/edufyAcademy/',
  ]);
});

test('blog deep links', () => {
  assert.equal(isSafeInternalPath('/blog'), true);
  assert.equal(isSafeInternalPath('/blog/how-to-learn-excel'), true);
  assert.equal(isSafeInternalPath('/blog/../admin'), false);
});
