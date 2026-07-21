import { useState, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { signTypedData } from '@wagmi/core'
import { generateAesKey, exportKey, importKey, encryptContent, decryptContent } from '@/lib/crypto'
import { fetchFromIPFS, pinFile } from '@/lib/ipfs-storage'
import type { UploadResult } from '@/lib/ipfs-storage'
import { CONTRACT_ADDRESSES } from '@/lib/contracts'
import { POLKADOT_HUB_CHAIN_ID, wagmiConfig } from '@/lib/wagmi-config'
import { INDEXER_URL } from '@/lib/indexer'
import type { PrivateContentSubject } from '@/lib/private-content-domain'

const EIP712_DOMAIN = {
  name: 'Soft.Law',
  version: '1',
  chainId: POLKADOT_HUB_CHAIN_ID,
  verifyingContract: CONTRACT_ADDRESSES.LicenseToken,
} as const

const EIP712_TYPES = {
  AccessRequest: [
    { name: 'licenseId', type: 'uint256' },
    { name: 'nonce',     type: 'bytes32' },
    { name: 'deadline',  type: 'uint256' },
    { name: 'action',    type: 'string' },
  ],
}

export type PrivateContentProvider = {
  request: (args: { method: string; params: unknown[] }) => Promise<unknown>
}

/**
 * Account-bound EIP-712 provider used by production private-content flows.
 * Calling connector.getProvider() directly can select a different injected or
 * embedded wallet when multiple EIP-1193 providers coexist. Wagmi resolves the
 * active connection and verifies the requested account before signing.
 */
export function privateContentSignerForAccount(address: `0x${string}`): PrivateContentProvider {
  return {
    async request({ method, params }) {
      if (method !== 'eth_signTypedData_v4' || typeof params[1] !== 'string') {
        throw new Error('Unsupported private-content signing request')
      }
      const typedData = JSON.parse(params[1]) as {
        domain: Record<string, unknown>
        types: Record<string, readonly { name: string; type: string }[]>
        primaryType: string
        message: Record<string, unknown>
      }
      return signTypedData(wagmiConfig, {
        account: address,
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message: typedData.message,
      })
    },
  }
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

type UploadFile = (
  file: File,
  name?: string,
  prefetchedUrl?: string,
  purpose?: 'standard' | 'encrypted-private-content',
) => Promise<UploadResult>

export async function uploadEncryptedPrivateContent(
  file: File,
  uploadFile: UploadFile = pinFile,
): Promise<{ cid: string; aesKeyB64: string }> {
  const arrayBuffer = await file.arrayBuffer()
  const key = await generateAesKey()
  const { ciphertextB64, ivB64 } = await encryptContent(new Uint8Array(arrayBuffer), key)
  const packed = JSON.stringify({ iv: ivB64, ct: ciphertextB64 })
  const encryptedFile = new File([packed], `${file.name}.enc`, {
    type: 'application/octet-stream',
  })
  const payload = await uploadFile(
    encryptedFile,
    encryptedFile.name,
    undefined,
    'encrypted-private-content',
  )
  if (typeof payload.cid !== 'string' || payload.cid.length === 0) {
    throw new Error('Upload failed: response did not contain a CID')
  }
  return { cid: payload.cid, aesKeyB64: await exportKey(key) }
}

async function signAccessRequest(
  provider: PrivateContentProvider,
  address: string,
  licenseId: number,
  nonce: string,
  deadline: number,
  action: string,
): Promise<string> {
  const typedData = {
    domain: EIP712_DOMAIN,
    types: { AccessRequest: EIP712_TYPES.AccessRequest },
    primaryType: 'AccessRequest',
    message: {
      licenseId: String(licenseId),
      nonce,
      deadline: String(deadline),
      action,
    },
  }
  return provider.request({
    method: 'eth_signTypedData_v4',
    params: [address, JSON.stringify(typedData)],
  }) as Promise<string>
}

// ============ Hook 1: usePrivateContentUpload ============

export function usePrivateContentUpload(licenseId: number) {
  const { address } = useAccount()

  const [isEncrypting, setIsEncrypting] = useState(false)
  const [isStoring, setIsStoring] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const uploadEncrypted = useCallback(
    async (file: File): Promise<{ cid: string; aesKeyB64: string }> => {
      setError(null)
      setIsEncrypting(true)
      try {
        return await uploadEncryptedPrivateContent(file)
      } catch (e) {
        setError(e as Error)
        throw e
      } finally {
        setIsEncrypting(false)
      }
    },
    [],
  )

  const storeKey = useCallback(
    async (aesKeyB64: string, cid: string): Promise<void> => {
      if (!address) throw new Error('No wallet connected')
      setError(null)
      setIsStoring(true)
      try {
        const provider = privateContentSignerForAccount(address)
        await storePrivateContentKey({
          subject: { kind: 'license', id: licenseId },
          address,
          provider,
          aesKeyB64,
          cid,
        })
      } catch (e) {
        setError(e as Error)
        throw e
      } finally {
        setIsStoring(false)
      }
    },
    [address, licenseId],
  )

  return { uploadEncrypted, storeKey, isEncrypting, isStoring, error }
}

// Asset uploads use AssetAccessRequest and the IPAsset authorization rules.
// Storage is owner-only; decryption also supports explicit grants, admins,
// and active license holders.

const ASSET_EIP712_DOMAIN = {
  name: 'Soft.Law',
  version: '1',
  chainId: POLKADOT_HUB_CHAIN_ID,
  verifyingContract: CONTRACT_ADDRESSES.IPAsset,
} as const

const ASSET_EIP712_TYPES = {
  AssetAccessRequest: [
    { name: 'tokenId',  type: 'uint256' },
    { name: 'nonce',    type: 'bytes32' },
    { name: 'deadline', type: 'uint256' },
    { name: 'action',   type: 'string' },
  ],
}

async function signAssetAccessRequest(
  provider: PrivateContentProvider,
  address: string,
  tokenId: number,
  nonce: string,
  deadline: number,
  action: string,
): Promise<string> {
  const typedData = {
    domain: ASSET_EIP712_DOMAIN,
    types: { AssetAccessRequest: ASSET_EIP712_TYPES.AssetAccessRequest },
    primaryType: 'AssetAccessRequest',
    message: {
      tokenId: String(tokenId),
      nonce,
      deadline: String(deadline),
      action,
    },
  }
  return provider.request({
    method: 'eth_signTypedData_v4',
    params: [address, JSON.stringify(typedData)],
  }) as Promise<string>
}

export async function storePrivateContentKey(args: {
  subject: PrivateContentSubject
  address: string
  provider: PrivateContentProvider
  aesKeyB64: string
  cid: string
  indexerUrl?: string
  fetchFn?: FetchLike
}): Promise<void> {
  const { subject, address, provider, aesKeyB64, cid } = args
  const fetchFn = args.fetchFn ?? fetch
  const indexerUrl = (args.indexerUrl ?? INDEXER_URL).replace(/\/$/, '')
  const isAsset = subject.kind === 'asset'
  const base = `${indexerUrl}/api/content${isAsset ? '/asset' : ''}`
  const idKey = isAsset ? 'tokenId' : 'licenseId'
  const nonceUrl = new URL(`${base}/nonce`)
  nonceUrl.searchParams.set(idKey, String(subject.id))
  nonceUrl.searchParams.set('signer', address)
  nonceUrl.searchParams.set('action', 'store')

  const nonceRes = await fetchFn(nonceUrl.toString())
  if (!nonceRes.ok) throw new Error(`Nonce request failed: ${await nonceRes.text()}`)
  const noncePayload = await nonceRes.json() as { nonce?: unknown; deadline?: unknown }
  if (typeof noncePayload.nonce !== 'string' || typeof noncePayload.deadline !== 'number') {
    throw new Error('Nonce request failed: malformed response')
  }
  const { nonce, deadline } = noncePayload
  const sig = isAsset
    ? await signAssetAccessRequest(provider, address, subject.id, nonce, deadline, 'store')
    : await signAccessRequest(provider, address, subject.id, nonce, deadline, 'store')

  const storeRes = await fetchFn(`${base}/key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [idKey]: subject.id, aesKeyB64, nonce, deadline, sig, cid }),
  })
  if (!storeRes.ok) throw new Error(`Key store failed: ${await storeRes.text()}`)
}

export function usePrivateContentUploadForAsset(tokenId: number) {
  const { address } = useAccount()

  const [isEncrypting, setIsEncrypting] = useState(false)
  const [isStoring, setIsStoring] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const uploadEncrypted = useCallback(
    async (file: File): Promise<{ cid: string; aesKeyB64: string }> => {
      setError(null)
      setIsEncrypting(true)
      try {
        return await uploadEncryptedPrivateContent(file)
      } catch (e) {
        setError(e as Error)
        throw e
      } finally {
        setIsEncrypting(false)
      }
    },
    [],
  )

  const storeKey = useCallback(
    async (aesKeyB64: string, cid: string): Promise<void> => {
      if (!address) throw new Error('No wallet connected')
      setError(null)
      setIsStoring(true)
      try {
        const provider = privateContentSignerForAccount(address)
        await storePrivateContentKey({
          subject: { kind: 'asset', id: tokenId },
          address,
          provider,
          aesKeyB64,
          cid,
        })
      } catch (e) {
        setError(e as Error)
        throw e
      } finally {
        setIsStoring(false)
      }
    },
    [address, tokenId],
  )

  return { uploadEncrypted, storeKey, isEncrypting, isStoring, error }
}

// ============ Hook 1c: usePrivateContentDecryptForAsset ============

export function usePrivateContentDecryptForAsset() {
  const { address } = useAccount()

  const [isDecrypting, setIsDecrypting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const decrypt = useCallback(
    async (tokenId: number, cid: string): Promise<Uint8Array> => {
      if (!address) throw new Error('No wallet connected')
      setError(null)
      setIsDecrypting(true)
      try {
        const nonceRes = await fetch(
          `${INDEXER_URL}/api/content/asset/nonce?tokenId=${tokenId}&signer=${address}&action=decrypt`,
        )
        if (!nonceRes.ok) throw new Error(`Nonce request failed: ${await nonceRes.text()}`)
        const { nonce, deadline } = (await nonceRes.json()) as { nonce: string; deadline: number }

        const provider = privateContentSignerForAccount(address)
        const sig = await signAssetAccessRequest(provider, address, tokenId, nonce, deadline, 'decrypt')

        const keyRes = await fetch(`${INDEXER_URL}/api/content/asset/decrypt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokenId, nonce, deadline, sig }),
        })
        if (!keyRes.ok) throw new Error(`Decrypt key fetch failed: ${await keyRes.text()}`)
        const { aesKeyB64 } = (await keyRes.json()) as { aesKeyB64: string }

        const ipfsRes = await fetchFromIPFS(cid)
        let packed: { iv: string; ct: string }
        try {
          packed = await ipfsRes.json() as { iv: string; ct: string }
        } catch {
          throw new Error('Failed to parse encrypted content from IPFS — CID may point to wrong content')
        }

        const key = await importKey(aesKeyB64)
        return await decryptContent(packed.ct, packed.iv, key)
      } catch (e) {
        setError(e as Error)
        throw e
      } finally {
        setIsDecrypting(false)
      }
    },
    [address],
  )

  return { decrypt, isDecrypting, error }
}

// ============ Hook 2: usePrivateContentDecrypt ============

export function usePrivateContentDecrypt() {
  const { address } = useAccount()

  const [isDecrypting, setIsDecrypting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const decrypt = useCallback(
    async (licenseId: number, cid: string): Promise<Uint8Array> => {
      if (!address) throw new Error('No wallet connected')
      setError(null)
      setIsDecrypting(true)
      try {
        const nonceRes = await fetch(
          `${INDEXER_URL}/api/content/nonce?licenseId=${licenseId}&signer=${address}&action=decrypt`,
        )
        if (!nonceRes.ok) throw new Error(`Nonce request failed: ${await nonceRes.text()}`)
        const { nonce, deadline } = (await nonceRes.json()) as { nonce: string; deadline: number }

        const provider = privateContentSignerForAccount(address)
        const sig = await signAccessRequest(provider, address, licenseId, nonce, deadline, 'decrypt')

        const keyRes = await fetch(`${INDEXER_URL}/api/content/decrypt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ licenseId, nonce, deadline, sig }),
        })
        if (!keyRes.ok) throw new Error(`Decrypt key fetch failed: ${await keyRes.text()}`)
        const { aesKeyB64 } = (await keyRes.json()) as { aesKeyB64: string }

        const ipfsRes = await fetchFromIPFS(cid)
        let packed: { iv: string; ct: string }
        try {
          packed = await ipfsRes.json() as { iv: string; ct: string }
        } catch {
          throw new Error('Failed to parse encrypted content from IPFS — CID may point to wrong content')
        }

        const key = await importKey(aesKeyB64)
        return await decryptContent(packed.ct, packed.iv, key)
      } catch (e) {
        setError(e as Error)
        throw e
      } finally {
        setIsDecrypting(false)
      }
    },
    [address],
  )

  return { decrypt, isDecrypting, error }
}
