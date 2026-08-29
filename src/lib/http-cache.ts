// Lightweight client-side GET cache + in-flight request dedupe.
// Cuts repeat API round-trips (categories, settings, banners, products...)
// so navigation between pages feels instant.

type Entry = { at: number; ttl: number; value: any };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<any>>();

export const DEFAULT_TTL = 60_000; // 1 min

function ttlFor(key: string): number {
  if (/\/api\/(settings|categories|banners|offers)/.test(key)) return 5 * 60_000;
  if (/\/api\/(orders|cart|auth|admin)/.test(key)) return 0; // never cache
  return DEFAULT_TTL;
}

export function cacheKey(path: string, extra = ""): string {
  return `${path}::${extra}`;
}

/** Run `fn` with caching + dedupe. TTL 0 disables caching entirely. */
export async function cachedGet<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
  const life = ttl ?? ttlFor(key);
  if (life <= 0) return fn();

  const hit = store.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const p = fn()
    .then((value) => {
      store.set(key, { at: Date.now(), ttl: life, value });
      return value;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

/** Drop cached entries. Called after every write so admin edits show instantly. */
export function invalidate(match?: string | RegExp): void {
  if (!match) return store.clear();
  for (const key of [...store.keys()]) {
    const hit = typeof match === "string" ? key.includes(match) : match.test(key);
    if (hit) store.delete(key);
  }
}
