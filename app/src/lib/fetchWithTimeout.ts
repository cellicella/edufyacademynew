/** fetch() with a timeout that also respects a caller's AbortSignal (React Query cancellation). */
export function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const outer = init.signal;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener('abort', onAbort);
  }
  return fetch(input, { ...init, signal: controller.signal })
    .catch((err) => {
      if (timedOut) {
        const e = new Error('Request timed out');
        (e as any).status = 408;
        throw e;
      }
      throw err;
    })
    .finally(() => {
      clearTimeout(timer);
      if (outer) outer.removeEventListener('abort', onAbort);
    });
}
