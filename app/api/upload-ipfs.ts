import type { IncomingMessage, ServerResponse } from 'http'
import { setCors } from './_lib/cors-helper.js'
import { rateLimit } from './_lib/rate-limit.js'

const PINATA_UPLOAD = 'https://uploads.pinata.cloud/v3/files'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (setCors(req, res)) return
  if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return }
  if (rateLimit(req, res, { max: 10, windowMs: 60_000 })) return

  const jwt = process.env.PINATA_JWT
  if (!jwt) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'PINATA_JWT not configured on server' }))
    return
  }

  try {
    const body = await readBody(req)
    const { metadata, name } = body

    if (!metadata || typeof metadata !== 'object') {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'metadata object is required' }))
      return
    }

    const fileName = (name as string) || 'metadata.json'
    const jsonBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' })

    const formData = new FormData()
    formData.append('file', jsonBlob, fileName)
    formData.append('network', 'public')

    const response = await fetch(PINATA_UPLOAD, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.text()
      res.statusCode = response.status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: `Pinata error: ${error}` }))
      return
    }

    const result = await response.json() as { data: { cid: string } }
    const cid = result.data.cid

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      cid,
      ipfsUri: `ipfs://${cid}`,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
    }))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: message }))
  }
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: Buffer) => { data += chunk })
    req.on('end', () => { try { resolve(JSON.parse(data)) } catch { reject(new Error('Invalid JSON')) } })
    req.on('error', reject)
  })
}
