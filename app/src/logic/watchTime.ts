/**
 * Watch-time accounting for the Adilo player (same rules as the website's AdiloPlayer):
 * only natural forward playback counts — seeks/scrubs (jumps > 5 s or backwards) are ignored.
 */
export interface WatchState { position: number; lastTick: number | null; watched: number; duration: number; dirty: boolean }
export type SaveReason = 'currentTime' | 'paused' | 'ended' | null;

export const createWatchState = (watched = 0, duration = 0): WatchState => ({ position: 0, lastTick: null, watched, duration, dirty: false });

/** Mutates state for one player event; returns whether (and why) progress should be saved. */
export function applyPlayerEvent(s: WatchState, e: { eventName: string; [k: string]: any }): SaveReason {
  const d = Number(e?.media?.duration);
  if (Number.isFinite(d) && d > 0 && d < 86400) s.duration = d;
  switch (e?.eventName) {
    case 'play':
      s.lastTick = null;
      return null;
    case 'currentTime': {
      const t = Number(e.timestamp);
      if (!Number.isFinite(t) || t < 0) return null;
      if (s.lastTick !== null) {
        const delta = t - s.lastTick;
        if (delta > 0 && delta <= 5) {
          s.watched += delta;
          if (s.duration > 0) s.watched = Math.min(s.watched, s.duration);
          s.dirty = true;
        }
      }
      s.lastTick = t;
      s.position = t;
      return 'currentTime';
    }
    case 'paused': {
      const t = Number(e.currentPlayerTimestamp);
      if (Number.isFinite(t) && t >= 0) s.position = t;
      s.lastTick = null;
      s.dirty = true;
      return 'paused';
    }
    case 'ended':
      s.lastTick = null;
      s.dirty = true;
      return 'ended';
    default:
      return null;
  }
}
