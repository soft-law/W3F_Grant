import type { IncomingMessage, ServerResponse } from 'http'
import { setCors } from './_lib/cors-helper.js'
import { rateLimit } from './_lib/rate-limit.js'

const PINATA_FILE_BY_CID = 'https://api.pinata.cloud/v3/files/public/by_cid/'

const CID_REGEX = /^(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{50,200})$/

/**
 * Best-effort cleanup for uploads whose consuming transaction did not finish.
 * Pinata resolves the CID to a file ID before deletion. Cleanup failures are
 * returned in the response without blocking the client workflow.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (setCors(req, res)) return
  if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return }
  if (rateLimit(req, res, { max: 10, windowMs: 60_000 })) return

  const jwt = process.env.PINATA_JWT
  if (!jwt) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'PINATA_JWT not configured' }))
    return
  }

  let body: { cid?: unknown }
  try {
    const raw = await new Promise<string>((resolve, reject) => {
      let data = ''
      req.on('data', (chunk: Buffer) => { data += chunk.toString() })
      req.on('error', reject)
      req.on('end', () => resolve(data))
    })
    body = JSON.parse(raw) as { cid?: unknown }
  } catch {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Invalid JSON body' }))
    return
  }

  const cid = typeof body.cid === 'string' ? body.cid.trim() : ''
  if (!cid || !CID_REGEX.test(cid)) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'cid (string, valid CIDv0/CIDv1) is required' }))
    return
  }

  res.setHeader('Content-Type', 'application/json')

  try {
    // 1. Resolve CID → internal file id
    const lookup = await fetch(`${PINATA_FILE_BY_CID}${encodeURIComponent(cid)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${jwt}` },
    })
    if (lookup.status === 404) {
      // Not pinned (already removed, or never on this account). Treat as success.
      res.statusCode = 200
      res.end(JSON.stringify({ succeeded: true, reason: 'not_found' }))
      return
    }
    if (!lookup.ok) {
      const text = await lookup.text()
      res.statusCode = 200
      res.end(JSON.stringify({ succeeded: false, reason: `lookup_failed_${lookup.status}`, detail: text.slice(0, 200) }))
      return
    }
    const lookupJson = await lookup.json() as { data?: { files?: Array<{ id?: string }> } }
    const fileId = lookupJson.data?.files?.[0]?.id
    if (!fileId) {
      res.statusCode = 200
      res.end(JSON.stringify({ succeeded: true, reason: 'no_file_id_in_lookup' }))
      return
    }

    // 2. Delete by id
    const del = await fetch(`https://api.pinata.cloud/v3/files/public/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${jwt}` },
    })
    if (!del.ok && del.status !== 404) {
      const text = await del.text()
      res.statusCode = 200
      res.end(JSON.stringify({ succeeded: false, reason: `delete_failed_${del.status}`, detail: text.slice(0, 200) }))
      return
    }

    res.statusCode = 200
    res.end(JSON.stringify({ succeeded: true }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.statusCode = 200
    res.end(JSON.stringify({ succeeded: false, reason: 'exception', detail: message }))
  }
}
