import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPlayerEvent, createWatchState } from '../src/logic/watchTime';

test('natural playback is counted', () => {
  const s = createWatchState(0, 100);
  applyPlayerEvent(s, { eventName: 'play' });
  for (let t = 0; t <= 10; t++) applyPlayerEvent(s, { eventName: 'currentTime', timestamp: t });
  assert.equal(Math.round(s.watched), 10);
  assert.equal(s.dirty, true);
});

test('seeking forward or backward is not counted as watching', () => {
  const s = createWatchState(0, 600);
  applyPlayerEvent(s, { eventName: 'currentTime', timestamp: 0 });
  applyPlayerEvent(s, { eventName: 'currentTime', timestamp: 300 }); // jump
  applyPlayerEvent(s, { eventName: 'currentTime', timestamp: 100 }); // back
  assert.equal(s.watched, 0);
  assert.equal(s.position, 100);
});

test('opening the player alone never adds watch time', () => {
  const s = createWatchState(0, 0);
  assert.equal(applyPlayerEvent(s, { eventName: 'ready', media: { duration: 120 } }), null);
  assert.equal(s.watched, 0);
  assert.equal(s.dirty, false);
  assert.equal(s.duration, 120);
});

test('pause/end request a save; watched never exceeds duration', () => {
  const s = createWatchState(58, 60);
  applyPlayerEvent(s, { eventName: 'currentTime', timestamp: 58 });
  applyPlayerEvent(s, { eventName: 'currentTime', timestamp: 62 });
  assert.equal(s.watched, 60);
  assert.equal(applyPlayerEvent(s, { eventName: 'paused', currentPlayerTimestamp: 60 }), 'paused');
  assert.equal(applyPlayerEvent(s, { eventName: 'ended' }), 'ended');
  assert.equal(applyPlayerEvent(s, { eventName: 'currentTime', timestamp: 'x' }), null);
});
