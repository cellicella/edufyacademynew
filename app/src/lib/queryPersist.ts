import { AppState } from 'react-native';
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { dehydrate, hydrate, type DehydratedState, type QueryClient } from '@tanstack/react-query';
import { buildSnapshot, readSnapshot, shouldPersistKey } from '@/logic/queryCache';

/**
 * Keeps a copy of the catalogue (and the student's enrolments/progress) in the app's private cache folder,
 * so the next start shows courses instantly and refreshes them in the background (stale-while-revalidate).
 * Never stores tokens, lesson content, payments or messages; removed on sign-out.
 */
const FILE_NAME = 'edufy-query-cache-v1.json';
const SAVE_DELAY_MS = 1500;
const buster = Constants.expoConfig?.version || '0';

function cacheFile(): File | null {
  try {
    return new File(Paths.cache, FILE_NAME);
  } catch {
    return null;
  }
}

let restored: Promise<void> | null = null;

/** Loads the saved snapshot into the query cache once (fast: one small local file). Never throws. */
export function restoreQueryCache(qc: QueryClient): Promise<void> {
  if (!restored) {
    restored = (async () => {
      try {
        const file = cacheFile();
        if (!file || !file.exists) return;
        const state = readSnapshot<DehydratedState>(await file.text(), Date.now(), buster);
        // hydrate never replaces data that is newer than the snapshot
        if (state) hydrate(qc, state);
      } catch (e) {
        console.warn('[query-cache] could not restore:', (e as Error)?.message || e);
      }
    })();
  }
  return restored;
}

function save(qc: QueryClient) {
  try {
    const state = dehydrate(qc, { shouldDehydrateQuery: (q) => q.state.status === 'success' && shouldPersistKey(q.queryKey) });
    const file = cacheFile();
    if (!file) return;
    if (!state.queries.length) {
      if (file.exists) file.delete();
      return;
    }
    if (!file.exists) file.create();
    file.write(buildSnapshot(state, Date.now(), buster));
  } catch (e) {
    console.warn('[query-cache] could not save:', (e as Error)?.message || e);
  }
}

/** Saves the snapshot shortly after cached data changes and when the app goes to the background. */
export function startQueryCachePersistence(qc: QueryClient): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      save(qc);
    }, SAVE_DELAY_MS);
  };
  const unsubscribe = qc.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'success' && shouldPersistKey(event.query.queryKey)) schedule();
  });
  const sub = AppState.addEventListener('change', (s) => {
    if (s !== 'active' && timer) {
      clearTimeout(timer);
      timer = null;
      save(qc);
    }
  });
  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
    sub.remove();
  };
}

/** Deletes the saved snapshot (sign-out). */
export function clearPersistedQueryCache() {
  try {
    const file = cacheFile();
    if (file?.exists) file.delete();
  } catch {
    /* nothing saved */
  }
}
