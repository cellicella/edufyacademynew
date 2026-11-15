import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { reportVideoProgress } from '@/services/learning';
import { PlayerEvent } from '@/components/VideoPlayer';
import { applyPlayerEvent, createWatchState } from '@/logic/watchTime';

const SAVE_INTERVAL_MS = 15000;

/**
 * Same watch-time accounting as the website's AdiloPlayer (see logic/watchTime.ts). Progress
 * is sent to the existing server endpoint, which caps it by wall-clock time and marks the
 * lesson complete at 90%. Opening the player never completes a lesson by itself.
 */
export function useAdiloTracking(
  lessonId: string | null,
  initial: { watched: number; duration: number },
  onCompleted: () => void,
  /** Called once per lesson after a genuine player "ended" event, AFTER its progress save finished. */
  onEnded?: (lessonId: string) => void
) {
  const s = useRef(createWatchState());
  const meta = useRef({ lastSaved: 0, completed: false, saving: false });
  const lessonRef = useRef(lessonId);
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const endedFor = useRef<string | null>(null);

  useEffect(() => {
    lessonRef.current = lessonId;
    s.current = createWatchState(initial.watched || 0, initial.duration || 0);
    meta.current = { lastSaved: 0, completed: false, saving: false };
    endedFor.current = null;
  }, [lessonId, initial.watched, initial.duration]);

  const save = useCallback(async (event: string) => {
    const id = lessonRef.current;
    const st = s.current;
    if (!id || !st.dirty) return;
    if (meta.current.saving && event === 'currentTime') return; // avoid overlapping periodic saves
    st.dirty = false;
    meta.current.lastSaved = Date.now();
    meta.current.saving = true;
    try {
      const r = await reportVideoProgress(id, {
        position: Math.round(st.position),
        watchedSeconds: Math.round(st.watched),
        duration: Math.round(st.duration),
        event,
      });
      if ((r.justCompleted || r.isCompleted) && !meta.current.completed && id === lessonRef.current) {
        meta.current.completed = true;
        onCompletedRef.current();
      }
    } catch (e: any) {
      if (id === lessonRef.current) st.dirty = true; // retried on the next save (no loop: saves only follow player events)
      if (__DEV__) console.warn('[video-progress] save failed:', e?.message || e);
    } finally {
      meta.current.saving = false;
    }
  }, []);

  const onEvent = useCallback(
    (e: PlayerEvent) => {
      const reason = applyPlayerEvent(s.current, e);
      if (reason === 'currentTime') {
        if (Date.now() - meta.current.lastSaved > SAVE_INTERVAL_MS) save('currentTime');
      } else if (reason === 'ended') {
        const id = lessonRef.current;
        // Players can emit "ended" more than once — handle it a single time per lesson
        if (!id || endedFor.current === id) return;
        endedFor.current = id;
        // Save first (server decides completion from verified watch time), then notify
        save('ended').finally(() => {
          if (lessonRef.current === id) onEndedRef.current?.(id);
        });
      } else if (reason) {
        save(reason);
      }
    },
    [save]
  );

  // Flush when the app goes to the background, and when leaving the lesson
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') save('paused');
    });
    return () => {
      sub.remove();
      save('paused');
    };
  }, [save, lessonId]);

  return onEvent;
}
