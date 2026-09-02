// A small in-memory sliding-window limiter for the login endpoint (plan
// Phase 2, item 5). This is an extra, fast, per-instance throttle in front
// of the authoritative, cross-instance defense: the DB-backed account
// lockout (failedAttempts / lockedUntil) applied in the login action.
//
// Caveat by design: serverless instances don't share this Map, so on its
// own it wouldn't stop a distributed attack — that's exactly why the DB
// lockout exists too. Swap this for Upstash Redis if you want a shared
// limiter across instances.

interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000; // 1 minute
const MAX_HITS = 10; // per key per window
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, retryAfterSec: 0 };
  }

  bucket.count += 1;
  if (bucket.count > MAX_HITS) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

// Opportunistic cleanup so the Map can't grow without bound on a
// long-lived instance.
export function sweepRateLimiter(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}
