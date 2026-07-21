import type { IncomingMessage, ServerResponse } from 'http'
import { setCors } from './_lib/cors-helper.js'
import { rateLimit } from './_lib/rate-limit.js'

const PINATA_SIGN_URL = 'https://uploads.pinata.cloud/v3/files/sign'
// 900s: worst-case 500 MB file at 5 Mbps uplink (~800 s transfer time)
const EXPIRES_SECONDS = 900

// Pinata applies max_file_size to the multipart request, not only the raw file.
// The signed URL therefore includes framing headroom while validateSignRequest
// continues to enforce the actual content-policy limit.
export const SIGNED_UPLOAD_TRANSPORT_ALLOWANCE_BYTES = 1024 * 1024

/** Bytes the presigned URL will permit for a given raw content size. */
export function signedUploadMaxFileSize(fileSize: number): number {
  return fileSize + SIGNED_UPLOAD_TRANSPORT_ALLOWANCE_BYTES
}

/** Human-readable, binary-prefixed size (KiB/MiB) with useful precision. */
export function formatByteLimit(bytes: number): string {
  const KIB = 1024
  const MIB = KIB * 1024
  if (bytes < MIB) return `${Math.round(bytes / KIB)} KiB`
  const mib = bytes / MIB
  return Number.isInteger(mib) ? `${mib} MiB` : `${mib.toFixed(1)} MiB`
}

export type UploadPurpose = 'standard' | 'encrypted-private-content'

// Pinata may sniff the encrypted base64 envelope as text/plain.
export function signedUploadAllowedMimeTypes(
  mimeType: string,
  purpose: UploadPurpose,
): string[] {
  return purpose === 'encrypted-private-content'
    ? [mimeType, 'text/plain']
    : [mimeType]
}

// Transport ceiling for the base64-wrapped AES-GCM payload.
export const MAX_ENCRYPTED_PRIVATE_CONTENT_BYTES = 70 * 1024 * 1024

export const MIME_MAX_BYTES: Record<string, number> = {
  // Images — 10 MB
  'image/jpeg': 10 * 1024 * 1024,  'image/png': 10 * 1024 * 1024,
  'image/gif': 10 * 1024 * 1024,   'image/webp': 10 * 1024 * 1024,
  'image/avif': 10 * 1024 * 1024,  'image/svg+xml': 10 * 1024 * 1024,
  'image/tiff': 10 * 1024 * 1024,
  // Audio — 100 MB
  'audio/mpeg': 100 * 1024 * 1024, 'audio/wav': 100 * 1024 * 1024,
  'audio/flac': 100 * 1024 * 1024, 'audio/ogg': 100 * 1024 * 1024,
  'audio/aac': 100 * 1024 * 1024,  'audio/mp4': 100 * 1024 * 1024,
  'audio/x-m4a': 100 * 1024 * 1024,
  // Video — 500 MB (Pinata CDN handles large-file chunking internally)
  'video/mp4': 500 * 1024 * 1024,       'video/webm': 500 * 1024 * 1024,
  'video/quicktime': 500 * 1024 * 1024, 'video/x-msvideo': 500 * 1024 * 1024,
  // Documents — 50 MB
  'application/pdf': 50 * 1024 * 1024,
  'application/msword': 50 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 50 * 1024 * 1024,
  'text/plain': 20 * 1024 * 1024,
  'text/markdown': 20 * 1024 * 1024,
  // Archives — 100 MB
  'application/zip': 100 * 1024 * 1024,
  'application/x-tar': 100 * 1024 * 1024,
  'application/gzip': 100 * 1024 * 1024,
  'application/x-7z-compressed': 100 * 1024 * 1024,
  // Source code — 512 KB
  'text/x-solidity': 512 * 1024,
  'application/octet-stream': 512 * 1024,
}

const ALLOWED = new Set(Object.keys(MIME_MAX_BYTES))

export function validateSignRequest(
  mimeType: string,
  fileSize: number,
  purpose: UploadPurpose = 'standard',
): { valid: boolean; error?: string; maxBytes?: number } {
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
    return { valid: false, error: 'fileSize must be a positive safe integer' }
  }
  if (purpose === 'encrypted-private-content') {
    if (mimeType !== 'application/octet-stream') {
      return { valid: false, error: 'Encrypted private content must use application/octet-stream' }
    }
    if (fileSize > MAX_ENCRYPTED_PRIVATE_CONTENT_BYTES) {
      return {
        valid: false,
        error: `Encrypted private content is too large. Max encrypted payload: ${formatByteLimit(MAX_ENCRYPTED_PRIVATE_CONTENT_BYTES)}`,
      }
    }
    return { valid: true, maxBytes: MAX_ENCRYPTED_PRIVATE_CONTENT_BYTES }
  }
  if (!ALLOWED.has(mimeType)) {
    return { valid: false, error: `File type not supported: ${mimeType}` }
  }
  const maxBytes = MIME_MAX_BYTES[mimeType]!
  if (fileSize > maxBytes) {
    return {
      valid: false,
      error: `File too large for ${mimeType}. Max: ${formatByteLimit(maxBytes)}`,
    }
  }
  return { valid: true, maxBytes }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (setCors(req, res)) return
  if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return }
  // Each request consumes a Pinata signing operation.
  if (rateLimit(req, res, { max: 10, windowMs: 60_000 })) return

  const jwt = process.env.PINATA_JWT
  if (!jwt) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'PINATA_JWT not configured' }))
    return
  }

  // Read and parse the small JSON request body (<200 bytes)
  let body: { mimeType?: unknown; fileSize?: unknown; purpose?: unknown; filename?: unknown }
  try {
    const raw = await new Promise<string>((resolve, reject) => {
      let data = ''
      req.on('data', (chunk: Buffer) => { data += chunk.toString() })
      req.on('error', reject)
      req.on('end', () => resolve(data))
    })
    body = JSON.parse(raw) as typeof body
  } catch {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Invalid JSON body' }))
    return
  }

  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : ''
  const fileSize = typeof body.fileSize === 'number' ? body.fileSize : -1
  const purpose: UploadPurpose = body.purpose === 'encrypted-private-content'
    ? 'encrypted-private-content'
    : 'standard'
  const filename = typeof body.filename === 'string'
    ? Array.from(body.filename.trim(), character => {
        const code = character.charCodeAt(0)
        return character === '/' || character === '\\' || code < 32 || code === 127
          ? '_'
          : character
      }).join('').slice(0, 180)
    : ''

  if (body.purpose !== undefined && body.purpose !== 'standard' && body.purpose !== 'encrypted-private-content') {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Unknown upload purpose' }))
    return
  }

  if (!mimeType || !Number.isSafeInteger(fileSize) || fileSize <= 0) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'mimeType (string) and fileSize (positive safe integer) are required' }))
    return
  }

  const validation = validateSignRequest(mimeType, fileSize, purpose)
  if (!validation.valid) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: validation.error }))
    return
  }

  try {
    const pinataRes = await fetch(PINATA_SIGN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        network: 'public',
        date: Math.floor(Date.now() / 1000),
        expires: EXPIRES_SECONDS,
        allow_mime_types: signedUploadAllowedMimeTypes(mimeType, purpose),
        // Scope the URL to this payload (not the whole category limit). The
        // transport allowance is mandatory — see SIGNED_UPLOAD_TRANSPORT_ALLOWANCE_BYTES.
        max_file_size: signedUploadMaxFileSize(fileSize),
        ...(filename ? { filename } : {}),
        keyvalues: { softlaw_upload_purpose: purpose },
      }),
    })

    if (!pinataRes.ok) {
      const err = await pinataRes.text()
      res.statusCode = pinataRes.status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: `Pinata sign error: ${err}` }))
      return
    }

    // Pinata returns the signed URL as { data: "<url string>" }
    const { data: url } = await pinataRes.json() as { data: string }
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      throw new Error('Pinata returned an invalid signed upload URL')
    }
    if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'uploads.pinata.cloud') {
      throw new Error('Pinata returned an unexpected signed upload origin')
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ url }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: message }))
  }
}
