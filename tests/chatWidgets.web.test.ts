import { test } from 'node:test';
import assert from 'node:assert/strict';
import { showChatWidgets } from '../src/config/chatWidgets';

test('WhatsApp and Tidio show on the homepage and Contact Us only', () => {
  for (const p of ['/', '', '/contact', '/contact/', '/Contact']) assert.equal(showChatWidgets(p), true, p);
  for (const p of [
    '/courses', '/courses/course-c0d5dc79', '/checkout', '/cart', '/login', '/register', '/forgot-password', '/reset-password',
    '/blog', '/blog/some-post', '/dashboard', '/student', '/learn/course-1', '/admin', '/admin/settings', '/bundles/b1',
    '/categories', '/instructors', '/verify-certificate', '/contact-us-elsewhere', '/contacts',
  ]) assert.equal(showChatWidgets(p), false, p);
});
