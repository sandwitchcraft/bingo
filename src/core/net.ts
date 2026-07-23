/**
 * The one place a network request is made from. React-free.
 *
 * RN's fetch has no timeout of its own, so a request on a captive-portal network hangs
 * indefinitely — every caller here would otherwise have to remember that. `AbortSignal.timeout`
 * isn't in Hermes, hence the manual controller.
 */

export const REQUEST_TIMEOUT_MS = 10_000;

/**
 * A caller's `init.signal` is honored *in addition to* the timeout, not instead of it — one
 * request has two independent reasons to abort (the user cancelled; it took too long), and
 * only one `AbortController` can drive a fetch. So the caller's signal is chained into the
 * internal controller rather than replacing it.
 */
export async function fetchJSON(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const external = init?.signal;
  const abort = () => controller.abort();
  // Already-aborted signals never fire the event, so check before subscribing.
  if (external?.aborted) abort();
  else external?.addEventListener("abort", abort);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      // GitHub Pages answers a missing path with a 200-shaped HTML 404 page in some
      // configurations, so the JSON parse below is the real guard; this catches the rest.
      throw new Error(`${response.status} ${response.statusText} for ${url}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", abort);
  }
}
