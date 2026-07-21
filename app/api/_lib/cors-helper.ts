import type { IncomingMessage, ServerResponse } from 'http'

export const ALLOWED_ORIGINS = [
  'https://app.soft.law',
  'https://soft.law',
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173', 'http://localhost:4173'] : []),
]

/** Sets CORS headers and blocks disallowed origins. Returns true if the request was handled (OPTIONS or 403). */
export function setCors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') {
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.statusCode = 204
    res.end()
    return true
  }

  // Block disallowed origins before any server-side work
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    res.statusCode = 403
    res.end('Forbidden')
    return true
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  return false
}
