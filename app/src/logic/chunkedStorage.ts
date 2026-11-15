/**
 * Chunked, serialised key-value storage on top of a small-value backend (expo-secure-store).
 * SecureStore values should stay under ~2 KB; a Supabase session can be larger.
 */
export interface KVBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

export const safeKey = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, '_');

export function createChunkedStorage(backend: KVBackend, opts: { chunkSize?: number; onUnreadable?: (key: string, err: unknown) => void } = {}) {
  const CHUNK = opts.chunkSize || 1800;
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };

  async function removeChunks(k: string) {
    let count = 0;
    try {
      count = Number(await backend.get(`${k}.n`)) || 0;
    } catch {
      count = 0;
    }
    for (let i = 0; i < count; i++) await backend.del(`${k}.${i}`).catch(() => undefined);
    await backend.del(`${k}.n`).catch(() => undefined);
    await backend.del(k).catch(() => undefined);
  }

  async function readChunks(k: string): Promise<string | null> {
    const count = await backend.get(`${k}.n`);
    if (!count) return backend.get(k);
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 1000) throw new Error('corrupt chunk count');
    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      const part = await backend.get(`${k}.${i}`);
      if (part == null) throw new Error('incomplete value');
      parts.push(part);
    }
    return parts.join('');
  }

  return {
    getItem(key: string): Promise<string | null> {
      const k = safeKey(key);
      return serial(async () => {
        try {
          return await readChunks(k);
        } catch (e) {
          // Unreadable (e.g. Android Keystore key changed after a backup restore): the stored
          // session can never be decrypted, so remove it and let the student sign in again.
          opts.onUnreadable?.(k, e);
          await removeChunks(k);
          return null;
        }
      });
    },
    setItem(key: string, value: string): Promise<void> {
      const k = safeKey(key);
      return serial(async () => {
        await removeChunks(k);
        const chunks = Math.max(1, Math.ceil(value.length / CHUNK));
        for (let i = 0; i < chunks; i++) await backend.set(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
        await backend.set(`${k}.n`, String(chunks)); // written last: a crash mid-write leaves no count → treated as absent
      });
    },
    removeItem(key: string): Promise<void> {
      return serial(() => removeChunks(safeKey(key)));
    },
  };
}
