import type { IncomingMessage, ServerResponse } from 'http'

// Per-instance request limiting for serverless API routes. This limits bursts
// within one warm instance; it is not a distributed rate limiter.

interface Bucket {
  /** Request timestamps (ms) within the current window. */
  hits: number[]
}

const BUCKETS = new Map<string, Bucket>()
let lastSweep = Date.now()

function getClientKey(req: IncomingMessage): string {
  // Prefer Vercel's forwarded client IP; use the socket peer as a fallback.
  const xff = req.headers['x-forwarded-for']
  const xffStr = Array.isArray(xff) ? xff[0] : xff
  if (xffStr) return xffStr.split(',')[0].trim()
  return req.socket?.remoteAddress ?? 'unknown'
}

/** Rate-limit by client IP; true means a 429 response was already written. */
export function rateLimit(
  req: IncomingMessage,
  res: ServerResponse,
  opts: { max?: number; windowMs?: number; key?: string } = {},
): boolean {
  const max = opts.max ?? 5
  const windowMs = opts.windowMs ?? 60_000
  const key = opts.key ?? getClientKey(req)
  const now = Date.now()

  if (now - lastSweep > 5 * 60_000) {
    for (const [k, b] of BUCKETS) {
      if (b.hits.length === 0 || b.hits[b.hits.length - 1] < now - windowMs) {
        BUCKETS.delete(k)
      }
    }
    lastSweep = now
  }

  let bucket = BUCKETS.get(key)
  if (!bucket) {
    bucket = { hits: [] }
    BUCKETS.set(key, bucket)
  }

  const cutoff = now - windowMs
  bucket.hits = bucket.hits.filter((ts) => ts >= cutoff)

  if (bucket.hits.length >= max) {
    const oldest = bucket.hits[0]
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
    res.statusCode = 429
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Retry-After', String(retryAfterSec))
    res.end(JSON.stringify({
      error: 'Rate limit exceeded',
      retryAfterSeconds: retryAfterSec,
    }))
    return true
  }

  bucket.hits.push(now)
  return false
}
