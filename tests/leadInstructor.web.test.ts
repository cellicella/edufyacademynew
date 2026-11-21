import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEAD_INSTRUCTOR, displayInstructor, isPlatformAccount } from '../src/config/leadInstructor';

const base = { id: 'u1', avatar: 'https://x/a.png', company: '', bio: '', totalStudents: 0, rating: 0, coursesCount: 0 } as any;

test('Edufy’s own courses (administrator account) show the lead instructor', () => {
  const admin = { ...base, name: 'Edufy Admin', title: 'Platform Administrator' };
  assert.equal(isPlatformAccount(admin), true);
  const d = displayInstructor(admin);
  assert.equal(d.name, 'Bhavna Nimbalkar');
  assert.equal(d.title, 'Lead Instructor');
  assert.equal(d.isLead, true);
  assert.ok(d.avatar.startsWith('/instructors/'));
});

test('real instructor profiles are shown unchanged', () => {
  const real = { ...base, name: 'Priya Sharma', title: 'Excel Trainer' };
  assert.equal(isPlatformAccount(real), false);
  assert.deepEqual(displayInstructor(real), { name: 'Priya Sharma', title: 'Excel Trainer', avatar: 'https://x/a.png', isLead: false });
  assert.equal(isPlatformAccount(null), false);
});

test('no unverified instructor details are configured', () => {
  assert.equal(LEAD_INSTRUCTOR.bio, '');
  assert.deepEqual(LEAD_INSTRUCTOR.qualifications, []);
  assert.equal(LEAD_INSTRUCTOR.experience, '');
  assert.deepEqual(LEAD_INSTRUCTOR.expertise, []);
});
