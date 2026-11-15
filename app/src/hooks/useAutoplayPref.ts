import { useCallback, useEffect, useState } from 'react';
import { prefs } from '@/lib/secureStorage';

const KEY = 'autoplay_next';
let cached: boolean | null = null;
const listeners = new Set<(v: boolean) => void>();

/** "Play the next lesson automatically" preference (on by default), shared across screens. */
export function useAutoplayPref(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(cached ?? true);
  useEffect(() => {
    listeners.add(setValue);
    if (cached === null) {
      prefs.get(KEY).then((v) => {
        cached = v !== '0';
        listeners.forEach((l) => l(cached!));
      });
    }
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  const set = useCallback((v: boolean) => {
    cached = v;
    listeners.forEach((l) => l(v));
    prefs.set(KEY, v ? '1' : '0').catch(() => undefined);
  }, []);
  return [value, set];
}
