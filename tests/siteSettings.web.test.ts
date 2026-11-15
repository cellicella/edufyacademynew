import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, mergeSettings, maintenanceActive, waHref, telHref, copyrightText } from '../src/config/siteSettings';

test('website settings merge: fallback to defaults, hide disabled/insecure social links', () => {
  const m = mergeSettings({ general: { siteName: 'X' }, social: { links: [
    { id: 'a', platform: 'facebook', url: 'https://fb.com/x', enabled: true, position: 1 },
    { id: 'b', platform: 'x', url: 'http://x.com/x', enabled: true, position: 0 },
    { id: 'c', platform: 'youtube', url: 'https://yt.com/x', enabled: false, position: 2 },
  ] } });
  assert.equal(m.general.siteName, 'X');
  assert.equal(m.general.appName, DEFAULT_SETTINGS.general.appName);
  assert.deepEqual(m.social.links.map((l) => l.id), ['a']);
  assert.deepEqual(mergeSettings('garbage').contact, DEFAULT_SETTINGS.contact);
});

test('website helpers', () => {
  assert.equal(waHref('+91 99169 58480', 'Hi there'), 'https://wa.me/919916958480?text=Hi%20there');
  assert.equal(waHref(''), '');
  assert.equal(telHref('+91 99169 58480'), 'tel:+919916958480');
  assert.ok(copyrightText(DEFAULT_SETTINGS).includes(String(new Date().getFullYear())));
  const now = Date.parse('2026-11-20T10:30:00Z');
  assert.equal(maintenanceActive({ ...DEFAULT_SETTINGS.maintenance, websiteEnabled: true }, 'website', now), true);
  assert.equal(maintenanceActive({ ...DEFAULT_SETTINGS.maintenance, websiteEnabled: true, endsAt: '2026-11-20T10:00:00Z' }, 'website', now), false);
});
