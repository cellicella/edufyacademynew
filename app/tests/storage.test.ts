import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChunkedStorage, safeKey } from '../src/logic/chunkedStorage';

function memoryBackend() {
  const m = new Map<string, string>();
  return { m, get: async (k: string) => m.get(k) ?? null, set: async (k: string, v: string) => void m.set(k, v), del: async (k: string) => void m.delete(k) };
}

test('keys are sanitised for SecureStore', () => {
  assert.equal(safeKey('sb-tyqd-auth-token'), 'sb-tyqd-auth-token');
  assert.equal(safeKey('a/b:c d'), 'a_b_c_d');
});

test('large session values are chunked and reassembled', async () => {
  const b = memoryBackend();
  const s = createChunkedStorage(b, { chunkSize: 100 });
  const value = JSON.stringify({ access_token: 'x'.repeat(950), refresh_token: 'r'.repeat(40) });
  await s.setItem('sb-auth-token', value);
  assert.equal(b.m.get('sb-auth-token.n'), String(Math.ceil(value.length / 100)));
  for (const v of b.m.values()) assert.ok(v.length <= 100);
  assert.equal(await s.getItem('sb-auth-token'), value);
});

test('overwriting with a shorter value removes stale chunks; remove clears all', async () => {
  const b = memoryBackend();
  const s = createChunkedStorage(b, { chunkSize: 10 });
  await s.setItem('k', 'a'.repeat(95));
  await s.setItem('k', 'short');
  assert.equal(await s.getItem('k'), 'short');
  assert.equal([...b.m.keys()].filter((k) => k.startsWith('k.')).length, 2); // k.0 + k.n
  await s.removeItem('k');
  assert.equal(b.m.size, 0);
  assert.equal(await s.getItem('k'), null);
});

test('concurrent writes are serialised (no interleaved chunks)', async () => {
  const b = memoryBackend();
  const slow = { ...b, set: async (k: string, v: string) => { await new Promise((r) => setTimeout(r, Math.random() * 5)); b.m.set(k, v); } };
  const s = createChunkedStorage(slow, { chunkSize: 5 });
  await Promise.all([s.setItem('k', 'A'.repeat(23)), s.setItem('k', 'B'.repeat(17)), s.setItem('k', 'C'.repeat(31))]);
  assert.equal(await s.getItem('k'), 'C'.repeat(31));
});

test('unreadable (corrupted / undecryptable) values are cleared, not thrown', async () => {
  const b = memoryBackend();
  b.m.set('k.n', '3');
  b.m.set('k.0', 'abc'); // chunks 1 and 2 missing
  let reported = '';
  const s = createChunkedStorage(b, { onUnreadable: (key) => { reported = key; } });
  assert.equal(await s.getItem('k'), null);
  assert.equal(reported, 'k');
  assert.equal(b.m.size, 0);

  const failing = { ...memoryBackend(), get: async () => { throw new Error('Could not decrypt the value'); } };
  const s2 = createChunkedStorage(failing);
  assert.equal(await s2.getItem('k'), null);
});

test('legacy single-key value (no chunk count) is still readable', async () => {
  const b = memoryBackend();
  b.m.set('pref_onboarding_done', '1');
  assert.equal(await createChunkedStorage(b).getItem('pref_onboarding_done'), '1');
});
