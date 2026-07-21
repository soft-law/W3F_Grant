import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSignMessage, useWaitForTransactionReceipt } from 'wagmi'
import { Check, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Loader2, Gift, User, Briefcase, Crown, ExternalLink, Image as ImageIcon, Music, Film, FileText, Code, Drama, Globe2, Lock, Upload, CreditCard } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ThemeColors } from '@/hooks/useTheme'
import { Button } from '@/components/Button'
import { useTxToast } from '@/hooks/useTxToast'
import { useMintLicense, useDefaultRoyalty, DEFAULT_PENALTY_RATE_BPS, DEFAULT_MAX_MISSED_PAYMENTS } from '@/hooks/useContracts'
import { useIndexedAssets, useIndexedLicensesForAsset } from '@/hooks/useIndexed'
import { useFileUpload, isConfigured as isIPFSConfigured } from '@/hooks/useIPFS'
import { isValidAddress, getTxUrl, shortenAddress, CONTRACT_ADDRESSES } from '@/lib/contracts'
import { useTranslations } from '@/lib/i18n'
import { defaultLicenseVisibility, privateContentFileIsValid, type LicenseVisibility } from '@/lib/private-content-domain'
import { uploadEncryptedPrivateContent } from '@/hooks/usePrivateContent'
import { unpinFile } from '@/lib/ipfs-storage'
import { PrivateContentUpload, type PreparedPrivateContent } from '../components/PrivateContentUpload'
import { Modal } from '../components/Modal'
import { ContextualEntitySummary } from '../components/ContextualEntitySummary'
import { hasContextualLicenseSubject } from '@/lib/modal-entry-context'
import {
  generateCopyrightLicense,
  computeDocumentHash,
  wrapWithSignature,
  buildSignMessage,
  getSmartDefaults,
  getWizardConstraints,
  resolveWizardProfile,
  TERRITORY_OPTIONS,
  type WizardType,
  type CopyrightRight,
} from '@/lib/copyright-license'
import { extractRegisteredLicenseId, getLicenseAvailabilityReason, prepareLicenseMint } from '@/lib/license-creation'
import { ACTIVE_CHAIN_ID } from '@/lib/wagmi-config'
import { createPrivateContentRecovery, deletePrivateContentRecovery, updatePrivateContentRecovery } from '@/lib/private-content-recovery'

type Step = 1 | 2 | 3 | 4

interface WizardForm {
  wizardType: WizardType | null
  licensee: string
  ipAssetId: string
  attribution: boolean
  allowDerivatives: boolean
  supply: number
  duration: 'perpetual' | '1y' | '3y' | '5y' | 'custom'
  customExpiryDate: string
  territory: string
  customTerms: string
  showAdvanced: boolean
  paymentInterval: number
  visibility: LicenseVisibility | null
}

// Category → icon for the asset picker fallback (non-image works).
function workTypeIcon(category?: string): LucideIcon {
  const c = (category || '').toLowerCase()
  if (c.includes('music')) return Music
  if (c.includes('audio') || c.includes('video') || c.includes('film')) return Film
  if (c.includes('software') || c.includes('code')) return Code
  if (c.includes('dramatic') || c.includes('script') || c.includes('drama')) return Drama
  if (c.includes('literary') || c.includes('book') || c.includes('text')) return FileText
  return ImageIcon
}

const DURATION_TO_DAYS: Record<string, number> = {
  perpetual: 0,
  '1y': 365,
  '3y': 1095,
  '5y': 1825,
}

function durationToTimestamp(dur: string, customDate: string): number {
  if (dur === 'perpetual') return 0
  if (dur === 'custom' && customDate) return Math.floor(new Date(customDate).getTime() / 1000)
  const days = DURATION_TO_DAYS[dur] ?? 365
  return Math.floor(Date.now() / 1000) + days * 86400
}

export function CreateLicenseModal({ colors: _colors, address, initialIpAssetId, onClose, onSuccess }: {
  colors: ThemeColors
  address: string
  initialIpAssetId?: string
  onClose: () => void
  onSuccess: () => void
}) {
  const { t } = useTranslations()
  const w = t.createLicense.wizard
  const { mintLicense, isPending, isConfirming, isSuccess, hash } = useMintLicense()
  const { signMessageAsync } = useSignMessage()
  const { uploadJson } = useFileUpload()
  const { data: mintReceipt } = useWaitForTransactionReceipt({ hash })
  const txToast = useTxToast()
  const { assets, isLoading: assetsLoading } = useIndexedAssets(address)
  const { data: defaultRoyaltyBps, isLoading: isLoadingRoyalty } = useDefaultRoyalty()
  const hasFixedAsset = hasContextualLicenseSubject(initialIpAssetId)

  const mintDoneRef = useRef(false)
  const [privateRecoveryId, setPrivateRecoveryId] = useState<string | null>(null)
  // Stable modal-open timestamp: avoids render-time Date.now() drift between
  // validation and the date input's minimum.
  const [openedAtMs] = useState(() => Date.now())

  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<WizardForm>({
    wizardType: null,
    licensee: '',
    ipAssetId: initialIpAssetId || '',
    attribution: true,
    allowDerivatives: true,
    supply: 100,
    duration: 'perpetual',
    customExpiryDate: '',
    territory: 'Worldwide',
    customTerms: '',
    showAdvanced: false,
    paymentInterval: 0,
    visibility: null,
  })

  const [metadataURI, setMetadataURI] = useState('')
  const [signError, setSignError] = useState('')
  const [mintError, setMintError] = useState('')
  const [isSigning, setIsSigning] = useState(false)
  const [showFullDoc, setShowFullDoc] = useState(false)
  const [privateFile, setPrivateFile] = useState<File | null>(null)
  const [preparedPrivateContent, setPreparedPrivateContent] = useState<PreparedPrivateContent | null>(null)
  const [idResolutionTimedOut, setIdResolutionTimedOut] = useState(false)

  const clearPreparedPrivateContent = useCallback(async () => {
    const cid = preparedPrivateContent?.cid
    const recoveryId = privateRecoveryId
    setPrivateRecoveryId(null)
    setPreparedPrivateContent(null)
    if (recoveryId) await deletePrivateContentRecovery(recoveryId).catch(() => undefined)
    if (cid) await unpinFile(cid).catch(() => undefined)
  }, [preparedPrivateContent, privateRecoveryId])
  const {
    licenses: selectedAssetLicenses,
    isLoading: licensesLoading,
    error: licensesError,
    refetch: refetchLicenses,
  } = useIndexedLicensesForAsset(form.ipAssetId)

  // Apply smart defaults when type changes
  const selectType = useCallback((type: WizardType) => {
    const defaults = getSmartDefaults(type)
    const constraints = getWizardConstraints(type)
    setForm(prev => ({
      ...prev,
      wizardType: prev.wizardType === type ? null : type,
      attribution: constraints.attribution === 'required' ? true : defaults.attribution,
      allowDerivatives: constraints.derivatives === 'required' ? true : defaults.rights.includes('create-derivatives'),
      supply: defaults.supply,
      duration: 'perpetual',
      territory: defaults.territory,
      showAdvanced: false,
      paymentInterval: defaults.paymentInterval,
      // A recurring V1 license must be sold through Marketplace to initialize
      // its base amount. Mint it to the connected owner first; the detail page
      // then exposes the contextual List action.
      licensee: defaults.paymentInterval > 0 ? address : prev.licensee,
    }))
  }, [address])

  const update = useCallback(<K extends keyof WizardForm>(key: K, val: WizardForm[K]) => {
    setForm(prev => ({ ...prev, [key]: val }))
  }, [])

  const selectAssetForLicense = useCallback((tokenId: string) => {
    setForm(current => ({ ...current, ipAssetId: tokenId, visibility: null }))
    setPrivateFile(null)
    void clearPreparedPrivateContent()
  }, [clearPreparedPrivateContent])

  const selectLicenseVisibility = useCallback((visibility: LicenseVisibility) => {
    setForm(current => ({ ...current, visibility }))
    setPrivateFile(null)
    void clearPreparedPrivateContent()
  }, [clearPreparedPrivateContent])

  const selectPrivateDeliverable = useCallback((next: File | null) => {
    if (next && !privateContentFileIsValid(next)) {
      setSignError(t.privateContent.tooLarge)
      setPrivateFile(null)
      return
    }
    setSignError('')
    setPrivateFile(next)
    void clearPreparedPrivateContent()
  }, [clearPreparedPrivateContent, t.privateContent.tooLarge])

  // Build the license params from wizard state
  const licenseParams = useMemo(() => {
    if (!form.wizardType) return null
    const profile = resolveWizardProfile(form.wizardType, {
      attribution: form.attribution,
      allowDerivatives: form.allowDerivatives,
    })
    const defaults = getSmartDefaults(form.wizardType)
    let rights: CopyrightRight[] = [...defaults.rights]
    if (!profile.allowDerivatives) {
      rights = rights.filter(r => r !== 'create-derivatives')
    }
    if (profile.allowDerivatives && !rights.includes('create-derivatives')) {
      rights.push('create-derivatives')
    }
    const expiryTimestamp = durationToTimestamp(form.duration, form.customExpiryDate)
    const durationDays = form.duration === 'custom' ? 0 : (DURATION_TO_DAYS[form.duration] ?? 0)

    return {
      licensor: address,
      licensee: form.licensee,
      ipAssetId: form.ipAssetId,
      licenseType: profile.licenseType,
      rights,
      commercial: defaults.commercial,
      territory: form.territory,
      attribution: profile.attribution,
      exclusive: defaults.isExclusive,
      durationDays,
      expiryTimestamp: expiryTimestamp || undefined,
      supply: form.supply,
      customTerms: form.customTerms || undefined,
    }
  }, [form, address])

  // Document preview
  const generatedDoc = useMemo(() => {
    if (!licenseParams) return null
    try { return generateCopyrightLicense(licenseParams) } catch { return null }
  }, [licenseParams])

  // Step validation
  const canProceedStep1 = form.wizardType !== null
  const selectedAsset = assets.find(asset => String(asset.tokenId) === form.ipAssetId)
  const licenseVisibility = form.visibility ?? defaultLicenseVisibility(
    selectedAsset?.privateContentCid ? 'confidential' : 'public',
  )
  const activeExclusiveLicense = selectedAssetLicenses.some(license => license.isActive && license.isExclusive)
  const availabilityReason = form.wizardType && selectedAsset
    ? getLicenseAvailabilityReason({
        wizardType: form.wizardType,
        hasActiveDispute: selectedAsset.hasActiveDispute,
        activeExclusiveLicense,
        existingLicenseCount: selectedAssetLicenses.length,
      })
    : null
  const customDateValid = form.duration !== 'custom' || (
    !!form.customExpiryDate && durationToTimestamp('custom', form.customExpiryDate) > Math.floor(openedAtMs / 1000)
  )
  const validLicensee = isValidAddress(form.licensee) && !/^0x0{40}$/i.test(form.licensee)
  // Self-licensing is valid in the deployed contract and useful when the IP
  // owner wants the initial ERC-1155 token before listing or transferring it.
  const canProceedStep2 = Boolean(
    validLicensee && selectedAsset && customDateValid && !licensesLoading && !licensesError && !availabilityReason
      && (licenseVisibility === 'public' || privateFile),
  )

  // Step 3: sign + upload
  const handleSignAndUpload = async () => {
    if (!generatedDoc || !licenseParams) return
    if (licenseVisibility === 'confidential' && !privateFile) {
      setSignError(t.privateContent.confidentialLicenseFileRequired)
      return
    }
    setSignError('')
    setIsSigning(true)
    try {
      const docHash = computeDocumentHash(generatedDoc)
      const message = buildSignMessage({
        licensor: address,
        licensee: form.licensee,
        ipAssetId: form.ipAssetId,
        hash: docHash,
      })
      const signature = await signMessageAsync({ message })
      const signedDoc = wrapWithSignature(generatedDoc, address, signature, docHash)

      let uri: string
      if (isIPFSConfigured()) {
        const cid = await uploadJson(signedDoc)
        uri = `ipfs://${cid}`
      } else {
        const json = JSON.stringify(signedDoc)
        uri = `data:application/json;base64,${btoa(json)}`
      }
      await clearPreparedPrivateContent()
      if (licenseVisibility === 'confidential' && privateFile) {
        const encrypted = await uploadEncryptedPrivateContent(privateFile)
        let recovery
        try {
          recovery = await createPrivateContentRecovery({
            kind: 'license',
            chainId: ACTIVE_CHAIN_ID,
            contractAddress: CONTRACT_ADDRESSES.LicenseToken,
            walletAddress: address,
            cid: encrypted.cid,
          }, encrypted.aesKeyB64)
        } catch (cause) {
          await unpinFile(encrypted.cid).catch(() => undefined)
          throw cause
        }
        setPrivateRecoveryId(recovery.id)
        setPreparedPrivateContent({ file: privateFile, ...encrypted })
      }
      setMetadataURI(uri)
      setStep(4)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('User rejected') || msg.includes('user rejected')) {
        setSignError(w.sigCancelled)
      } else {
        setSignError(msg || t.createLicense.failToast)
      }
    } finally {
      setIsSigning(false)
    }
  }

  // Step 4: mint
  const handleMint = async () => {
    if (!form.wizardType || !licenseParams) return
    setMintError('')
    mintDoneRef.current = false
    const expiryTimestamp = durationToTimestamp(form.duration, form.customExpiryDate)
    txToast.start(w.mintButton)
    try {
      const prepared = prepareLicenseMint({
        wizardType: form.wizardType,
        licensor: address,
        attribution: form.attribution,
        allowDerivatives: form.allowDerivatives,
        ipAssetId: form.ipAssetId,
        licensee: form.licensee,
        supply: form.supply,
        publicMetadataURI: metadataURI,
        privateMetadataURI: preparedPrivateContent ? `ipfs://${preparedPrivateContent.cid}` : '',
        expiryTime: expiryTimestamp,
        paymentInterval: form.paymentInterval,
      })
      await mintLicense(...prepared.args)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (!msg.includes('User rejected') && !msg.includes('user rejected')) {
        setMintError(msg || t.createLicense.failToast)
      } else {
        setMintError(w.txCancelled)
      }
      txToast.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  // Progress toast: tx submitted → advance to confirming
  useEffect(() => {
    if (hash) txToast.onHash(hash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash])

  useEffect(() => {
    if (!hash || !privateRecoveryId) return
    void updatePrivateContentRecovery(privateRecoveryId, { txHash: hash })
  }, [hash, privateRecoveryId])

  // Progress toast: confirmed → advance to indexing + notify parent
  useEffect(() => {
    if (!isSuccess || mintDoneRef.current) return
    mintDoneRef.current = true
    txToast.onConfirmed(w.mintSuccess)
    setTimeout(() => onSuccess(), 8000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess])

  // If mint succeeded, show success
  const mintDone = isSuccess && hash

  const handleClose = useCallback(() => {
    // Before minting, prepared ciphertext is only a draft and should be
    // unpinned. After minting, retain it so the issuer can finish key binding.
    if (!mintDone) void clearPreparedPrivateContent()
    onClose()
  }, [mintDone, clearPreparedPrivateContent, onClose])

  // The deployed wrapper emits LicenseRegistered. Keep LicenseMinted as a
  // backwards-compatible fallback for older testnet receipts and ABIs.
  const newLicenseId = useMemo(
    () => mintReceipt?.logs ? extractRegisteredLicenseId(mintReceipt.logs) : undefined,
    [mintReceipt],
  )

  useEffect(() => {
    if (!mintDone || newLicenseId !== undefined || licenseVisibility !== 'confidential') return
    const timer = window.setTimeout(() => setIdResolutionTimedOut(true), 15_000)
    return () => window.clearTimeout(timer)
  }, [licenseVisibility, mintDone, newLicenseId])

  useEffect(() => {
    if (newLicenseId === undefined || !hash || !privateRecoveryId) return
    void updatePrivateContentRecovery(privateRecoveryId, { txHash: hash, subjectId: newLicenseId })
  }, [hash, newLicenseId, privateRecoveryId])

  const cardBorder = (selected: boolean, disabled?: boolean) => ({
    backgroundColor: selected ? 'color-mix(in srgb, var(--gold) 6%, transparent)' : 'var(--bg-elev)',
    border: `1px solid ${selected ? 'var(--gold)' : 'var(--line)'}`,
    opacity: disabled ? 0.4 : 1,
    cursor: disabled ? 'not-allowed' as const : 'pointer' as const,
  })

  // Step indicator
  const stepLabels = [w.stepType, w.stepParams, w.stepPreview, w.stepMint]

  const renderStepIndicator = () => (
    <div className="wizard-progress">
      {stepLabels.map((label, i) => {
        const stepNum = (i + 1) as Step
        const isComplete = step > stepNum
        const isCurrent = step === stepNum
        const isClickable = isComplete
        return (
          <div key={i} className="flex items-center flex-1">
            <button
              type="button"
              onClick={() => isClickable && setStep(stepNum)}
              disabled={!isClickable}
              className="flex items-center gap-1.5 text-xs font-medium"
              style={{ color: isCurrent ? 'var(--gold-text)' : isComplete ? 'var(--ink-2)' : 'var(--ink-4)', cursor: isClickable ? 'pointer' : 'default' }}
            >
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{
                backgroundColor: isCurrent ? 'var(--gold)' : isComplete ? 'color-mix(in srgb, var(--gold) 20%, transparent)' : 'var(--bg-elev-2)',
                color: isCurrent ? 'var(--bg)' : isComplete ? 'var(--gold-text)' : 'var(--ink-4)',
              }}>
                {isComplete ? <Check className="w-3.5 h-3.5" /> : stepNum}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < 3 && <div className="flex-1 h-px mx-1.5" style={{ backgroundColor: isComplete ? 'var(--gold)' : 'var(--line)' }} />}
          </div>
        )
      })}
    </div>
  )

  // =========== STEP 1: Choose Type ===========
  const renderStep1 = () => {
    const types: { key: WizardType; icon: typeof Gift; title: string; tag: string; bullets: string[]; badge: string; disabled?: boolean }[] = [
      { key: 'free-use', icon: Gift, title: w.freeUse, tag: w.freeUseTag, bullets: [w.freeUseBullet1, w.freeUseBullet2, w.freeUseBullet3], badge: w.badgeFree },
      { key: 'personal-use', icon: User, title: w.personalUse, tag: w.personalUseTag, bullets: [w.personalUseBullet1, w.personalUseBullet2, w.personalUseBullet3], badge: w.badgeFree },
      { key: 'commercial', icon: Briefcase, title: w.commercialLabel, tag: w.commercialTag, bullets: [w.commercialBullet1, w.commercialBullet2, w.commercialBullet3], badge: w.badgeOneTime },
      { key: 'exclusive', icon: Crown, title: w.exclusiveLabel, tag: w.exclusiveTag, bullets: [w.exclusiveBullet1, w.exclusiveBullet2, w.exclusiveBullet3], badge: w.badgePremium },
      { key: 'sole', icon: Crown, title: w.soleLabel, tag: w.soleTag, bullets: [w.soleBullet1, w.soleBullet2, w.soleBullet3], badge: w.badgePremium },
      { key: 'share-alike', icon: Gift, title: w.shareAlikeLabel, tag: w.shareAlikeTag, bullets: [w.shareAlikeBullet1, w.shareAlikeBullet2, w.shareAlikeBullet3], badge: w.badgeFree },
    ]

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {types.map(({ key, icon: Icon, title, tag, bullets, badge, disabled }) => {
            const selected = form.wizardType === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => !disabled && selectType(key)}
                className="choice-card text-left p-3 rounded-sm transition-all relative"
                data-selected={selected || undefined}
                style={cardBorder(selected, disabled)}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-4 h-4" style={{ color: selected ? 'var(--gold-text)' : 'var(--ink-2)' }} />
                  <span className="text-xs font-semibold" style={{ color: selected ? 'var(--gold-text)' : 'var(--ink)' }}>{title}</span>
                </div>
                <p className="text-[11px] mb-1.5" style={{ color: 'var(--ink-4)' }}>{tag}</p>
                <ul className="space-y-0.5 mb-2">
                  {bullets.map((b, i) => (
                    <li key={i} className="text-[11px] flex items-center gap-1" style={{ color: 'var(--ink-2)' }}>
                      <Check className="w-2.5 h-2.5 flex-shrink-0" style={{ color: 'var(--gold-text)' }} />{b}
                    </li>
                  ))}
                </ul>
                <span className="text-[11px] px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: 'color-mix(in srgb, var(--gold) 12%, transparent)', color: 'var(--gold-text)' }}>{badge}</span>
              </button>
            )
          })}
        </div>
        <div className="flex justify-end pt-1">
          <Button size="sm" disabled={!canProceedStep1} onClick={() => setStep(2)} rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>
            {w.stepParams}
          </Button>
        </div>
      </div>
    )
  }

  // =========== STEP 2: Parameters ===========
  const renderStep2 = () => {
    const defaults = form.wizardType ? getSmartDefaults(form.wizardType) : null
    const isPersonal = form.wizardType === 'personal-use'
    const constraints = form.wizardType ? getWizardConstraints(form.wizardType) : null

    return (
      <div className="space-y-3">
        {/* An asset-card/detail action is already scoped to one IP. The global
            License action remains the only entry point that shows a picker. */}
        {hasFixedAsset ? (
          <ContextualEntitySummary
            label={w.licenseAssetSelectionLabel}
            title={selectedAsset?.title || (selectedAsset ? 'Untitled' : undefined)}
            subtitle={selectedAsset ? `${t.modals.ipAsset} #${selectedAsset.tokenId}${selectedAsset.category ? ` · ${selectedAsset.category}` : ''}` : undefined}
            imageUrl={selectedAsset?.imageUrl}
            fallbackIcon={workTypeIcon(selectedAsset?.category)}
            isLoading={assetsLoading && !selectedAsset}
            unavailableText={w.contextAssetUnavailable}
          />
        ) : (
        <div data-testid="license-asset-picker">
          <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--ink-2)' }}>{w.ipAssetIdLabel}</label>
          {assetsLoading ? (
            <div className="space-y-1">
              {[0,1,2].map(i => <div key={i} className="animate-pulse rounded-sm h-10" style={{ backgroundColor: 'var(--bg-elev-2)' }} />)}
            </div>
          ) : assets.length === 0 ? (
            <p className="text-xs py-3 text-center" style={{ color: 'var(--ink-4)' }}>{t.ipSection.noAssets}</p>
          ) : (
            <div className="rounded-sm overflow-hidden max-h-56 overflow-y-auto" style={{ border: '1px solid var(--line)' }}>
              {assets.map((asset, idx) => {
                const selected = form.ipAssetId === String(asset.tokenId)
                const FallbackIcon = workTypeIcon(asset.category)
                return (
                  <button
                    key={String(asset.tokenId)}
                    type="button"
                    onClick={() => selectAssetForLicense(String(asset.tokenId))}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors"
                    style={{
                      backgroundColor: selected ? 'color-mix(in srgb, var(--gold) 8%, transparent)' : 'transparent',
                      borderTop: idx === 0 ? 'none' : '1px solid var(--line)',
                    }}
                  >
                    <div className="w-9 h-9 rounded flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ backgroundColor: 'var(--bg-elev-2)' }}>
                      {asset.imageUrl
                        ? <img src={asset.imageUrl} alt="" className="w-full h-full object-cover" />
                        : <FallbackIcon className="w-4 h-4" style={{ color: 'var(--ink-4)' }} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium truncate leading-tight" style={{ color: selected ? 'var(--gold-text)' : 'var(--ink)' }}>{asset.title || 'Untitled'}</p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--ink-4)' }}>
                        #{String(asset.tokenId)}{asset.category ? ` · ${asset.category}` : ''}
                      </p>
                    </div>
                    {selected && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--gold-text)' }} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        )}

        {/* Confidentiality inherits from the selected IP but remains explicit. */}
        <fieldset>
          <legend className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>
            {t.privateContent.licenseVisibilityTitle}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'public' as const, icon: Globe2, title: t.privateContent.publicLicenseTitle, description: t.privateContent.publicLicenseDescription },
              { value: 'confidential' as const, icon: Lock, title: t.privateContent.confidentialLicenseTitle, description: t.privateContent.confidentialLicenseDescription },
            ]).map((option) => {
              const selected = licenseVisibility === option.value
              const Icon = option.icon
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectLicenseVisibility(option.value)}
                  className="p-2.5 text-left rounded-sm"
                  style={{
                    background: selected ? 'color-mix(in srgb, var(--gold) 9%, var(--bg-elev-2))' : 'var(--bg-elev-2)',
                    border: `1px solid ${selected ? 'var(--gold-deep)' : 'var(--line)'}`,
                  }}
                >
                  <span className="flex items-center gap-1.5 text-[11px] font-bold mb-1" style={{ color: selected ? 'var(--gold-text)' : 'var(--ink)' }}>
                    <Icon className="w-3.5 h-3.5" /> {option.title}
                  </span>
                  <span className="block text-[10px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>{option.description}</span>
                </button>
              )
            })}
          </div>
          {selectedAsset?.privateContentCid && (
            <p className="text-[10px] mt-1.5" style={{ color: 'var(--ink-2)' }}>
              <Lock className="w-3 h-3 inline mr-1" style={{ color: 'var(--gold-text)' }} />
              {t.privateContent.inheritedConfidential}
            </p>
          )}
        </fieldset>

        {licenseVisibility === 'confidential' && (
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--ink-2)' }}>
              {t.privateContent.licenseDeliverable}
            </label>
            <label className="flex items-center justify-center gap-2 p-3 cursor-pointer rounded-sm" style={{ border: '1px dashed var(--line)', background: 'var(--bg-elev-2)' }}>
              <Upload className="w-4 h-4" style={{ color: 'var(--gold-text)' }} />
              <span className="text-[11px] truncate" style={{ color: privateFile ? 'var(--ink)' : 'var(--ink-3)' }}>
                {privateFile ? privateFile.name : t.privateContent.pickConfidentialDeliverable}
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.zip,.png,.jpg,.jpeg"
                onChange={(event) => selectPrivateDeliverable(event.target.files?.[0] ?? null)}
              />
            </label>
            <p className="text-[10px] mt-1" style={{ color: 'var(--ink-3)' }}>{t.privateContent.licenseDeliverableHint}</p>
          </div>
        )}

        {/* Licensee */}
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--ink-2)' }}>{w.licenseeAddress}</label>
          <input
            type="text"
            value={form.licensee}
            onChange={e => update('licensee', e.target.value)}
            placeholder="0x..."
            className="input"
            required
            disabled={form.paymentInterval > 0}
          />
          {form.licensee && !validLicensee && (
            <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{t.createLicense.invalidAddress}</p>
          )}
          {form.paymentInterval > 0 && (
            <p className="text-[10px] mt-1" style={{ color: 'var(--ink-3)' }}>{t.licenseInterval.recurringRecipientHelp}</p>
          )}
        </div>

        {/* Attribution toggle */}
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--ink-2)' }}>{w.requireAttribution}</label>
          <div className="flex gap-2">
            {[true, false].map(val => {
              const disabled = constraints?.attribution === 'required' && !val
              return (
              <button key={String(val)} type="button" onClick={() => !disabled && update('attribution', val)} disabled={disabled}
                className="flex-1 py-2.5 rounded-sm text-sm font-medium transition-all"
                style={{ backgroundColor: form.attribution === val ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : 'var(--bg-elev-2)', color: form.attribution === val ? 'var(--gold-text)' : 'var(--ink-4)', border: `1px solid ${form.attribution === val ? 'var(--gold)' : 'var(--line)'}`, opacity: disabled ? 0.4 : 1 }}
              >
                {val ? w.yes : w.no}
              </button>
              )
            })}
          </div>
        </div>

        {/* Derivatives toggle */}
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--ink-2)' }}>{w.allowDerivatives}</label>
          <div className="flex gap-2">
            {[true, false].map(val => {
              const disabled = constraints?.derivatives === 'required' && !val
              return (
              <button key={String(val)} type="button" onClick={() => !disabled && update('allowDerivatives', val)} disabled={disabled}
                className="flex-1 py-2.5 rounded-sm text-sm font-medium transition-all"
                style={{ backgroundColor: form.allowDerivatives === val ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : 'var(--bg-elev-2)', color: form.allowDerivatives === val ? 'var(--gold-text)' : 'var(--ink-4)', border: `1px solid ${form.allowDerivatives === val ? 'var(--gold)' : 'var(--line)'}`, opacity: disabled ? 0.4 : 1 }}
              >
                {val ? w.yes : w.no}
              </button>
              )
            })}
          </div>
        </div>

        {/* Locked badge for personal use */}
        {(isPersonal || constraints?.attribution === 'required' || constraints?.derivatives === 'required') && (
          <div className="text-xs px-3 py-2 rounded-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--gold) 6%, transparent)', color: 'var(--gold-text)', border: '1px solid color-mix(in srgb, var(--gold) 20%, transparent)' }}>
            {isPersonal ? w.nonCommercialLocked : w.profileTermsLocked}
          </div>
        )}

        {/* Duration */}
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--ink-2)' }}>{w.durationLabel}</label>
          <div className="flex flex-wrap gap-1.5">
            {(['perpetual', '1y', '3y', '5y', 'custom'] as const).map(d => (
              <button key={d} type="button" onClick={() => update('duration', d)}
                className="px-3 py-2 rounded-sm text-xs font-medium transition-all"
                style={{ backgroundColor: form.duration === d ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : 'var(--bg-elev-2)', color: form.duration === d ? 'var(--gold-text)' : 'var(--ink-4)', border: `1px solid ${form.duration === d ? 'var(--gold)' : 'var(--line)'}` }}
              >
                {d === 'perpetual' ? w.perpetual : d === '1y' ? w.year1 : d === '3y' ? w.year3 : d === '5y' ? w.year5 : w.customDuration}
              </button>
            ))}
          </div>
          {form.duration === 'custom' && (
            <>
              <input type="date" value={form.customExpiryDate} onChange={e => update('customExpiryDate', e.target.value)}
                min={new Date(openedAtMs + 86400000).toISOString().split('T')[0]}
                className="input mt-2" />
              {!customDateValid && <p className="text-[10px] mt-1" style={{ color: 'var(--danger)' }}>{w.customDateRequired}</p>}
            </>
          )}
        </div>

        {/* Advanced options */}
        <button type="button" onClick={() => update('showAdvanced', !form.showAdvanced)}
          className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
          {form.showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {w.advancedOptions}
        </button>

        {form.showAdvanced && (
          <div className="space-y-3 pl-3" style={{ borderLeft: '2px solid var(--line)' }}>
            {/* Supply */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--ink-2)' }}>{w.supplyLabel}</label>
              <input type="number" value={form.supply} onChange={e => update('supply', Math.max(1, Math.min(1000000, Number(e.target.value) || 1)))}
                min={1} max={1000000} className="input" disabled={defaults?.isExclusive || form.paymentInterval > 0} />
              {defaults?.isExclusive && <p className="text-[10px] mt-1" style={{ color: 'var(--ink-4)' }}>{w.exclusiveSupplyLocked}</p>}
              {!defaults?.isExclusive && form.paymentInterval > 0 && <p className="text-[10px] mt-1" style={{ color: 'var(--ink-4)' }}>{t.licenseInterval.recurringSupplyLocked}</p>}
            </div>

            {/* Territory */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--ink-2)' }}>{w.territoryLabel}</label>
              <select value={form.territory} onChange={e => update('territory', e.target.value)}
                className="input">
                {TERRITORY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            {/* Custom terms */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--ink-2)' }}>{w.customTermsLabel}</label>
              <textarea value={form.customTerms} onChange={e => update('customTerms', e.target.value.slice(0, 5000))}
                rows={3} className="input resize-none" />
            </div>
          </div>
        )}

        {/* Auto-configured info */}
        {defaults && !form.showAdvanced && (
          <div className="text-xs p-3 rounded-sm" style={{ backgroundColor: 'var(--bg-elev-2)', color: 'var(--ink-4)' }}>
            {w.autoConfigured}: {w.supplyLabel}: {defaults.supply} / {w.territoryLabel}: {defaults.territory}
          </div>
        )}

        {/* Payment interval picker — commercial and exclusive only */}
        {(form.wizardType === 'commercial' || form.wizardType === 'exclusive' || form.wizardType === 'sole') && (
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--ink-2)' }}>{t.licenseInterval.label}</label>
              <select
                value={form.paymentInterval}
                onChange={e => {
                  const paymentInterval = Number(e.target.value)
                  setForm(current => ({
                    ...current,
                    paymentInterval,
                    ...(paymentInterval > 0 ? { supply: 1, licensee: address } : {}),
                  }))
                }}
                className="input"
              >
                <option value={0}>{t.licenseInterval.oneTime}</option>
                <option value={2_592_000}>{t.licenseInterval.monthly}</option>
                <option value={31_536_000}>{t.licenseInterval.annual}</option>
              </select>
            </div>

            <div
              className="flex items-start gap-2.5 rounded-sm px-3 py-2.5"
              style={{ backgroundColor: 'var(--bg-elev-2)', border: '1px solid var(--line)' }}
            >
              <CreditCard className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--gold-text)' }} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{t.licenseInterval.amountLabel}</span>
                  <span className="mono text-[10px]" style={{ color: 'var(--ink-3)' }}>{t.licenseInterval.amountSetInMarketplace}</span>
                </div>
                <p className="text-[10px] leading-relaxed mt-1" style={{ color: 'var(--ink-3)' }}>
                  {form.paymentInterval > 0
                    ? t.licenseInterval.recurringAmountHelp
                    : t.licenseInterval.oneTimeAmountHelp}
                </p>
              </div>
            </div>
          </div>
        )}

        {(licensesLoading || licensesError || availabilityReason) && (
          <div role={(licensesError || availabilityReason) ? 'alert' : 'status'} className="text-[11px] px-3 py-2 rounded-sm" style={{
            backgroundColor: (licensesError || availabilityReason) ? 'color-mix(in srgb, var(--danger) 8%, transparent)' : 'var(--bg-elev-2)',
            color: (licensesError || availabilityReason) ? 'var(--danger)' : 'var(--ink-4)',
            border: `1px solid ${(licensesError || availabilityReason) ? 'color-mix(in srgb, var(--danger) 25%, var(--line))' : 'var(--line)'}`,
          }}>
            {licensesLoading
              ? w.checkingAvailability
              : licensesError
                ? <>{w.availabilityUnavailable}{' '}<button type="button" className="underline font-semibold" onClick={() => { void refetchLicenses() }}>{w.retryAvailability}</button></>
                : availabilityReason === 'active-dispute'
                  ? w.blockedActiveDispute
                  : availabilityReason === 'exclusive-conflict'
                    ? w.blockedExclusive
                    : w.blockedMaxLicenses}
          </div>
        )}

        {/* Economic parameters context line */}
        <div className="text-[11px] px-3 py-2 rounded-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--gold) 5%, transparent)', color: 'var(--ink-4)', border: '1px solid color-mix(in srgb, var(--gold) 15%, transparent)' }}>
          {isLoadingRoyalty ? w.econParamsLoading : (
            w.econParams
              .replace('{royalty}', defaultRoyaltyBps !== undefined ? (Number(defaultRoyaltyBps) / 100).toFixed(2).replace(/\.00$/, '') : '—')
              .replace('{penalty}', (DEFAULT_PENALTY_RATE_BPS / 100).toFixed(2).replace(/\.00$/, ''))
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-1">
          <Button size="sm" variant="outline" onClick={() => setStep(1)} leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
            {w.stepType}
          </Button>
          <Button size="sm" disabled={!canProceedStep2} onClick={() => setStep(3)} rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>
            {w.stepPreview}
          </Button>
        </div>
      </div>
    )
  }

  // Preview
  const renderStep3 = () => {
    if (!generatedDoc || !licenseParams) return null
    const doc = generatedDoc as {
      metadata?: { license_type_label?: string }
      clauses?: Array<{ title: string; body: string; clause_number: number | string }>
    }
    const clauses = doc.clauses ?? []
    const expiryTs = durationToTimestamp(form.duration, form.customExpiryDate)
    const durationText = expiryTs === 0 ? w.perpetual : new Date(expiryTs * 1000).toLocaleDateString()

    return (
      <div className="space-y-3">
        <p className="text-[11px]" style={{ fontStyle: 'italic', color: 'var(--ink-4)' }}>{w.previewIntro}</p>

        {/* Summary box */}
        <div className="rounded p-2.5 space-y-1" style={{ color: 'var(--ink-3)', background: 'var(--bg-elev-2)', border: '1px solid var(--line)' }}>
          <h4 className="mono text-[11px] font-bold mb-1.5" style={{ color: 'var(--gold-text)', letterSpacing: '0.05em' }}>{w.previewSummary}</h4>
          {[
            [w.previewType, doc.metadata?.license_type_label],
            [w.previewLicensor, shortenAddress(address)],
            [w.previewLicensee, shortenAddress(form.licensee)],
            [w.previewIpAsset, `#${form.ipAssetId}`],
            [w.previewDuration, durationText],
            [t.licenseInterval.label, form.paymentInterval === 0
              ? t.licenseInterval.oneTime
              : form.paymentInterval === 2_592_000
                ? t.licenseInterval.monthly
                : t.licenseInterval.annual],
            [t.licenseInterval.amountLabel, t.licenseInterval.amountSetInMarketplace],
            [w.previewTerritory, form.territory],
            [w.previewCommercial, licenseParams.commercial ? w.allowed : w.notAllowed],
            [w.previewDerivatives, licenseParams.rights.includes('create-derivatives') ? w.allowed : w.notAllowed],
            [w.previewAttribution, licenseParams.attribution ? w.required : w.notRequired],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-[11px]">
              <span style={{ color: 'var(--ink-3)' }}>{label}</span>
              <span className="font-medium" style={{ color: 'var(--ink)' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Contract defaults; penalty can be changed later. */}
        <div
          className="rounded p-2.5 text-[10px] leading-relaxed"
          style={{
            color: 'var(--ink-4)',
            background: 'color-mix(in srgb, var(--gold) 5%, transparent)',
            border: '1px solid color-mix(in srgb, var(--gold) 15%, transparent)',
          }}
        >
          <p className="mono font-bold mb-1" style={{ color: 'var(--gold-text)', letterSpacing: '0.05em' }}>
            {w.previewPlatformParams}
          </p>
          <div className="flex justify-between"><span>{w.platformParamsPenalty}</span><span className="mono">{(DEFAULT_PENALTY_RATE_BPS / 100).toFixed(2)}% / 30d overdue</span></div>
          <div className="flex justify-between"><span>{w.platformParamsMaxMissed}</span><span className="mono">{DEFAULT_MAX_MISSED_PAYMENTS} {w.platformParamsMissedPaymentsShort}</span></div>
          <p className="mt-1" style={{ color: 'var(--ink-3)' }}>{w.platformParamsSource}</p>
        </div>

        {/* Expandable clauses */}
        <button type="button" onClick={() => setShowFullDoc(!showFullDoc)}
          className="flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--gold-text)' }}>
          {showFullDoc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {w.viewFullDocument} ({clauses.length} clauses)
        </button>

        {showFullDoc && (
          <div className="printed-page space-y-3">
            {clauses.map((clause, i) => (
              <div key={i}>
                <h5 className="mono text-[11px] font-bold mb-1" style={{ color: 'var(--gold-text)', letterSpacing: '0.05em' }}>
                  {clause.clause_number}. {clause.title}
                </h5>
                <p className="text-[11px]" style={{ color: 'var(--ink-2)', lineHeight: 1.6 }}>
                  {clause.body.length > 300 ? clause.body.slice(0, 300) + '...' : clause.body}
                </p>
              </div>
            ))}
          </div>
        )}

        {signError && <p className="text-[11px]" style={{ color: 'var(--danger)' }}>{signError}</p>}

        {/* Navigation */}
        <div className="flex justify-between pt-1">
          <Button size="sm" variant="outline" onClick={() => setStep(2)} leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
            {w.stepParams}
          </Button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSignAndUpload}
            disabled={isSigning}
          >
            {isSigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {w.signAndContinue}
          </button>
        </div>
      </div>
    )
  }

  // =========== STEP 4: Mint ===========
  const renderStep4 = () => {
    const isLoading = isPending || isConfirming

    if (mintDone) {
      return (
        <div className="space-y-3 py-2">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--gold) 12%, transparent)' }}>
              <Check className="w-5 h-5" style={{ color: 'var(--gold-text)' }} />
            </div>
            <p className="text-sm font-bold" style={{ color: 'var(--gold-text)' }}>{w.mintSuccess}</p>
            {hash && (
              <a href={getTxUrl(hash)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--gold-text)' }}>
                {w.viewOnExplorer} <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {newLicenseId !== undefined && (
              <a href={`/licenses/${newLicenseId}`} className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--gold-text)' }}>
                {w.viewLicense} <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          {form.paymentInterval > 0 && newLicenseId !== undefined && (
            <div className="rounded-sm px-3 py-2.5 text-[11px]" style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
              <p className="font-semibold" style={{ color: 'var(--ink)' }}>{t.licenseInterval.recurringSetupRequired}</p>
              <p className="mt-1 leading-relaxed">{t.licenseInterval.recurringSetupAfterMint}</p>
            </div>
          )}
          {licenseVisibility === 'confidential' && preparedPrivateContent && newLicenseId !== undefined ? (
            <PrivateContentUpload
              subject={{ kind: 'license', id: newLicenseId }}
              prepared={preparedPrivateContent}
              required
              onDone={() => {
                if (privateRecoveryId) void deletePrivateContentRecovery(privateRecoveryId)
                setPrivateRecoveryId(null)
                onSuccess(); onClose()
              }}
            />
          ) : licenseVisibility === 'confidential' && idResolutionTimedOut ? (
            <div className="space-y-2 py-3 text-center text-xs" role="alert" style={{ color: 'var(--danger)' }}>
              <p>{t.privateContent.idResolutionTimeout}</p>
              <p style={{ color: 'var(--ink-2)' }}>{t.privateContent.resumeAfterClose}</p>
              <Button size="sm" onClick={() => { onSuccess(); onClose() }}>{w.done}</Button>
            </div>
          ) : licenseVisibility === 'confidential' ? (
            <div className="flex items-center justify-center gap-2 py-3 text-xs" role="status" style={{ color: 'var(--ink-2)' }}>
              <Loader2 className="w-4 h-4 animate-spin" /> {t.privateContent.waitingForLicenseId}
            </div>
          ) : (
            <div className="pt-2 flex justify-center">
              <Button size="sm" onClick={() => { onSuccess(); onClose() }}>{w.done}</Button>
            </div>
          )}
        </div>
      )
    }

    const expiryTs = durationToTimestamp(form.duration, form.customExpiryDate)
    const durationText = expiryTs === 0 ? w.perpetual : new Date(expiryTs * 1000).toLocaleDateString()

    return (
      <div className="space-y-3">
        <h4 className="text-xs font-bold" style={{ color: 'var(--ink)' }}>{w.mintTitle}</h4>

        {/* Summary */}
        <div className="rounded p-2.5 space-y-1" style={{ backgroundColor: 'var(--bg-elev-2)', border: '1px solid var(--line)' }}>
          {[
            [w.previewIpAsset, `#${form.ipAssetId}`],
            [w.previewLicensee, shortenAddress(form.licensee)],
            [w.supplyLabel, String(form.supply)],
            [w.previewDuration, durationText],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-[11px]">
              <span style={{ color: 'var(--ink-4)' }}>{label}</span>
              <span className="font-medium" style={{ color: 'var(--ink)' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Status */}
        {isLoading && (
          <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--gold-text)' }}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {isPending ? w.mintWaiting : w.mintSubmitted}
          </div>
        )}

        {mintError && <p className="text-[11px]" style={{ color: 'var(--danger)' }}>{mintError}</p>}

        {/* Navigation */}
        <div className="flex justify-between pt-1">
          <Button size="sm" variant="outline" onClick={() => setStep(3)} disabled={isLoading} leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
            {w.stepPreview}
          </Button>
          <Button size="sm" onClick={handleMint} isLoading={isLoading} disabled={isLoading}>
            {w.mintButton}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Modal
      colors={_colors}
      title={w.title}
      onClose={handleClose}
      panelClassName="modal-panel--wizard"
      contentClassName="wizard-modal-body"
    >
        <div className="wizard-shell">
          {renderStepIndicator()}

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>
    </Modal>
  )
}
