import test from 'node:test';
import assert from 'node:assert/strict';
import { createCronHandler } from '../server/cron';

const SECRET = 'a'.repeat(20) + 'B'.repeat(20);
function call(handler: any, req: any) {
  const out: any = { status: 200 };
  const res: any = { status(s: number) { out.status = s; return res; }, json(b: any) { out.body = b; return res; } };
  return Promise.resolve(handler(req, res)).then(() => out);
}

test('cron: refuses without a configured secret, wrong key, missing key', async () => {
  const runs: string[] = [];
  const tasks = { email: async () => { runs.push('email'); } };
  assert.equal((await call(createCronHandler(() => '', tasks), { query: { key: 'x' }, headers: {} })).status, 503);
  assert.equal((await call(createCronHandler(() => 'short', tasks), { query: { key: 'short' }, headers: {} })).status, 503);
  const h = createCronHandler(() => SECRET, tasks);
  assert.equal((await call(h, { query: { key: 'wrong' }, headers: {} })).status, 401);
  assert.equal((await call(h, { query: {}, headers: {} })).status, 401);
  assert.deepEqual(runs, []);
});

test('cron: runs every task, reports errors per task, accepts header key', async () => {
  const h = createCronHandler(() => SECRET, {
    email: async () => 'ok',
    push: async () => { throw new Error('expo down'); },
  });
  const r = await call(h, { query: {}, headers: { 'x-cron-key': SECRET } });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.email, 'ok');
  assert.equal(r.body.push, 'error: expo down');
});

test('cron: overlapping calls do not run twice', async () => {
  let release!: () => void;
  let count = 0;
  const h = createCronHandler(() => SECRET, { email: () => new Promise<void>((r) => { count++; release = r; }) });
  const first = call(h, { query: { key: SECRET }, headers: {} });
  const second = await call(h, { query: { key: SECRET }, headers: {} });
  assert.match(second.body.skipped, /in progress/);
  release();
  assert.equal((await first).body.email, 'ok');
  assert.equal(count, 1);
});
