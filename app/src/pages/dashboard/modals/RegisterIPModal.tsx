import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Plus, Package, CloudUpload, X, FileText, Image, Music, Film, Code, Drama, Trash2, ChevronDown, Check, ExternalLink, Globe2, Lock } from 'lucide-react'
import { decodeEventLog } from 'viem'
import type { ThemeColors } from '@/hooks/useTheme'
import { Button } from '@/components/Button'
import { toastError, useToastStore } from '@/hooks/useToast'
import type { TxStep } from '@/hooks/useToast'
import { useTxToast } from '@/hooks/useTxToast'
import { useMintIP, useWrapNFT } from '@/hooks/useContracts'
import type { UserIPAsset } from '@/hooks/useContracts'
import { useIPFSUpload, isConfigured as isIPFSConfigured } from '@/hooks/useIPFS'
import { buildOwnershipLegal, WORK_TYPE_FILE_CONFIG, formatBytes, unpinFile } from '@/lib/ipfs-storage'
import { isValidAddress, CONTRACT_ADDRESSES, ABIS, getTxUrl } from '@/lib/contracts'
import { useTranslations } from '@/lib/i18n'
import { ACTIVE_CHAIN_ID } from '@/lib/wagmi-config'
import { publicRegistryMedia, registrationFileLimit, type RegistryVisibility } from '@/lib/private-content-domain'
import { uploadEncryptedPrivateContent } from '@/hooks/usePrivateContent'
import { createPrivateContentRecovery, deletePrivateContentRecovery, updatePrivateContentRecovery } from '@/lib/private-content-recovery'
import {
  canSubmitPreparedRegistration,
  isWalletRejection,
  registrationDraftFingerprint,
  type RegistrationPreparationStatus,
} from '@/lib/registration-preparation'
import { Modal } from '../components/Modal'
import { PrivateContentUpload, type PreparedPrivateContent } from '../components/PrivateContentUpload'
import type { WorkType } from '../types'

const WORK_TYPE_ICONS: Record<WorkType, typeof FileText> = {
  literary: FileText,
  artistic: Image,
  musical: Music,
  audiovisual: Film,
  software: Code,
  dramatic: Drama,
}

const JURISDICTIONS = [
  { code: 'US', label: 'United States' },
  { code: 'MX', label: 'Mexico' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'ES', label: 'Spain' },
  { code: 'JP', label: 'Japan' },
  { code: 'KR', label: 'South Korea' },
  { code: 'CN', label: 'China' },
  { code: 'BR', label: 'Brazil' },
  { code: 'AR', label: 'Argentina' },
  { code: 'CO', label: 'Colombia' },
  { code: 'CL', label: 'Chile' },
  { code: 'IN', label: 'India' },
  { code: 'AU', label: 'Australia' },
  { code: 'CA', label: 'Canada' },
  { code: 'IT', label: 'Italy' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'CH', label: 'Switzerland' },
  { code: 'SG', label: 'Singapore' },
]

async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function createFallbackMetadataURI(metadata: { name: string; description: string; workType: string; creator: string; copyrightDeclaration: boolean; visibility?: RegistryVisibility }): string {
  const json = JSON.stringify({
    name: metadata.name,
    description: metadata.description,
    image: '',
    attributes: [
      { trait_type: 'Work Type', value: metadata.workType },
      { trait_type: 'Creator', value: metadata.creator },
      { trait_type: 'Copyright Declaration', value: String(metadata.copyrightDeclaration) },
      { trait_type: 'Platform', value: 'SoftLaw' },
      { trait_type: 'Content Visibility', value: metadata.visibility ?? 'public' },
    ],
    registration: {
      work_type: metadata.workType,
      copyright_declaration: metadata.copyrightDeclaration,
      content_visibility: metadata.visibility ?? 'public',
      blockchain_proof: { chain_id: ACTIVE_CHAIN_ID, contract: CONTRACT_ADDRESSES.IPAsset },
    },
    legal: buildOwnershipLegal(metadata.creator),
  })
  return `data:application/json;base64,${btoa(json)}`
}

interface CoAuthor {
  address: string
  sharePct: number
}

export function RegisterIPModal({ colors, address, initialMode, onClose, onSuccess, onOptimisticMint }: { colors: ThemeColors; address: `0x${string}`; initialMode: 'new' | 'wrap'; onClose: () => void; onSuccess: () => void; onOptimisticMint?: (asset: UserIPAsset) => void }) {
  const { t } = useTranslations()
  const workTypes: Array<{ id: WorkType; label: string; icon: typeof FileText }> = [
    { id: 'literary', label: t.registry.categories.literary, icon: WORK_TYPE_ICONS.literary },
    { id: 'artistic', label: t.registry.categories.artistic, icon: WORK_TYPE_ICONS.artistic },
    { id: 'musical', label: t.registry.categories.musical, icon: WORK_TYPE_ICONS.musical },
    { id: 'audiovisual', label: t.registry.categories.audiovisual, icon: WORK_TYPE_ICONS.audiovisual },
    { id: 'software', label: t.registry.categories.software, icon: WORK_TYPE_ICONS.software },
    { id: 'dramatic', label: t.registry.categories.dramatic, icon: WORK_TYPE_ICONS.dramatic },
  ]
  const [mode, setMode] = useState<'new' | 'wrap'>(initialMode)

  const { mintIP, hash: mintHash, receipt, isPending: mintPending, isConfirming: mintConfirming, isSuccess: mintSuccess, error: mintError } = useMintIP()
  const { upload, prefetchUrl, clearPrefetchedUrl, cleanupOnError: cleanupIPFS } = useIPFSUpload()
  const fileRef = useRef<HTMLInputElement>(null)

  const { addProgressToast, updateToast, removeToast } = useToastStore()
  const toastIdRef = useRef<string | null>(null)
  const hasIPFSRef = useRef(false)

  // Core form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [workType, setWorkType] = useState<WorkType | ''>('')
  const [copyrightDeclaration, setCopyrightDeclaration] = useState(false)
  const [visibility, setVisibility] = useState<RegistryVisibility>('public')

  // Optional fields
  const [creationDate, setCreationDate] = useState(new Date().toISOString().split('T')[0])
  const [jurisdiction, setJurisdiction] = useState('')
  const [derivativeTokenId, setDerivativeTokenId] = useState('')
  const [isDerivative, setIsDerivative] = useState(false)
  const [folioInput, setFolioInput] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>([])
  // File + content hash
  const [file, setFile] = useState<File | null>(null)
  const isFormValid = Boolean(
    title && description && workType && copyrightDeclaration
      && (visibility === 'public' || file),
  )
  const [computedHash, setComputedHash] = useState<{ file: File; hash: string } | null>(null)
  const contentHash = computedHash?.file === file ? computedHash.hash : ''
  const filePreviewUrl = useMemo(() => file ? URL.createObjectURL(file) : null, [file])
  useEffect(() => { return () => { if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl) } }, [filePreviewUrl])

  const selectWorkType = useCallback((nextWorkType: WorkType) => {
    if (nextWorkType === workType) return
    setWorkType(nextWorkType)
    setFile(null)
    clearPrefetchedUrl()
  }, [clearPrefetchedUrl, workType])

  // Auto-compute SHA-256 when file changes (skip for files > 50 MB — arrayBuffer() would OOM)
  useEffect(() => {
    if (!file || file.size > 50 * 1024 * 1024) return
    let cancelled = false
    computeSHA256(file).then(hash => {
      if (!cancelled) setComputedHash({ file, hash })
    })
    return () => { cancelled = true }
  }, [file])

  // Metadata is prepared before the final click. This keeps the wallet request
  // inside its trusted user gesture while presenting a single primary action.
  const [uploadedUri, setUploadedUri] = useState<string | null>(null)
  const [preparationStatus, setPreparationStatus] = useState<RegistrationPreparationStatus>(
    isIPFSConfigured() ? 'idle' : 'fallback',
  )
  const [preparationError, setPreparationError] = useState<string | null>(null)
  const [preparationRetry, setPreparationRetry] = useState(0)
  const preparationVersionRef = useRef(0)
  const preparationQueueRef = useRef<Promise<void>>(Promise.resolve())
  const mintStartedRef = useRef(false)
  const privateCidRef = useRef<string | null>(null)
  const privateFileIdentityRef = useRef<string | null>(null)
  const privateRecoveryIdRef = useRef<string | null>(null)
  const [preparedPrivateContent, setPreparedPrivateContent] = useState<PreparedPrivateContent | null>(null)

  const cleanupPreparedPrivateContent = useCallback(async () => {
    const cid = privateCidRef.current
    privateCidRef.current = null
    privateFileIdentityRef.current = null
    const recoveryId = privateRecoveryIdRef.current
    privateRecoveryIdRef.current = null
    setPreparedPrivateContent(null)
    if (recoveryId) await deletePrivateContentRecovery(recoveryId).catch(() => undefined)
    if (cid) await unpinFile(cid).catch(() => undefined)
  }, [])

  const { wrapNFT, hash: wrapHash, isPending: wrapPending, isConfirming: wrapConfirming, isSuccess: wrapSuccess, error: wrapError } = useWrapNFT()
  const wrapToast = useTxToast()
  const [wrapForm, setWrapForm] = useState({ nftContract: '', tokenId: '', metadataURI: '' })


  // Wrap hash → advance toast to confirming
  useEffect(() => {
    if (wrapHash) wrapToast.onHash(wrapHash)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrapHash])

  // Wrap success → show indexing step, then close
  useEffect(() => {
    if (!wrapSuccess) return
    wrapToast.onConfirmed(t.modals.nftWrapped)
    onSuccess()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrapSuccess])

  // Hash appeared → wallet signed, tx submitted → advance to "confirming" step
  useEffect(() => {
    const tid = toastIdRef.current
    if (!tid || !mintHash) return
    const hasIPFS = hasIPFSRef.current
    updateToast(tid, {
      txHash: mintHash,
      steps: [
        ...(hasIPFS ? [{ label: t.tx.uploadingIPFS, status: 'done' as const }] : []),
        { label: t.tx.waitingSignature, status: 'done' as const },
        { label: t.tx.confirmingOnChain, status: 'active' as const },
        { label: t.tx.indexing, status: 'waiting' as const },
      ],
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mintHash])

  useEffect(() => {
    if (!mintHash || !privateRecoveryIdRef.current) return
    void updatePrivateContentRecovery(privateRecoveryIdRef.current, { txHash: mintHash })
  }, [mintHash])

  // mintSuccess → confirmed on-chain, now indexing
  useEffect(() => {
    const tid = toastIdRef.current
    if (!tid || !mintSuccess) return
    const hasIPFS = hasIPFSRef.current
    updateToast(tid, {
      type: 'success',
      message: t.modals.ipRegistered,
      steps: [
        ...(hasIPFS ? [{ label: t.tx.uploadingIPFS, status: 'done' as const }] : []),
        { label: t.tx.waitingSignature, status: 'done' as const },
        { label: t.tx.confirmingOnChain, status: 'done' as const },
        { label: t.tx.indexing, status: 'active' as const },
      ],
    })
    // Auto-dismiss after 8s — the indexing badge on the card takes over
    setTimeout(() => {
      if (toastIdRef.current === tid) {
        removeToast(tid)
        toastIdRef.current = null
      }
    }, 8000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mintSuccess])

  // Decode the freshly minted tokenId from the IPMinted event. Used by both
  // the optimistic-mint inject (parent's pending card) and the post-mint
  // private-content step (needs the tokenId to scope encryption).
  const mintedEvent = useMemo(() => {
    if (!mintSuccess || !receipt) return null
    try {
      const ipMintedLog = receipt.logs.find(
        log => log.address.toLowerCase() === CONTRACT_ADDRESSES.IPAsset.toLowerCase(),
      )
      if (!ipMintedLog) return null
      const { args } = decodeEventLog({
        abi: ABIS.IPAsset,
        eventName: 'IPMinted',
        data: ipMintedLog.data,
        topics: ipMintedLog.topics as [`0x${string}`, ...`0x${string}`[]],
      }) as unknown as { args: { tokenId: bigint; owner: `0x${string}`; metadataURI: string } }
      return args
    } catch {
      return null
    }
  }, [mintSuccess, receipt])
  const mintedTokenId = mintedEvent?.tokenId ?? null
  const [idResolutionTimedOut, setIdResolutionTimedOut] = useState(false)
  useEffect(() => {
    if (!mintSuccess || mintedTokenId !== null || visibility !== 'confidential') return
    const timer = window.setTimeout(() => setIdResolutionTimedOut(true), 15_000)
    return () => window.clearTimeout(timer)
  }, [mintSuccess, mintedTokenId, visibility])
  const handledMintRef = useRef<string | null>(null)
  useEffect(() => {
    if (!mintedEvent) return
    const mintKey = `${mintHash ?? 'receipt'}:${mintedEvent.tokenId.toString()}`
    if (handledMintRef.current === mintKey) return
    handledMintRef.current = mintKey
    if (privateRecoveryIdRef.current && mintedEvent.tokenId <= BigInt(Number.MAX_SAFE_INTEGER)) {
        void updatePrivateContentRecovery(privateRecoveryIdRef.current, {
          txHash: mintHash,
          subjectId: Number(mintedEvent.tokenId),
        })
    }
    onOptimisticMint?.({
      tokenId: mintedEvent.tokenId,
      metadataURI: mintedEvent.metadataURI,
      title: title || `IP #${mintedEvent.tokenId.toString()}`,
      category: workType || 'literary',
      description: description || undefined,
      creator: address,
      imageUrl: undefined,
      activeLicenseCount: 0n,
      hasActiveDispute: false,
    })
  }, [address, description, mintHash, mintedEvent, onOptimisticMint, title, workType])

  const addCoAuthor = useCallback(() => {
    setCoAuthors(prev => [...prev, { address: '', sharePct: 0 }])
  }, [])

  const removeCoAuthor = useCallback((index: number) => {
    setCoAuthors(prev => prev.filter((_, i) => i !== index))
  }, [])

  const updateCoAuthor = useCallback((index: number, field: keyof CoAuthor, value: string | number) => {
    setCoAuthors(prev => prev.map((ca, i) => i === index ? { ...ca, [field]: value } : ca))
  }, [])

  const buildIpMetadata = useCallback(() => ({
    name: title,
    description,
    workType: workType as string,
    creator: address,
    creationDate: creationDate || undefined,
    copyrightDeclaration,
    coAuthors: coAuthors.filter(ca => ca.address && ca.sharePct > 0).length > 0
      ? coAuthors.filter(ca => ca.address && ca.sharePct > 0)
      : undefined,
    jurisdiction: jurisdiction || undefined,
    derivativeOf: derivativeTokenId
      ? { tokenId: derivativeTokenId, contractAddress: CONTRACT_ADDRESSES.IPAsset }
      : undefined,
    contentHash: contentHash || undefined,
    additionalNotes: additionalNotes || undefined,
    visibility,
  }), [
    title, description, workType, address, creationDate, copyrightDeclaration,
    coAuthors, jurisdiction, derivativeTokenId, contentHash, additionalNotes, visibility,
  ])

  const preparationFingerprint = useMemo(() => `${visibility}:${registrationDraftFingerprint({
    title,
    description,
    workType,
    file,
    creationDate,
    jurisdiction,
    derivativeTokenId,
    additionalNotes,
    coAuthors,
    copyrightDeclaration,
    contentHash,
  })}`, [
    title, description, workType, file, creationDate, jurisdiction,
    derivativeTokenId, additionalNotes, coAuthors, copyrightDeclaration, contentHash, visibility,
  ])

  useEffect(() => {
    const version = ++preparationVersionRef.current
    // This is an external preparation lifecycle reset, not derived render state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUploadedUri(null)
    setPreparationError(null)

    if (mode !== 'new') {
      setPreparationStatus(isIPFSConfigured() ? 'idle' : 'fallback')
      return
    }

    if (!isIPFSConfigured()) {
      setPreparationStatus(visibility === 'confidential' ? 'error' : 'fallback')
      if (visibility === 'confidential') setPreparationError(t.privateContent.ipfsRequired)
      return
    }

    if (!isFormValid) {
      setPreparationStatus('idle')
      preparationQueueRef.current = preparationQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          await cleanupIPFS()
          if (visibility === 'public' || !file) await cleanupPreparedPrivateContent()
        })
      return
    }

    setPreparationStatus('preparing')
    const timer = window.setTimeout(() => {
      preparationQueueRef.current = preparationQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (version !== preparationVersionRef.current) return
          await cleanupIPFS()
          if (visibility === 'public') await cleanupPreparedPrivateContent()
          if (version !== preparationVersionRef.current) return

          try {
            // Confidential files are never attached to public token metadata.
            const result = await upload(publicRegistryMedia(visibility, file), buildIpMetadata())
            if (version !== preparationVersionRef.current) {
              await cleanupIPFS()
              return
            }
            if (visibility === 'confidential' && file) {
              const fileIdentity = [file.name, file.size, file.type, file.lastModified].join(':')
              if (privateFileIdentityRef.current !== fileIdentity || !privateCidRef.current) {
                await cleanupPreparedPrivateContent()
                const encrypted = await uploadEncryptedPrivateContent(file)
                if (version !== preparationVersionRef.current) {
                  await unpinFile(encrypted.cid).catch(() => undefined)
                  await cleanupIPFS()
                  return
                }
                privateCidRef.current = encrypted.cid
                privateFileIdentityRef.current = fileIdentity
                let recovery
                try {
                  recovery = await createPrivateContentRecovery({
                    kind: 'asset',
                    chainId: ACTIVE_CHAIN_ID,
                    contractAddress: CONTRACT_ADDRESSES.IPAsset,
                    walletAddress: address,
                    cid: encrypted.cid,
                  }, encrypted.aesKeyB64)
                } catch (cause) {
                  await unpinFile(encrypted.cid).catch(() => undefined)
                  throw cause
                }
                privateRecoveryIdRef.current = recovery.id
                setPreparedPrivateContent({ file, ...encrypted })
              }
            }
            setUploadedUri(result.metadataUri)
            setPreparationStatus('ready')
          } catch (err) {
            await cleanupIPFS()
            if (version !== preparationVersionRef.current) return
            setPreparationError(err instanceof Error ? err.message : String(err))
            setPreparationStatus('error')
          }
        })
    }, 800)

    return () => window.clearTimeout(timer)
  }, [
    preparationFingerprint, preparationRetry, isFormValid, file, mode,
    address, buildIpMetadata, upload, cleanupIPFS, cleanupPreparedPrivateContent, visibility, t.privateContent.ipfsRequired,
  ])

  // The final click only requests the wallet signature. Slow IPFS work has
  // already completed, so Privy's trusted-gesture window cannot expire.
  const handleNewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workType) return
    if (isIPFSConfigured() && !uploadedUri) {
      toastError('Please upload to IPFS first')
      return
    }
    if (visibility === 'confidential' && !preparedPrivateContent) {
      toastError(t.privateContent.privatePreparationRequired)
      return
    }

    const hasIPFS = isIPFSConfigured() && !!uploadedUri
    hasIPFSRef.current = hasIPFS

    const uri = uploadedUri ?? createFallbackMetadataURI({
      name: title, description, workType, creator: address, copyrightDeclaration, visibility,
    })

    const initSteps: TxStep[] = [
      ...(hasIPFS ? [{ label: t.tx.uploadingIPFS, status: 'done' as const }] : []),
      { label: t.tx.waitingSignature, status: 'active' as const },
      { label: t.tx.confirmingOnChain, status: 'waiting' as const },
      { label: t.tx.indexing, status: 'waiting' as const },
    ]
    const tid = addProgressToast(t.tx.registeringIP, initSteps)
    toastIdRef.current = tid
    mintStartedRef.current = true

    try {
      await mintIP(address, uri)
      // Hash + mintSuccess effects take over the toast from here
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (isWalletRejection(err)) {
        // A wallet rejection is not an upload failure. Keep the prepared URI
        // so a retry needs only another explicit wallet confirmation.
        mintStartedRef.current = false
        removeToast(tid)
      } else {
        void cleanupIPFS()
        void cleanupPreparedPrivateContent()
        setUploadedUri(null)
        setPreparationStatus('error')
        setPreparationError(msg)
        mintStartedRef.current = false
        updateToast(tid, { type: 'error', message: t.ipSection.messages.failed, steps: undefined })
        setTimeout(() => removeToast(tid), 5000)
        toastError(t.ipSection.messages.failed)
      }
      toastIdRef.current = null
    }
  }

  const handleClose = () => {
    if (!mintStartedRef.current) {
      preparationVersionRef.current += 1
      preparationQueueRef.current = preparationQueueRef.current
        .catch(() => undefined)
        .then(async () => { await cleanupIPFS(); await cleanupPreparedPrivateContent() })
    }
    onClose()
  }

  const handleModeChange = (nextMode: 'new' | 'wrap') => {
    if (nextMode === mode) return
    if (mode === 'new' && !mintStartedRef.current) {
      preparationVersionRef.current += 1
      setUploadedUri(null)
      setPreparationStatus(isIPFSConfigured() ? 'idle' : 'fallback')
      preparationQueueRef.current = preparationQueueRef.current
        .catch(() => undefined)
        .then(async () => { await cleanupIPFS(); await cleanupPreparedPrivateContent() })
    }
    setMode(nextMode)
  }

  const handleVisibilityChange = (nextVisibility: RegistryVisibility) => {
    if (nextVisibility === visibility) return
    // Require a new file selection when visibility changes.
    setVisibility(nextVisibility)
    setFile(null)
    setComputedHash(null)
    clearPrefetchedUrl()
    preparationVersionRef.current += 1
    preparationQueueRef.current = preparationQueueRef.current
      .catch(() => undefined)
      .then(async () => { await cleanupIPFS(); await cleanupPreparedPrivateContent() })
  }

  const handleWrapSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidAddress(wrapForm.nftContract)) { toastError(t.modals.invalidContractAddress); return }
    wrapToast.start(t.modals.wrap)
    try {
      const uri = wrapForm.metadataURI || createFallbackMetadataURI({ name: `Wrapped NFT #${wrapForm.tokenId}`, description: 'Wrapped external NFT', workType: 'artistic', creator: address, copyrightDeclaration: false, visibility: 'public' })
      await wrapNFT(wrapForm.nftContract as `0x${string}`, BigInt(wrapForm.tokenId), uri)
      // Success path handled by wrapHash + wrapSuccess effects
    } catch (err) {
      console.error('[RegisterIPModal] handleWrapSubmit failed:', err)
      wrapToast.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  const isNewLoading = mintPending || mintConfirming
  const isWrapLoading = wrapPending || wrapConfirming

  // Post-mint success view. Confidential bytes were already encrypted and
  // uploaded during preparation; the only remaining step binds the key to
  // the newly-created token ID with an explicit EIP-712 signature.
  if (mintSuccess && mode === 'new') {
    return (
      <Modal colors={colors} title={t.modals.registerIP} onClose={() => { onSuccess(); onClose() }}>
        <div className="space-y-3 py-2">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: `${colors.accent.gold}20` }}>
              <Check className="w-5 h-5" style={{ color: colors.accent.goldText }} />
            </div>
            <p className="text-sm font-bold" style={{ color: colors.accent.goldText }}>{t.modals.ipRegistered}</p>
            {mintHash && (
              <a href={getTxUrl(mintHash)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: colors.accent.goldText }}>
                {t.createLicense.wizard.viewOnExplorer} <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          {visibility === 'confidential' && mintedTokenId !== null && preparedPrivateContent ? (
            <PrivateContentUpload
              subject={{ kind: 'asset', id: Number(mintedTokenId) }}
              prepared={preparedPrivateContent}
              required
              onDone={() => {
                const recoveryId = privateRecoveryIdRef.current
                privateRecoveryIdRef.current = null
                if (recoveryId) void deletePrivateContentRecovery(recoveryId)
                onSuccess(); onClose()
              }}
            />
          ) : visibility === 'confidential' && idResolutionTimedOut ? (
            <div className="space-y-2 py-3 text-center text-xs" role="alert" style={{ color: 'var(--danger)' }}>
              <p>{t.privateContent.idResolutionTimeout}</p>
              <p style={{ color: 'var(--ink-2)' }}>{t.privateContent.resumeAfterClose}</p>
              <Button size="sm" onClick={() => { onSuccess(); onClose() }}>{t.privateContent.done}</Button>
            </div>
          ) : visibility === 'confidential' ? (
            <div className="flex items-center justify-center gap-2 py-3 text-xs" role="status" style={{ color: 'var(--ink-2)' }}>
              <CloudUpload className="w-4 h-4 animate-pulse" /> {t.privateContent.waitingForAssetId}
            </div>
          ) : (
            <div className="pt-2 flex justify-center">
              <Button size="sm" onClick={() => { onSuccess(); onClose() }}>
                {t.privateContent.done}
              </Button>
            </div>
          )}
        </div>
      </Modal>
    )
  }

  return (
    <Modal colors={colors} title={t.modals.registerIP} onClose={handleClose}>
      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        <button type="button" onClick={() => handleModeChange('new')} className="flex-1 py-2.5 rounded-sm text-sm font-medium transition-all" style={{ backgroundColor: mode === 'new' ? `${colors.accent.gold}20` : colors.background.tertiary, color: mode === 'new' ? colors.accent.goldText : colors.text.muted, border: `1px solid ${mode === 'new' ? colors.accent.gold : colors.border.primary}` }}>
          <Plus className="w-4 h-4 inline mr-1.5" />{t.modals.newIP}
        </button>
        <button type="button" onClick={() => handleModeChange('wrap')} className="flex-1 py-2.5 rounded-sm text-sm font-medium transition-all" style={{ backgroundColor: mode === 'wrap' ? `${colors.accent.gold}20` : colors.background.tertiary, color: mode === 'wrap' ? colors.accent.goldText : colors.text.muted, border: `1px solid ${mode === 'wrap' ? colors.accent.gold : colors.border.primary}` }}>
          <Package className="w-4 h-4 inline mr-1.5" />{t.modals.wrapNFT}
        </button>
      </div>

      {mode === 'new' ? (
        <form onSubmit={handleNewSubmit} className="space-y-3">
          <div className="flex items-start justify-between gap-4 pb-1">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t.registry.form.registrationTitle}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>{t.registry.form.registrationHint}</p>
            </div>
            <span className="mono shrink-0 px-2 py-1 rounded-full text-[9px]" style={{ color: 'var(--ink-2)', background: 'var(--bg-elev-2)', border: '1px solid var(--line)' }}>
              Asset Hub
            </span>
          </div>

          <section className="rounded-sm p-3" style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--line)' }}>
          <fieldset>
            <legend className="text-xs font-semibold mb-1.5" style={{ color: 'var(--ink-2)' }}>
              <span className="inline-flex items-center justify-center w-5 h-5 mr-2 rounded-full mono text-[9px]" style={{ color: '#111', background: 'var(--gold)' }}>1</span>
              {t.privateContent.visibilityTitle}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'public' as const, icon: Globe2, title: t.privateContent.publicTitle, description: t.privateContent.publicDescription },
                { value: 'confidential' as const, icon: Lock, title: t.privateContent.confidentialTitle, description: t.privateContent.confidentialDescription },
              ]).map((option) => {
                const selected = visibility === option.value
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => handleVisibilityChange(option.value)}
                    disabled={isNewLoading}
                    className="p-3 text-left rounded-sm transition-all"
                    style={{
                      background: selected ? 'color-mix(in srgb, var(--gold) 13%, var(--bg-elev))' : 'var(--bg-elev)',
                      border: `1px solid ${selected ? 'var(--gold-deep)' : 'var(--line)'}`,
                      boxShadow: selected ? 'inset 3px 0 0 var(--gold)' : 'none',
                    }}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-bold mb-1" style={{ color: selected ? 'var(--gold-text)' : 'var(--ink)' }}>
                      <Icon className="w-3.5 h-3.5" /> {option.title}
                    </span>
                    <span className="block text-[10px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>{option.description}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>
          </section>

          <section className="rounded-sm p-3 space-y-3" style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)' }}>
          <p className="text-xs font-semibold flex items-center" style={{ color: 'var(--ink-2)' }}>
            <span className="inline-flex items-center justify-center w-5 h-5 mr-2 rounded-full mono text-[9px]" style={{ color: '#111', background: 'var(--gold)' }}>2</span>
            {t.registry.form.basicsTitle}
          </p>

          {/* Title */}
          <label className="block">
            <span className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>{t.registry.form.titleLabel} *</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.registry.form.titlePlaceholder} className="input" required disabled={isNewLoading} />
          </label>

          {/* Description */}
          <label className="block">
            <span className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>{t.registry.form.descriptionLabel} *</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t.registry.form.descriptionPlaceholder} rows={3} className="input resize-none" required disabled={isNewLoading} />
          </label>

          {/* Work Type (required) */}
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: colors.text.muted }}>{t.registry.form.categoryLabel} *</p>
            <div className="grid grid-cols-3 gap-1.5">
              {workTypes.map((wt) => (
                <button key={wt.id} type="button" aria-pressed={workType === wt.id} onClick={() => selectWorkType(wt.id)} disabled={isNewLoading} className="flex flex-col items-center gap-1 p-2.5 rounded-sm text-xs transition-all" style={{ backgroundColor: workType === wt.id ? 'color-mix(in srgb, var(--gold) 12%, var(--bg-elev-2))' : colors.background.tertiary, border: `1px solid ${workType === wt.id ? 'var(--gold-deep)' : colors.border.primary}`, color: workType === wt.id ? 'var(--ink)' : colors.text.muted, boxShadow: workType === wt.id ? 'inset 0 -2px 0 var(--gold)' : 'none' }}>
                  <wt.icon className="w-4 h-4" />{wt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Creation Date (optional, pre-filled) */}
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: colors.text.muted }}>{t.registry.form.creationDate}</p>
            <input type="date" value={creationDate} onChange={(e) => setCreationDate(e.target.value)} className="input" disabled={isNewLoading} />
            <p className="text-xs mt-1" style={{ color: colors.text.muted }}>{t.registry.form.creationDateHint}</p>
          </div>

          {/* Content File Upload — accept and label adapt to selected work type */}
          {(() => {
            const fileConfig = workType ? WORK_TYPE_FILE_CONFIG[workType] : null
            if (file) {
              const isImage = file.type.startsWith('image/')
              const isAudio = file.type.startsWith('audio/')
              const isVideo = file.type.startsWith('video/')
              const PreviewIcon = isAudio ? Music : isVideo ? Film : FileText
              return (
                <div className="flex items-center gap-3 p-3 rounded-sm" style={{ backgroundColor: colors.background.tertiary }}>
                  {isImage ? (
                    <img src={filePreviewUrl!} alt="" className="w-11 h-11 object-cover rounded-lg" />
                  ) : (
                    <div className="w-11 h-11 rounded-sm flex items-center justify-center flex-shrink-0" style={{ backgroundColor: colors.background.secondary }}>
                      <PreviewIcon className="w-6 h-6" style={{ color: colors.accent.goldText }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block" style={{ color: colors.text.primary }}>{file.name}</span>
                    <span className="text-xs" style={{ color: colors.text.muted }}>{formatBytes(file.size)}</span>
                    {contentHash && (
                      <span className="text-xs font-mono truncate block" style={{ color: colors.text.muted }}>SHA-256: {contentHash.slice(0, 16)}...{contentHash.slice(-8)}</span>
                    )}
                  </div>
                  <button type="button" onClick={() => { setFile(null); clearPrefetchedUrl() }}><X className="w-4 h-4" style={{ color: colors.text.muted }} /></button>
                </div>
              )
            }
            if (!fileConfig) {
              return (
                <div className="border border-dashed rounded-sm p-4 text-center" style={{ borderColor: colors.border.primary, background: 'var(--bg-elev-2)' }}>
                  <CloudUpload className="w-5 h-5 mx-auto mb-1" style={{ color: colors.text.muted }} />
                  <p className="text-sm" style={{ color: 'var(--ink-3)' }}>{t.registry.form.selectTypeFirst}</p>
                </div>
              )
            }
            return (
              <div onClick={() => fileRef.current?.click()} className="border border-dashed rounded-sm p-5 text-center cursor-pointer transition-colors" style={{ borderColor: 'var(--gold-deep)', background: 'color-mix(in srgb, var(--gold) 5%, var(--bg-elev-2))' }}>
                <CloudUpload className="w-5 h-5 mx-auto mb-1" style={{ color: colors.text.muted }} />
                {(() => {
                  const maxBytes = registrationFileLimit(fileConfig.maxBytes, visibility)
                  return <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
                  {visibility === 'confidential' ? t.privateContent.confidentialFile : fileConfig.label}{' '}
                  <span style={{ color: 'var(--ink-3)' }}>({visibility === 'confidential' ? t.privateContent.fileRequired : t.privateContent.fileOptional}, {t.privateContent.upTo.replace('{size}', formatBytes(maxBytes))})</span>
                  </p>
                })()}
                <input key={`${workType}-${visibility}`} ref={fileRef} type="file" accept={fileConfig.accept} onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const maxBytes = registrationFileLimit(fileConfig.maxBytes, visibility)
                  if (f.size > maxBytes) {
                    toastError(t.privateContent.tooLarge)
                    setFile(null)
                    return
                  }
                  setFile(f)
                  if (visibility === 'public') prefetchUrl(f)
                  else clearPrefetchedUrl()
                }} className="hidden" />
              </div>
            )
          })()}
          {visibility === 'confidential' && (
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              <Lock className="w-3 h-3 inline mr-1" style={{ color: 'var(--gold-text)' }} />
              {t.privateContent.confidentialFlowNotice}
            </p>
          )}
          </section>

          {/* Copyright Declaration (required) */}
          <label className="flex items-start gap-3 p-4 rounded-sm cursor-pointer" style={{ backgroundColor: copyrightDeclaration ? 'color-mix(in srgb, var(--ok) 7%, var(--bg-elev))' : colors.background.tertiary, border: `1px solid ${copyrightDeclaration ? 'var(--ok)' : colors.border.primary}` }}>
            <input type="checkbox" checked={copyrightDeclaration} onChange={(e) => setCopyrightDeclaration(e.target.checked)} disabled={isNewLoading} className="mt-0.5 accent-amber-500 w-4 h-4" />
            <span className="text-sm leading-snug" style={{ color: copyrightDeclaration ? colors.text.primary : colors.text.muted }}>{t.registry.form.copyrightDeclaration} *</span>
          </label>

          {/* Collapsible optional fields */}
          <details className="group rounded-sm p-3" style={{ border: '1px solid var(--line)', background: 'var(--bg-elev-2)' }}>
            <summary className="text-xs font-medium cursor-pointer flex items-center gap-1.5" style={{ color: colors.text.muted }}>
              <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
              {t.common.optionalFields}
            </summary>
            <div className="space-y-3 mt-3">
              {/* Jurisdiction */}
              <div>
                <p className="text-xs font-medium mb-1.5" style={{ color: colors.text.muted }}>{t.registry.form.jurisdiction}</p>
                <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className="input" disabled={isNewLoading}>
                  <option value="">{t.registry.form.selectJurisdiction}</option>
                  {JURISDICTIONS.map(j => <option key={j.code} value={j.code}>{j.label}</option>)}
                </select>
              </div>

              {/* Co-Authors */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium" style={{ color: colors.text.muted }}>{t.registry.form.coAuthors}</p>
                  <button type="button" onClick={addCoAuthor} className="text-xs px-2 py-1 rounded-sm" style={{ backgroundColor: `${colors.accent.gold}15`, color: colors.accent.goldText }}>
                    + {t.registry.form.addCoAuthor}
                  </button>
                </div>
                {coAuthors.map((ca, i) => (
                  <div key={i} className="flex gap-1.5 mb-1.5">
                    <input type="text" value={ca.address} onChange={(e) => updateCoAuthor(i, 'address', e.target.value)} placeholder={t.registry.form.coAuthorAddress} className="input flex-1" disabled={isNewLoading} />
                    <input type="number" value={ca.sharePct || ''} onChange={(e) => updateCoAuthor(i, 'sharePct', parseInt(e.target.value) || 0)} placeholder="%" className="input text-center" style={{ width: 64 }} min={1} max={100} disabled={isNewLoading} />
                    <button type="button" onClick={() => removeCoAuthor(i)} className="p-1.5 rounded-sm" style={{ color: colors.text.muted }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Derivative Of */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={isDerivative}
                    onChange={e => {
                      setIsDerivative(e.target.checked)
                      if (!e.target.checked) { setDerivativeTokenId(''); setFolioInput('') }
                    }}
                    disabled={isNewLoading}
                    className="w-3.5 h-3.5"
                  />
                  <span className="text-xs font-medium" style={{ color: 'var(--ink-2)' }}>{t.registry.form.derivativeOf}</span>
                </label>
                {isDerivative && (
                  <div style={{ paddingLeft: 22 }}>
                    <input
                      type="text"
                      value={folioInput}
                      onChange={e => {
                        const val = e.target.value
                        setFolioInput(val)
                        const m = val.trim().match(/^SL-\d{4}-(\d{4})$/i)
                        setDerivativeTokenId(m ? String(parseInt(m[1], 10)) : val.replace(/\D/g, ''))
                      }}
                      placeholder="SL-2026-0001 or Token ID"
                      className="input"
                      disabled={isNewLoading}
                    />
                    {derivativeTokenId && (
                      <p className="mono" style={{ fontSize: 10, color: 'var(--gold-text)', marginTop: 4 }}>
                        → Token #{derivativeTokenId}
                      </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: 'var(--ink-4)', fontStyle: 'italic' }}>
                      {t.registry.form.derivativeOfHint} · Berne Convention Art. 2(3)
                    </p>
                  </div>
                )}
              </div>

              {/* Additional Notes */}
              <div>
                <p className="text-xs font-medium mb-1.5" style={{ color: colors.text.muted }}>{t.registry.form.additionalNotes}</p>
                <textarea value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value.slice(0, 500))} placeholder={t.registry.form.additionalNotesHint} rows={3} className="input resize-none" disabled={isNewLoading} />
                <p className="text-xs text-right mt-1" style={{ color: colors.text.muted }}>{additionalNotes.length}/500</p>
              </div>
            </div>
          </details>

          {mintError && <p className="text-sm text-red-500">{mintError.message}</p>}
          <div className="sticky bottom-0 -mx-1 px-1 pt-3 pb-1 space-y-1.5" style={{ background: 'linear-gradient(transparent, var(--bg) 18%, var(--bg))' }}>
            {preparationStatus === 'preparing' && (
              <p className="text-[10px] flex items-center gap-1.5" role="status" style={{ color: colors.text.muted }}>
                <CloudUpload className="w-3 h-3" /> {t.modals.preparingIPFS}
              </p>
            )}
            {preparationStatus === 'ready' && uploadedUri && (
              <p className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--ok)' }}>
                <Check className="w-3 h-3" /> {visibility === 'confidential' ? t.privateContent.encryptedReady : t.modals.ipfsReady}
              </p>
            )}
            {preparationStatus === 'fallback' && isFormValid && (
              <p className="text-[10px]" style={{ color: colors.text.muted }}>{t.modals.localMetadataReady}</p>
            )}
            {preparationStatus === 'error' && (
              <div className="flex items-center justify-between gap-2" role="alert">
                <p className="text-[10px] text-red-500 truncate">{preparationError || t.modals.ipfsPreparationFailed}</p>
                <button type="button" className="text-[10px] underline shrink-0" onClick={() => setPreparationRetry(value => value + 1)}>
                  {t.common.retry}
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                className="flex-1"
                isLoading={mintPending || mintConfirming}
                disabled={!canSubmitPreparedRegistration(isFormValid, isIPFSConfigured(), preparationStatus)}
              >
                {preparationStatus === 'preparing'
                  ? t.modals.preparing
                  : visibility === 'confidential'
                    ? t.privateContent.registerConfidential
                    : t.modals.register}
              </Button>
              <Button type="button" variant="outline" onClick={handleClose}>{t.common.cancel}</Button>
            </div>
          </div>
        </form>
      ) : (
        <form onSubmit={handleWrapSubmit} className="space-y-3">
          <input type="text" value={wrapForm.nftContract} onChange={(e) => setWrapForm({ ...wrapForm, nftContract: e.target.value })} placeholder={t.registry.wrap.contractAddress} className="input" required />
          <input type="number" value={wrapForm.tokenId} onChange={(e) => setWrapForm({ ...wrapForm, tokenId: e.target.value })} placeholder={t.marketplace.createListing.tokenId} className="input" required />
          <input type="text" value={wrapForm.metadataURI} onChange={(e) => setWrapForm({ ...wrapForm, metadataURI: e.target.value })} placeholder={t.registry.wrap.metadataUri} className="input" />
          <p className="text-sm" style={{ color: colors.text.muted }}>{t.modals.wrapHint}</p>
          {wrapError && <p className="text-sm text-red-500">{wrapError.message}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" isLoading={isWrapLoading} disabled={!wrapForm.nftContract || !wrapForm.tokenId}>{t.modals.wrap}</Button>
            <Button type="button" variant="outline" onClick={onClose}>{t.common.cancel}</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
