import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSections, deriveCategories, isAdiloLesson, mapCourse } from '../src/logic/courses';

const row = {
  id: 'course-c768d88b', slug: null, title: ' Writing Basics ', price: '999', original_price: '2499', category: 'Web Development',
  category_slug: 'web-development', total_lessons: 13, thumbnail_url: 'https://x/y.jpg', banner_url: 'https://adilo.bigcommand.com/watch/49ragFyA',
  learning_outcomes: ['A', '', 3], prerequisites: ['__status:draft', 'Laptop'], target_audience: null, rating: null, created_at: '2026-11-01T00:00:00Z',
  profiles: { id: 'u1', full_name: 'Edufy Administrator', avatar_url: 'not-a-url' },
};

test('mapCourse maps real DB rows safely', () => {
  const c = mapCourse(row);
  assert.equal(c.id, 'course-c768d88b');
  assert.equal(c.title, 'Writing Basics');
  assert.equal(c.price, 999);
  assert.equal(c.originalPrice, 2499);
  assert.deepEqual(c.learningOutcomes, ['A']);
  assert.deepEqual(c.requirements, ['Laptop']); // website workflow marker hidden
  assert.deepEqual(c.targetAudience, []);
  assert.equal(c.instructor.name, 'Edufy Administrator');
  assert.equal(c.instructor.avatar, null); // invalid image URL never reaches <Image>
  assert.equal(c.rating, 0);
});

test('mapCourse tolerates missing/invalid numbers and profile arrays', () => {
  const c = mapCourse({ id: 7, price: 'abc', original_price: -5, profiles: [{ full_name: 'X' }] });
  assert.equal(c.id, '7');
  assert.equal(c.price, 0);
  assert.equal(c.originalPrice, 0);
  assert.equal(c.instructor.name, 'X');
  assert.equal(c.title, 'Untitled course');
});

test('categories are derived from courses and sorted by count', () => {
  const cats = deriveCategories([
    mapCourse({ ...row, id: 'a' }), mapCourse({ ...row, id: 'b' }), mapCourse({ ...row, id: 'c', category: 'Cybersecurity', category_slug: 'cybersecurity' }),
  ]);
  assert.deepEqual(cats.map((c) => [c.slug, c.count]), [['web-development', 2], ['cybersecurity', 1]]);
});

test('buildSections merges outline + accessible lessons without duplicates, in order', () => {
  const raw = [
    { id: 's2', title: 'Two', section_order: 2, lessons: [] },
    { id: 's1', title: 'One', section_order: 1, lessons: [{ id: 'l2', title: 'Full L2', lesson_order: 2, type: 'video', adilo_embed_url: 'https://adilo.bigcommand.com/watch/x', is_free_preview: true }] },
  ];
  const outline = [
    { id: 'l1', section_id: 's1', title: 'L1', lesson_order: 1, type: 'video', duration_minutes: 5 },
    { id: 'l2', section_id: 's1', title: 'L2', lesson_order: 2, type: 'video' },
    { id: 'l3', section_id: 's2', title: 'L3', lesson_order: 1, type: 'article' },
  ];
  const sections = buildSections(raw, outline);
  assert.deepEqual(sections.map((s) => s.id), ['s1', 's2']);
  assert.deepEqual(sections[0].lessons.map((l) => l.id), ['l1', 'l2']);
  assert.equal(sections[0].lessons[0].accessible, false); // locked (outline only)
  assert.equal(sections[0].lessons[1].accessible, true);
  assert.equal(sections[0].lessons[1].title, 'Full L2');
  assert.equal(isAdiloLesson(sections[0].lessons[1]), true);
  assert.equal(sections[1].lessons[0].type, 'article');
});

test('buildSections works without an outline (RPC unavailable)', () => {
  const sections = buildSections([{ id: 's1', title: 'One', section_order: 1, lessons: [{ id: 'l1', title: 'A', lesson_order: 1, type: 'weird' }] }], []);
  assert.equal(sections[0].lessons.length, 1);
  assert.equal(sections[0].lessons[0].type, 'video');
});
