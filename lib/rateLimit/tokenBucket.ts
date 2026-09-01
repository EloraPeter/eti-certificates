import "server-only";

// Basic in-memory rate limiting for GET /api/verify/[token].
//
// ⚠️ Documented limitation, per directive §20 ("document the
// rate-limit strategy" / "do not depend on an external paid service
// unless necessary"): this is an in-process Map, which means it is
// NOT shared across serverless function instances or across
// deployment regions. On a platform that scales this route
// horizontally (e.g. multiple concurrent Vercel lambda instances),
// each instance enforces its own independent limit — the *effective*
// global limit is therefore higher than the configured per-instance
// limit, not a hard ceiling. This is an accepted tradeoff for v1
// (zero external dependency, zero cost) rather than a claim that
// it's a complete abuse-prevention system.
//
// If/when real abuse is observed, or if the deployment target is
// confirmed to run many concurrent instances, the recommended
// upgrade is a shared store (Upstash Redis is the natural fit for a
// Vercel deployment) behind this exact same function signature — no
// call site changes needed, only this file's internals.
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // per IP, per window, per instance — see caveat above

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

// Opportunistic cleanup so the Map doesn't grow unbounded on a
// long-lived instance. Not a background timer (serverless functions
// may not keep timers alive between invocations) — cleanup piggybacks
// on normal calls instead.
function cleanupStaleBuckets(now: number) {
  if (buckets.size < 5000) return; // only bother once it's actually large
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > WINDOW_MS * 2) buckets.delete(key);
  }
}

export function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  cleanupStaleBuckets(now);

  const existing = buckets.get(identifier);
  if (!existing || now - existing.windowStart > WINDOW_MS) {
    buckets.set(identifier, { count: 1, windowStart: now });
    return false;
  }

  existing.count += 1;
  return existing.count > MAX_REQUESTS_PER_WINDOW;
}

export function getClientIdentifier(request: Request): string {
  // Standard forwarded-for header on Vercel/most proxies. Falls back
  // to a constant so the limiter still functions (globally, not
  // per-IP) in local dev where the header is absent, rather than
  // throwing.
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return "unknown";
}
