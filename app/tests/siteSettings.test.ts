import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_APP_SETTINGS, appMaintenanceActive, compareVersions, mergeAppSettings, supportContacts, updateState, waUrl } from '../src/logic/siteSettings';
import { mapBanner } from '../src/logic/engagement';
import { itemTarget } from '../src/logic/deepLinks';

test('merge: defaults for missing/invalid values, never crashes', () => {
  assert.deepEqual(mergeAppSettings(null), DEFAULT_APP_SETTINGS);
  const m = mergeAppSettings({ app: { showOffers: 'yes', noticeText: 42, minVersion: '2.0.0' }, general: { appName: 'Edufy' } });
  assert.equal(m.app.showOffers, true); // invalid → default
  assert.equal(m.app.noticeText, '');
  assert.equal(m.app.minVersion, '2.0.0');
  assert.equal(m.general.appName, 'Edufy');
});

test('merge: social links filtered (enabled + https) and ordered', () => {
  const m = mergeAppSettings({ social: { links: [
    { id: 'b', platform: 'youtube', label: 'YouTube', url: 'https://youtube.com/@e', enabled: true, position: 2 },
    { id: 'a', platform: 'facebook', label: 'Facebook', url: 'https://facebook.com/e', enabled: true, position: 1 },
    { id: 'c', platform: 'x', label: 'X', url: 'http://insecure', enabled: true, position: 0 },
    { id: 'd', platform: 'reddit', label: 'Reddit', url: 'https://reddit.com/u/e', enabled: false, position: 3 },
  ] } });
  assert.deepEqual(m.social.links.map((l) => l.id), ['a', 'b']);
});

test('versions: force below minimum, soft below latest', () => {
  assert.equal(compareVersions('1.10.0', '1.9.0'), 1);
  assert.equal(updateState('1.0.0', { minVersion: '1.1.0', latestVersion: '1.2.0' }), 'force');
  assert.equal(updateState('1.1.5', { minVersion: '1.1.0', latestVersion: '1.2.0' }), 'soft');
  assert.equal(updateState('1.2.0', { minVersion: '1.1.0', latestVersion: '1.2.0' }), 'none');
  assert.equal(updateState('1.0.0', { minVersion: '', latestVersion: 'bad' }), 'none');
});

test('maintenance window', () => {
  const now = Date.parse('2026-11-20T10:30:00Z');
  const base = { ...DEFAULT_APP_SETTINGS.maintenance, appEnabled: true };
  assert.equal(appMaintenanceActive(base, now), true);
  assert.equal(appMaintenanceActive({ ...base, startsAt: '2026-11-20T11:00:00Z' }, now), false);
  assert.equal(appMaintenanceActive({ ...base, endsAt: '2026-11-20T10:00:00Z' }, now), false);
  assert.equal(appMaintenanceActive({ ...base, appEnabled: false }, now), false);
});

test('support contacts fall back to contact/whatsapp settings', () => {
  const s = mergeAppSettings({ contact: { primaryPhone: '+91 90000 00000', supportEmail: 'help@edufy.example' }, whatsapp: { enabled: true, number: '+91 99169 58480', supportMessage: 'Hi' } });
  const c = supportContacts(s, 'https://edufy.example');
  assert.equal(c.phone, '+91 90000 00000');
  assert.equal(c.email, 'help@edufy.example');
  assert.equal(c.whatsappUrl, 'https://wa.me/919916958480?text=Hi');
  assert.equal(c.helpUrl, 'https://edufy.example/faq');
  const s2 = mergeAppSettings({ app: { supportPhone: '+91 81111 11111', helpUrl: 'https://help.example' }, whatsapp: { enabled: false, number: '+91 99169 58480' } });
  const c2 = supportContacts(s2, '');
  assert.equal(c2.phone, '+91 81111 11111');
  assert.equal(c2.whatsappUrl, null);
  assert.equal(c2.helpUrl, 'https://help.example');
  assert.equal(waUrl('123'), null);
});

test('banners: blog link + CTA text', () => {
  const b = mapBanner({ id: 1, title: 'Read', link_type: 'blog', blog_slug: 'excel-tips', cta_text: ' Read now ', subtitle: 'Guide' });
  assert.equal(b.linkType, 'blog');
  assert.equal(b.ctaText, 'Read now');
  assert.deepEqual(itemTarget(b), { kind: 'internal', path: '/blog/excel-tips' });
  assert.equal(itemTarget(mapBanner({ id: 2, title: 'x', link_type: 'blog', blog_slug: '../admin' })), null);
});
