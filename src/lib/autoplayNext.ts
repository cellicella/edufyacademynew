/**
 * "Autoplay next lesson" in the course player: when a lesson video finishes, the next lesson opens after a short
 * countdown and its video starts by itself. Learners can turn it off; the choice is remembered on this device.
 */
export const AUTOPLAY_COUNTDOWN_SECONDS = 5;
const PREF_KEY = 'edufy_autoplay_next';

type Store = Pick<Storage, 'getItem' | 'setItem'> | null | undefined;
const defaultStore = (): Store => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

/** On by default; only an explicit "off" turns it off. */
export function readAutoplayPref(store: Store = defaultStore()): boolean {
  try {
    return store?.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function writeAutoplayPref(on: boolean, store: Store = defaultStore()) {
  try {
    store?.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    /* storage blocked: the choice lasts for this visit only */
  }
}

/**
 * The lesson to continue with after `currentId` finishes, or null when there is none, autoplay is off, or the
 * learner cannot open it (not enrolled and not a free preview).
 */
export function lessonToAutoplay<L extends { id: string; isFreePreview?: boolean }>(
  lessons: L[],
  currentId: string,
  opts: { enabled: boolean; enrolled: boolean }
): L | null {
  if (!opts.enabled) return null;
  const i = lessons.findIndex((l) => l.id === currentId);
  if (i < 0 || i >= lessons.length - 1) return null;
  const next = lessons[i + 1];
  return opts.enrolled || next.isFreePreview ? next : null;
}
