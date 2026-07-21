/** React state and cleanup for IPFS upload flows. */

import { useState, useCallback, useRef } from 'react'
import {
  uploadNFT,
  pinFile,
  pinJson,
  unpinFile,
  isConfigured,
  validateFile,
  toGatewayUrl,
  ipfsToHttp,
  getSignedUploadUrl,
  type IPMetadata,
} from '@/lib/ipfs-storage'

// ============ Types ============

interface UploadState {
  isUploading: boolean
  step: 'idle' | 'uploading-image' | 'uploading-metadata' | 'complete' | 'error'
  error: string | null
}

interface NFTUploadResult {
  metadataUri: string
  metadataCid: string
  imageCid: string | null
  imageUrl: string | null
}

// ============ Main Hook ============

export function useIPFSUpload() {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    step: 'idle',
    error: null,
  })
  const [result, setResult] = useState<NFTUploadResult | null>(null)
  // Tracks every CID pinned during the last upload() call so the caller can
  // unpin them via cleanupOnError() if the subsequent on-chain tx fails or is
  // cancelled. Lives in a ref so reset()/cleanup() don't trigger re-renders.
  const pinnedCidsRef = useRef<string[]>([])
  // Pre-fetched signed upload URL — obtained at file-selection time so the
  // Vercel cold-start round-trip is off the critical submit path.
  const prefetchedUrlRef = useRef<string | null>(null)

  const upload = useCallback(
    async (
      image: File | null,
      metadata: IPMetadata
    ): Promise<NFTUploadResult> => {
      // Check configuration
      if (!isConfigured()) {
        throw new Error('IPFS not configured. Set PINATA_JWT in Vercel environment variables.')
      }

      // Validate file against work-type rules
      if (image) {
        const validation = validateFile(image, { workType: metadata.workType })
        if (!validation.valid) {
          throw new Error(validation.error)
        }
      }

      setState({
        isUploading: true,
        step: image ? 'uploading-image' : 'uploading-metadata',
        error: null,
      })

      // Reset the pin ledger for this attempt — a fresh upload() shouldn't
      // inherit CIDs from a previous one.
      pinnedCidsRef.current = []

      try {
        const uploadResult = await uploadNFT(image, metadata, prefetchedUrlRef.current ?? undefined)
        prefetchedUrlRef.current = null

        // Track every CID we just pinned so cleanupOnError() can reverse them.
        if (uploadResult.imageCid) pinnedCidsRef.current.push(uploadResult.imageCid)
        if (uploadResult.metadataCid) pinnedCidsRef.current.push(uploadResult.metadataCid)

        setState({
          isUploading: false,
          step: 'complete',
          error: null,
        })

        setResult(uploadResult)
        return uploadResult
      } catch (err) {
        prefetchedUrlRef.current = null
        const error = err instanceof Error ? err.message : 'Upload failed'
        setState({
          isUploading: false,
          step: 'error',
          error,
        })
        throw err
      }
    },
    []
  )

  const prefetchUrl = useCallback(async (file: File) => {
    try {
      const url = await getSignedUploadUrl(file)
      prefetchedUrlRef.current = url
    } catch {
      prefetchedUrlRef.current = null
    }
  }, [])

  const clearPrefetchedUrl = useCallback(() => {
    prefetchedUrlRef.current = null
  }, [])

  /**
   * Best-effort unpin every CID pinned by the most recent upload() call.
   * Call this in the catch block of the on-chain tx that consumes the URI.
   * Failures are swallowed — orphaned pins are a cost issue, not correctness.
   */
  const cleanupOnError = useCallback(async () => {
    const cids = pinnedCidsRef.current
    pinnedCidsRef.current = []
    if (cids.length === 0) return
    await Promise.allSettled(cids.map((cid) => unpinFile(cid)))
  }, [])

  const reset = useCallback(() => {
    setState({
      isUploading: false,
      step: 'idle',
      error: null,
    })
    setResult(null)
    pinnedCidsRef.current = []
    prefetchedUrlRef.current = null
  }, [])

  return {
    upload,
    prefetchUrl,
    clearPrefetchedUrl,
    cleanupOnError,
    reset,
    result,
    ...state,
    isConfigured: isConfigured(),
  }
}

// ============ Simple File Upload Hook ============

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    if (!isConfigured()) {
      throw new Error('IPFS not configured')
    }

    setIsUploading(true)
    setError(null)

    try {
      const result = await pinFile(file)
      setIsUploading(false)
      return result.cid
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setError(msg)
      setIsUploading(false)
      throw err
    }
  }, [])

  const uploadJson = useCallback(async (data: object): Promise<string> => {
    if (!isConfigured()) {
      throw new Error('IPFS not configured')
    }

    setIsUploading(true)
    setError(null)

    try {
      const result = await pinJson(data)
      setIsUploading(false)
      return result.cid
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setError(msg)
      setIsUploading(false)
      throw err
    }
  }, [])

  return {
    uploadFile,
    uploadJson,
    isUploading,
    error,
  }
}

// Re-export utilities
export { isConfigured, toGatewayUrl, ipfsToHttp, validateFile }
