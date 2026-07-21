/** IPFS storage helpers backed by short-lived Pinata upload URLs. */

import { CONTRACT_ADDRESSES } from '@/lib/contracts'
import { ACTIVE_CHAIN_ID, ACTIVE_NETWORK_NAME } from '@/lib/wagmi-config'

// Environment — gateway is read-only, no secret needed client-side
const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY as string | undefined

// Public gateways — Pinata's own gateway is first because it always has the content
// we just pinned. Other public gateways may time-out if propagation is slow.
const PUBLIC_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs',
  'https://ipfs.io/ipfs',
  'https://w3s.link/ipfs',
  'https://dweb.link/ipfs',
]

// ============ Types ============

export interface UploadResult {
  cid: string
  ipfsUri: string
  gatewayUrl: string
}

// ============ Configuration Check ============

export function isConfigured(): boolean {
  // Server-side API routes handle the Pinata JWT — always available when deployed
  return true
}

// ============ Gateway URL ============

/**
 * Convert CID to gateway URL.
 * Prefers the user's dedicated Pinata gateway if VITE_PINATA_GATEWAY is set —
 * dedicated gateways are private and always respond immediately for pinned content.
 */
function pinataGatewayBase(): string | null {
  if (!PINATA_GATEWAY) return null
  const g = PINATA_GATEWAY.trim().replace(/\/$/, '')
  return g.startsWith('http') ? g : `https://${g}`
}

export function toGatewayUrl(cid: string): string {
  const base = pinataGatewayBase()
  if (base) return `${base}/ipfs/${cid}`
  return `${PUBLIC_GATEWAYS[0]}/${cid}`
}

export async function fetchFromIPFS(cid: string, timeoutMs = 8000): Promise<Response> {
  const base = pinataGatewayBase()
  const urls = base
    ? [`${base}/ipfs/${cid}`, ...PUBLIC_GATEWAYS.map(g => `${g}/${cid}`)]
    : PUBLIC_GATEWAYS.map(g => `${g}/${cid}`)

  const res = await Promise.any(
    urls.map(async (url) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const r = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)
      if (!r.ok) throw new Error(`${url}: ${r.status}`)
      return r
    })
  )
  return res
}

/**
 * Convert ipfs:// URI to gateway URL
 */
export function ipfsToHttp(uri: string): string {
  if (!uri) return ''
  if (!uri.startsWith('ipfs://')) return uri

  const cid = uri.replace('ipfs://', '').replace('ipfs/', '')
  return toGatewayUrl(cid)
}

// ============ Pin JSON ============

/**
 * Pin JSON object to IPFS via server-side API route
 */
export async function pinJson(data: object, name?: string): Promise<UploadResult> {
  const response = await fetch('/api/upload-ipfs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metadata: data, name: name || 'metadata.json' }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to pin JSON: ${error}`)
  }

  const result: UploadResult = await response.json()

  return {
    cid: result.cid,
    ipfsUri: result.ipfsUri,
    gatewayUrl: toGatewayUrl(result.cid),
  }
}

// ============ Pin File ============

export type UploadPurpose = 'standard' | 'encrypted-private-content'

export async function getSignedUploadUrl(
  file: { type: string; size: number; name?: string },
  purpose: UploadPurpose = 'standard',
): Promise<string> {
  const signRes = await fetch('/api/pinata-sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mimeType: file.type,
      fileSize: file.size,
      filename: file.name,
      purpose,
    }),
  })
  if (!signRes.ok) {
    const err = await signRes.json().catch(() => ({ error: signRes.statusText })) as { error: string }
    throw new Error(err.error || `Sign request failed: ${signRes.status}`)
  }
  const { url } = await signRes.json() as { url: string }
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'uploads.pinata.cloud') {
    throw new Error('Sign endpoint returned an unexpected upload URL')
  }
  return url
}

export async function pinFile(
  file: File,
  name?: string,
  prefetchedUrl?: string,
  purpose: UploadPurpose = 'standard',
): Promise<UploadResult> {
  // Step 1: get a short-lived signed URL from our server (PINATA_JWT stays server-side),
  // or use a pre-fetched URL obtained earlier during file selection.
  const url = prefetchedUrl ?? await getSignedUploadUrl(file, purpose)

  // Step 2: upload directly from browser to Pinata — file never touches our server
  const formData = new FormData()
  formData.append('file', file, name || file.name)
  const uploadRes = await fetch(url, { method: 'POST', body: formData })
  if (!uploadRes.ok) {
    const errText = await uploadRes.text()
    throw new Error(`Pinata upload failed (${uploadRes.status}): ${errText}`)
  }
  const result = await uploadRes.json() as { data?: { cid?: string } }
  const cid = result?.data?.cid
  if (!cid || typeof cid !== 'string') {
    throw new Error('Pinata returned unexpected upload response shape (missing data.cid)')
  }
  return { cid, ipfsUri: `ipfs://${cid}`, gatewayUrl: toGatewayUrl(cid) }
}

// Best-effort cleanup for uploads orphaned by a failed or cancelled transaction.

export async function unpinFile(cid: string): Promise<{ succeeded: boolean }> {
  try {
    const res = await fetch('/api/pinata-unpin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cid }),
    })
    if (!res.ok) return { succeeded: false }
    const data = await res.json() as { succeeded?: boolean }
    return { succeeded: !!data.succeeded }
  } catch {
    return { succeeded: false }
  }
}

// ============ Ownership Legal Block ============

export function buildOwnershipLegal(creator: string): Record<string, unknown> {
  const ts = Math.floor(Date.now() / 1000)
  return {
    ownership_clause: `This intellectual property asset is registered on-chain by ${creator}. The blockchain record constitutes a timestamped, immutable proof of authorship and ownership claim under applicable intellectual property law, including the Berne Convention for the Protection of Literary and Artistic Works (1886, as amended), the WIPO Copyright Treaty (1996), and the TRIPS Agreement (1994, Articles 9-14). This blockchain registration does not constitute formal copyright registration with any national intellectual property office (such as the USPTO, EUIPO, WIPO, IMPI, or INDAUTOR), but provides cryptographic evidence of priority and provenance admissible as prima facie evidence in legal proceedings under the Berne Convention (181 member states), WIPO Copyright Treaty, and applicable national copyright laws. On-chain contract: ${CONTRACT_ADDRESSES.IPAsset}. Network: ${ACTIVE_NETWORK_NAME} (chain ID ${ACTIVE_CHAIN_ID}).`,
    registration_timestamp: ts,
    registration_date: new Date(ts * 1000).toISOString(),
    chain_id: ACTIVE_CHAIN_ID,
    ip_contract: CONTRACT_ADDRESSES.IPAsset,
    platform: 'Soft.Law',
    jurisdiction: 'International (Berne Convention, WIPO Copyright Treaty, TRIPS Agreement)',
  }
}

// ============ IP Metadata Types ============

export interface IPMetadata {
  name: string
  description: string
  workType: string
  creator: string
  creationDate?: string
  copyrightDeclaration: boolean
  coAuthors?: Array<{ address: string; sharePct: number }>
  jurisdiction?: string
  derivativeOf?: { tokenId: string; contractAddress: string } | null
  contentHash?: string
  originalMedium?: string
  language?: string
  additionalNotes?: string
  externalUrl?: string
  /** Public registry envelope; confidential content is encrypted separately. */
  visibility?: 'public' | 'confidential'
}

// ============ NFT Metadata Upload ============

/** Upload media, build its metadata envelope, and return the metadata URI. */
export async function uploadNFT(
  image: File | null,
  metadata: IPMetadata,
  prefetchedUrl?: string,
): Promise<{
  metadataUri: string
  metadataCid: string
  imageCid: string | null
  imageUrl: string | null
}> {
  let imageCid: string | null = null
  let imageUrl: string | null = null

  // Determine which OpenSea metadata field to populate based on work type
  const fileConfig = WORK_TYPE_FILE_CONFIG[metadata.workType]
  const mediaField = fileConfig?.metadataField ?? 'image'

  // Step 1: Upload content file if provided
  if (image) {
    const imageResult = await pinFile(image, `${metadata.name}-file`, prefetchedUrl)
    imageCid = imageResult.cid
    imageUrl = imageResult.gatewayUrl
  }

  // Step 2: Build attributes array (OpenSea compatible)
  const attributes: Array<{ trait_type: string; value: string }> = [
    { trait_type: 'Work Type', value: metadata.workType },
    { trait_type: 'Creator', value: metadata.creator },
    { trait_type: 'Registration Date', value: new Date().toISOString() },
    { trait_type: 'Copyright Declaration', value: String(metadata.copyrightDeclaration) },
    { trait_type: 'Platform', value: 'SoftLaw' },
    { trait_type: 'Registry', value: 'Polkadot Hub' },
    { trait_type: 'Content Visibility', value: metadata.visibility ?? 'public' },
  ]

  if (metadata.creationDate) {
    attributes.push({ trait_type: 'Creation Date', value: metadata.creationDate })
  }
  if (metadata.jurisdiction) {
    attributes.push({ trait_type: 'Jurisdiction', value: metadata.jurisdiction })
  }
  if (metadata.contentHash) {
    attributes.push({ trait_type: 'Content Hash', value: metadata.contentHash })
  }
  if (metadata.derivativeOf) {
    attributes.push({ trait_type: 'Derivative Of', value: `Token #${metadata.derivativeOf.tokenId}` })
  }
  if (metadata.coAuthors && metadata.coAuthors.length > 0) {
    attributes.push({ trait_type: 'Co-Authors', value: String(metadata.coAuthors.length) })
  }

  // Step 3: Build structured registration object
  const registration: Record<string, unknown> = {
    work_type: metadata.workType,
    creation_date: metadata.creationDate || null,
    copyright_declaration: metadata.copyrightDeclaration,
    co_authors: metadata.coAuthors && metadata.coAuthors.length > 0 ? metadata.coAuthors : null,
    jurisdiction: metadata.jurisdiction || null,
    derivative_of: metadata.derivativeOf || null,
    content_hash: metadata.contentHash ? `sha256:${metadata.contentHash}` : null,
    content_visibility: metadata.visibility ?? 'public',
    blockchain_proof: {
      chain_id: ACTIVE_CHAIN_ID,
      contract: CONTRACT_ADDRESSES.IPAsset,
    },
  }
  if (metadata.additionalNotes) {
    registration.additional_notes = metadata.additionalNotes.slice(0, 500)
  }
  if (metadata.language) {
    registration.language = metadata.language
  }

  // Step 4: Create NFT metadata (OpenSea-compatible field routing by work type)
  const contentUri = imageCid ? `ipfs://${imageCid}` : ''
  const nftMetadata: Record<string, unknown> = {
    name: metadata.name,
    description: metadata.description,
    image: mediaField === 'image' ? contentUri : '',
    external_url: mediaField === 'external_url' && contentUri ? contentUri : (metadata.externalUrl || 'https://soft.law'),
    attributes,
    registration,
    legal: buildOwnershipLegal(metadata.creator),
  }
  if (mediaField === 'animation_url' && contentUri) {
    nftMetadata.animation_url = contentUri
  }

  // Step 5: Upload metadata
  const metadataResult = await pinJson(nftMetadata, `${metadata.name}-metadata`)

  return {
    metadataUri: metadataResult.ipfsUri,
    metadataCid: metadataResult.cid,
    imageCid,
    imageUrl,
  }
}

// ============ Work Type File Configuration ============

export interface WorkTypeFileConfig {
  accept: string
  mimeTypes: string[]
  maxBytes: number
  /** OpenSea/EIP-4906 metadata field where the content URI is stored */
  metadataField: 'image' | 'animation_url' | 'external_url'
  label: string
}

export const WORK_TYPE_FILE_CONFIG: Record<string, WorkTypeFileConfig> = {
  artistic: {
    accept: 'image/jpeg,image/png,image/gif,image/webp,image/avif,image/svg+xml,image/tiff',
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml', 'image/tiff'],
    maxBytes: 10 * 1024 * 1024,
    metadataField: 'image',
    label: 'Upload artwork',
  },
  musical: {
    accept: 'audio/mpeg,audio/wav,audio/flac,audio/ogg,audio/aac,audio/mp4,audio/x-m4a',
    mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/ogg', 'audio/aac', 'audio/mp4', 'audio/x-m4a'],
    maxBytes: 100 * 1024 * 1024,
    metadataField: 'animation_url',
    label: 'Upload audio file',
  },
  audiovisual: {
    accept: 'video/mp4,video/webm,video/quicktime,video/x-msvideo',
    mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
    maxBytes: 500 * 1024 * 1024,
    metadataField: 'animation_url',
    label: 'Upload video file',
  },
  literary: {
    accept: 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown',
    mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'],
    maxBytes: 50 * 1024 * 1024,
    metadataField: 'external_url',
    label: 'Upload document',
  },
  dramatic: {
    accept: 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain',
    mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
    maxBytes: 50 * 1024 * 1024,
    metadataField: 'external_url',
    label: 'Upload script',
  },
  software: {
    accept: 'application/zip,application/x-tar,application/gzip,application/x-7z-compressed',
    mimeTypes: ['application/zip', 'application/x-tar', 'application/gzip', 'application/x-7z-compressed'],
    maxBytes: 100 * 1024 * 1024,
    metadataField: 'external_url',
    label: 'Upload archive',
  },
}

// ============ Utility ============

/**
 * Format file size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Validate file against work-type rules.
 * Pass `workType` to automatically apply the correct allowlist and max size.
 * `allowedTypes` and `maxSize` override the config when provided explicitly.
 */
export function validateFile(
  file: File,
  options: { maxSize?: number; allowedTypes?: string[]; workType?: string } = {}
): { valid: boolean; error?: string } {
  const fileConfig = options.workType ? WORK_TYPE_FILE_CONFIG[options.workType] : null
  const maxSize = options.maxSize ?? fileConfig?.maxBytes ?? 10 * 1024 * 1024
  const allowedTypes = options.allowedTypes ?? fileConfig?.mimeTypes ?? ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']

  if (file.size > maxSize) {
    return { valid: false, error: `File too large. Max: ${formatBytes(maxSize)}` }
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `Invalid file type: ${file.type}` }
  }

  return { valid: true }
}
