import { useState, useMemo, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Key, Tag, Briefcase, Clock, Shield, FileText, ExternalLink,
  CreditCard, Ban, TimerOff, CheckCircle2, Settings, UserPlus, Gavel,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { usePreloadedData } from '@/contexts/data-preloader-context'
import {
  useInvalidateIndexedQueries,
  mapUserLicense,
  mapAsset,
  useIndexedPaymentStatus,
  useIndexedDisputesByLicense,
} from '@/hooks/useIndexed'
import type { IndexerLicenseRow, IndexerAssetRow } from '@/hooks/useIndexed'
import { fetchIndexer } from '@/lib/indexer'
import { formatTimestamp, CONTRACT_ADDRESSES, formatPrice, DisputeStatus } from '@/lib/contracts'
import { useTranslations } from '@/lib/i18n'
import { canDecryptPrivateContent } from '@/lib/private-content-domain'
import type { UserLicense, UserIPAsset } from '@/hooks/useContracts'
import {
  useRevokeForMissedPayments, useMarkExpired, useConcludeLicense,
  useSetLicensePenaltyRate, useGrantPrivateAccess, useRevokePrivateAccess,
  useGetMissedPayments, useGetTotalPaymentDue,
} from '@/hooks/useContracts'
import { useTxToast } from '@/hooks/useTxToast'
import { useDirectLicense } from '@/hooks/useDirectReads'
import { ChainDirectBadge } from '@/components/ChainDirectBadge'
import { useResilience } from '@/contexts/resilience-context'
import { useNow } from '@/hooks/useNow'
import { StatusSeal } from '@/pages/dashboard/components/StatusSeal'
import { RecurringPaymentButton } from '@/pages/dashboard/components/RecurringPaymentButton'
import { PrivateContentDownload } from '@/pages/dashboard/components/PrivateContentDownload'
import { LicenseContractModal } from '@/pages/dashboard/components/LicenseContractModal'
import { PrivateAccessEditor } from '@/pages/dashboard/components/PrivateAccessEditor'
import { IncomingOffersPanel } from '@/pages/dashboard/components/IncomingOffersPanel'
import { CreateListingModal } from '@/pages/dashboard/modals/CreateListingModal'
import {
  DetailActionRail,
  DetailBackLabel,
  DetailEmptyState,
  DetailErrorState,
  DetailLoadingState,
  DetailSection,
  EntityDetailShell,
  EntityHeader,
} from '@/components/detail/EntityDetail'

interface LicenseDetailResponse {
  data: IndexerLicenseRow & {
    balances: Array<{ holder: string; balance: number }>
  }
}

interface LicensePrivateAccessRow {
  grantee: string
  isActive: boolean
  grantor: string | null
  grantedAt: number | null
  grantTx: string | null
  grantBlock: number
  revokedAt: number | null
  revokeTx: string | null
  revokeBlock: number | null
}

const MetaRow = ({ icon: Icon, label, value, valueColor }: { icon: LucideIcon; label: string; value: string; valueColor?: string }) => (
  <div className="flex items-start gap-3 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
    <div className="flex items-center gap-2 w-28 flex-shrink-0">
      <Icon className="w-3.5 h-3.5" style={{ color: 'var(--ink-4)' }} />
      <span className="allcaps mono text-[10px]" style={{ color: 'var(--ink-4)' }}>{label}</span>
    </div>
    <span className="mono text-xs font-medium flex-1 break-all" style={{ color: valueColor ?? 'var(--ink)' }}>{value}</span>
  </div>
)

function IssuerActions({ license, onSuccess }: { license: UserLicense; onSuccess: () => void }) {
  const txToast = useTxToast()
  const invalidateIndexed = useInvalidateIndexedQueries()

  const revokeMissed = useRevokeForMissedPayments()
  const markExp = useMarkExpired()
  const conclude = useConcludeLicense()
  const penaltyHook = useSetLicensePenaltyRate()

  const [activeForm, setActiveForm] = useState<'penalty' | null>(null)
  const [penaltyInput, setPenaltyInput] = useState('')

  const hooks = [revokeMissed, markExp, conclude, penaltyHook] as const
  useEffect(() => { if (revokeMissed.hash) txToast.onHash(revokeMissed.hash) }, [revokeMissed.hash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (markExp.hash) txToast.onHash(markExp.hash) }, [markExp.hash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (conclude.hash) txToast.onHash(conclude.hash) }, [conclude.hash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (penaltyHook.hash) txToast.onHash(penaltyHook.hash) }, [penaltyHook.hash]) // eslint-disable-line react-hooks/exhaustive-deps

  const onHookSuccess = useCallback((msg: string) => {
    txToast.onConfirmed(msg)
    invalidateIndexed()
    onSuccess()
    setActiveForm(null)
  }, [invalidateIndexed, onSuccess, txToast])

  useEffect(() => {
    if (!revokeMissed.isSuccess) return
    const timer = window.setTimeout(() => onHookSuccess('Revoked for missed payments'), 0)
    return () => window.clearTimeout(timer)
  }, [onHookSuccess, revokeMissed.isSuccess])
  useEffect(() => {
    if (!markExp.isSuccess) return
    const timer = window.setTimeout(() => onHookSuccess('Marked expired'), 0)
    return () => window.clearTimeout(timer)
  }, [markExp.isSuccess, onHookSuccess])
  useEffect(() => {
    if (!conclude.isSuccess) return
    const timer = window.setTimeout(() => onHookSuccess('License concluded'), 0)
    return () => window.clearTimeout(timer)
  }, [conclude.isSuccess, onHookSuccess])
  useEffect(() => {
    if (!penaltyHook.isSuccess) return
    const timer = window.setTimeout(() => onHookSuccess('Penalty rate updated'), 0)
    return () => window.clearTimeout(timer)
  }, [onHookSuccess, penaltyHook.isSuccess])

  const action = async (label: string, fn: () => Promise<unknown>) => {
    txToast.start(label)
    try { await fn() } catch (err) { txToast.onError(err instanceof Error ? err : new Error(String(err))) }
  }

  const btnClass = "w-full flex items-center gap-2 px-3 py-2 rounded-sm text-[11px] font-medium transition-all hover:opacity-80"
  const btnStyle = { backgroundColor: 'var(--bg-elev)', color: 'var(--ink)', border: '1px solid var(--line)' }
  const anyPending = hooks.some(h => h.isPending)

  return (
    <div className="space-y-1.5">
      {license.paymentInterval > 0n && license.isActive && (
        <button disabled={anyPending} onClick={() => action('Revoking license', () => revokeMissed.revokeForMissedPayments(license.licenseId))} className={btnClass} style={btnStyle}>
          <Ban className="w-3.5 h-3.5" style={{ color: 'var(--danger)' }} /> Revoke (Missed Payments)
        </button>
      )}
      {license.isActive && license.expiryTime > 0n && (
        <button disabled={anyPending} onClick={() => action('Marking expired', () => markExp.markExpired(license.licenseId))} className={btnClass} style={btnStyle}>
          <TimerOff className="w-3.5 h-3.5" style={{ color: 'var(--warn)' }} /> Mark Expired
        </button>
      )}
      {license.isActive && (
        <button disabled={anyPending} onClick={() => action('Concluding license', () => conclude.concludeLicense(license.licenseId))} className={btnClass} style={btnStyle}>
          <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--ok)' }} /> Conclude License
        </button>
      )}

      <button onClick={() => setActiveForm(activeForm === 'penalty' ? null : 'penalty')} className={btnClass} style={btnStyle}>
        <Settings className="w-3.5 h-3.5" style={{ color: 'var(--gold-text)' }} /> Set Penalty Rate
      </button>
      {activeForm === 'penalty' && (
        <div className="flex gap-2 px-1">
          <input type="number" placeholder="BPS (e.g. 500 = 5%)" value={penaltyInput} onChange={e => setPenaltyInput(e.target.value)}
            className="input flex-1 text-[11px] py-1.5 px-2" />
          <button disabled={anyPending || !penaltyInput} onClick={() => action('Setting penalty rate', () => penaltyHook.setPenaltyRate(license.licenseId, Number(penaltyInput)))}
            className="btn btn-primary btn-sm text-[11px]">Set</button>
        </div>
      )}

    </div>
  )
}

function LicensePrivateFileAccess({ license, onSuccess }: { license: UserLicense; onSuccess: () => void }) {
  const { t } = useTranslations()
  const txToast = useTxToast()
  const invalidateIndexed = useInvalidateIndexedQueries()
  const grantHook = useGrantPrivateAccess()
  const revokeHook = useRevokePrivateAccess()
  const [open, setOpen] = useState(false)
  const [address, setAddress] = useState('')

  useEffect(() => { if (grantHook.hash) txToast.onHash(grantHook.hash) }, [grantHook.hash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (revokeHook.hash) txToast.onHash(revokeHook.hash) }, [revokeHook.hash]) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback((message: string) => {
    txToast.onConfirmed(message)
    invalidateIndexed()
    onSuccess()
    setOpen(false)
    setAddress('')
  }, [invalidateIndexed, onSuccess, txToast])

  useEffect(() => {
    if (!grantHook.isSuccess) return
    const timer = window.setTimeout(() => finish(t.ipSection.messages.accessGranted), 0)
    return () => window.clearTimeout(timer)
  }, [finish, grantHook.isSuccess, t.ipSection.messages.accessGranted])
  useEffect(() => {
    if (!revokeHook.isSuccess) return
    const timer = window.setTimeout(() => finish(t.ipSection.messages.accessRevoked), 0)
    return () => window.clearTimeout(timer)
  }, [finish, revokeHook.isSuccess, t.ipSection.messages.accessRevoked])

  const submit = async (label: string, operation: () => Promise<unknown>) => {
    txToast.start(label)
    try {
      await operation()
    } catch (error) {
      txToast.onError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-sm text-[11px] font-medium transition-all hover:opacity-80"
        style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--ink)', border: '1px solid var(--line)' }}
      >
        <UserPlus className="w-3.5 h-3.5" style={{ color: 'var(--gold-text)' }} />
        {t.ipSection.licenseActions.privateAccess}
      </button>
      {open && (
        <PrivateAccessEditor
          scope="license"
          value={address}
          onChange={setAddress}
          isInactiveLicense={!license.isActive}
          isGranting={grantHook.isPending || grantHook.isConfirming}
          isRevoking={revokeHook.isPending || revokeHook.isConfirming}
          onClose={() => { setOpen(false); setAddress('') }}
          onGrant={(account) => submit(t.tx.grantingAccess, () => grantHook.grantPrivateAccess(license.licenseId, account))}
          onRevoke={(account) => submit(t.tx.revokingAccess, () => revokeHook.revokePrivateAccess(license.licenseId, account))}
        />
      )}
    </div>
  )
}

// Issuer-only grantee ledger for license-level private access.
function LicenseAccessSchedule({ licenseId, issuerAddress }: { licenseId: bigint; issuerAddress: string }) {
  const { t } = useTranslations()
  const { data, isLoading, error } = useQuery({
    queryKey: ['license-private-access', licenseId.toString(), issuerAddress.toLowerCase()],
    queryFn: () =>
      fetchIndexer<{ data: LicensePrivateAccessRow[] }>(
        `/api/private-access?targetType=license&targetId=${licenseId.toString()}`,
      ).then((r) => r.data),
    staleTime: 15_000,
  })

  const rows = data ?? []

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)', background: 'var(--bg-elev-2)' }}>
        <div className="allcaps mono" style={{ color: 'var(--ink-3)' }}>
          {t.licenseDetail.accessLedger.title}
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
          {t.licenseDetail.accessLedger.subtitle}
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div
            className="animate-spin w-5 h-5 rounded-full border-2 border-current border-t-transparent mx-auto"
            style={{ color: 'var(--gold-text)' }}
          />
        </div>
      ) : error ? (
        <div style={{ padding: '20px 18px', textAlign: 'center', color: 'var(--danger)', fontSize: 13 }}>
          {error instanceof Error ? error.message : t.licenseDetail.accessLedger.error}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
          {t.licenseDetail.accessLedger.empty}
        </div>
      ) : (
        rows.map((row, i) => {
          const ts = row.isActive ? row.grantedAt : row.revokedAt
          const block = row.isActive ? row.grantBlock : row.revokeBlock
          return (
            <div
              key={row.grantee + i}
              style={{
                padding: '12px 18px',
                borderBottom: i === rows.length - 1 ? undefined : '1px solid var(--line-2)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="mono text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                  {row.grantee}
                </div>
                <div className="flex items-center gap-2 mono mt-0.5" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
                  {block !== null && <span className="tnum">#{block}</span>}
                  {ts && (
                    <>
                      <span>·</span>
                      <span>{new Date(ts * 1000).toLocaleString()}</span>
                    </>
                  )}
                </div>
              </div>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{
                  backgroundColor: row.isActive
                    ? 'color-mix(in srgb, var(--ok) 12%, transparent)'
                    : 'color-mix(in srgb, var(--ink-3) 12%, transparent)',
                  color: row.isActive ? 'var(--ok)' : 'var(--ink-3)',
                }}
              >
                {row.isActive ? t.licenseDetail.accessLedger.statusActive : t.licenseDetail.accessLedger.statusRevoked}
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}

export default function LicenseDetailPage() {
  const nowMs = useNow()
  const { licenseId: licenseIdParam } = useParams<{ licenseId: string }>()
  const [searchParams] = useSearchParams()
  const { colors } = useTheme()
  const { t } = useTranslations()
  const invalidateIndexed = useInvalidateIndexedQueries()
  const { assets, licenses, heldLicenses, allListings, address, refetchLicenses } = usePreloadedData()

  const licenseId = licenseIdParam && /^\d+$/.test(licenseIdParam) ? BigInt(licenseIdParam) : undefined
  const returnContext = searchParams.get('from')
  const backLink = returnContext === 'judicial'
    ? '/judicial'
    : returnContext === 'held'
      ? '/licenses?view=held'
      : '/licenses'

  useEffect(() => {
    if (licenseId === undefined) return
    const existing = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    const canonical = existing ?? document.createElement('link')
    const previousHref = existing?.href
    canonical.rel = 'canonical'
    canonical.href = `${window.location.origin}/licenses/${licenseId.toString()}`
    if (!existing) document.head.appendChild(canonical)
    return () => {
      if (!existing) canonical.remove()
      else if (previousHref) existing.href = previousHref
    }
  }, [licenseId])

  const preloadedLicense = useMemo(
    () => licenseId !== undefined
      ? licenses.find(l => l.licenseId === licenseId) ?? heldLicenses.find(l => l.licenseId === licenseId)
      : undefined,
    [licenses, heldLicenses, licenseId],
  )

  const {
    data: fetchedData,
    isLoading: isFetching,
    isError: isFetchError,
    refetch: refetchLicense,
  } = useQuery({
    queryKey: ['license-detail', licenseIdParam],
    queryFn: () => fetchIndexer<LicenseDetailResponse>(`/api/licenses/${licenseIdParam}`).then(r => r.data),
    enabled: !preloadedLicense && licenseId !== undefined,
    staleTime: 30_000,
  })

  const indexedLicense: UserLicense | undefined = preloadedLicense ?? (() => {
    if (!fetchedData) return undefined
    const mapped = mapUserLicense(fetchedData)
    if (address && fetchedData.balances) {
      const userBal = fetchedData.balances.find(b => b.holder.toLowerCase() === address.toLowerCase())
      return { ...mapped, balance: userBal ? BigInt(userBal.balance) : 0n }
    }
    return mapped
  })()

  const { indexerHealth } = useResilience()
  const needsDirectRead = isFetchError || indexerHealth !== 'healthy'
  const { license: directLicense, isLoading: directLoading } = useDirectLicense(licenseId, needsDirectRead)

  const isDirectRead = needsDirectRead && !!directLicense

  const license: UserLicense | undefined = useMemo(
    () => isDirectRead && directLicense ? {
      ...indexedLicense,
      licenseId: directLicense.licenseId,
      ipAssetId: directLicense.ipAssetId,
      supply: directLicense.supply,
      expiryTime: directLicense.expiryTime,
      terms: directLicense.terms,
      paymentInterval: directLicense.paymentInterval,
      isExclusive: directLicense.isExclusive,
      isRevoked: directLicense.isRevoked,
      isExpired: directLicense.isExpired,
      isConcluded: false,
      isActive: !directLicense.isRevoked && !directLicense.isExpired,
      publicMetadataURI: indexedLicense?.publicMetadataURI ?? '',
      title: indexedLicense?.title ?? directLicense.title,
      balance: indexedLicense?.balance ?? directLicense.supply,
    } : indexedLicense,
    [isDirectRead, directLicense, indexedLicense],
  )

  const preloadedParent = useMemo(
    () => license ? assets.find(a => a.tokenId === license.ipAssetId) : undefined,
    [assets, license],
  )

  const { data: fetchedParent } = useQuery({
    queryKey: ['asset-detail', license?.ipAssetId?.toString()],
    queryFn: () => fetchIndexer<{ data: IndexerAssetRow }>(`/api/assets/${license!.ipAssetId.toString()}`).then(r => mapAsset(r.data)),
    enabled: !preloadedParent && !!license,
    staleTime: 30_000,
  })

  const parentAsset: UserIPAsset | undefined = preloadedParent ?? fetchedParent

  const isIssuer = !!(address && parentAsset?.owner && parentAsset.owner.toLowerCase() === address.toLowerCase())
  const isHolder = !!(address && (
    heldLicenses.some(l => l.licenseId === licenseId) ||
    fetchedData?.balances?.some(b => b.holder.toLowerCase() === address.toLowerCase() && b.balance > 0)
  ))
  const role: 'issuer' | 'holder' | 'public' = isIssuer ? 'issuer' : isHolder ? 'holder' : 'public'
  const { data: privateAccess } = useQuery({
    queryKey: ['private-content-access', licenseId?.toString(), address?.toLowerCase()],
    queryFn: async () => {
      if (!licenseId || !address) return { license: false, asset: false }
      const [licenseRows, assetRows] = await Promise.all([
        fetchIndexer<{ data: Array<{ account: string }> }>(
          `/api/private-access?targetType=license&targetId=${licenseId.toString()}&account=${address}`,
        ),
        fetchIndexer<{ data: Array<{ account: string }> }>(
          `/api/private-access?targetType=ip_asset&targetId=${license?.ipAssetId.toString()}&account=${address}`,
        ),
      ])
      return { license: licenseRows.data.length > 0, asset: assetRows.data.length > 0 }
    },
    enabled: !!licenseId && !!license && !!address,
    staleTime: 15_000,
  })
  const activeHolder = role === 'holder' && !!license?.isActive
  const canDecryptLicenseContent = canDecryptPrivateContent({
    isOwner: role === 'issuer',
    hasActiveLicense: activeHolder,
    hasExplicitGrant: privateAccess?.license === true,
  })
  const canDecryptAssetContent = canDecryptPrivateContent({
    isOwner: role === 'issuer',
    hasActiveLicense: activeHolder,
    hasExplicitGrant: privateAccess?.asset === true,
  })
  const { data: missedPayments } = useGetMissedPayments(
    CONTRACT_ADDRESSES.LicenseToken,
    licenseId ?? 0n,
    { enabled: licenseId !== undefined },
  )
  const { data: paymentStatus } = useIndexedPaymentStatus(licenseId !== undefined ? Number(licenseId) : undefined)
  const isRecurringLicense = (license?.paymentInterval ?? 0n) > 0n
  const { data: paymentDue } = useGetTotalPaymentDue(
    CONTRACT_ADDRESSES.LicenseToken,
    licenseId ?? 0n,
    { enabled: licenseId !== undefined && isRecurringLicense },
  )
  const activeLicenseListing = useMemo(
    () => licenseId === undefined ? undefined : allListings.find(listing =>
      listing.isActive
      && !listing.isERC721
      && listing.tokenId === licenseId
      && listing.nftContract.toLowerCase() === CONTRACT_ADDRESSES.LicenseToken.toLowerCase()
      && listing.sellerHasToken !== false
    ),
    [allListings, licenseId],
  )

  // Approved disputes explain arbitration-driven revocations. Fetch errors are
  // displayed explicitly rather than represented as an empty docket.
  const { disputes: licenseDisputes, isError: licenseDisputesError, refetch: refetchLicenseDisputes } = useIndexedDisputesByLicense(licenseId)

  const [showContract, setShowContract] = useState(false)
  const [showListing, setShowListing] = useState(false)

  if (isFetching || directLoading) {
    return <DetailLoadingState label={t.licenseDetail.loading} />
  }

  if (isFetchError && !license) {
    return <DetailErrorState
      title={t.licenseDetail.unavailable}
      message={t.licenseDetail.unavailableHint}
      retry={<button type="button" className="btn btn-primary btn-sm" onClick={() => { void refetchLicense() }}>{t.licenseDetail.retry}</button>}
      back={<Link to={backLink} className="btn btn-ghost btn-sm"><DetailBackLabel>{t.licenseDetail.back}</DetailBackLabel></Link>}
    />
  }

  if (!license) {
    return <DetailEmptyState
      title={t.licenseDetail.notFound.replace('{id}', licenseIdParam ?? '')}
      message={t.licenseDetail.notFoundHint}
      action={<Link to={backLink} className="btn btn-ghost btn-sm"><DetailBackLabel>{t.licenseDetail.back}</DetailBackLabel></Link>}
    />
  }

  const now = BigInt(Math.floor(nowMs / 1000))
  const daysLeft = license.expiryTime === 0n ? null : Number(license.expiryTime - now) / 86400
  const payDays = license.paymentInterval > 0n ? Number(license.paymentInterval) / 86400 : null
  const isRecurring = license.paymentInterval > 0n
  const basePaymentAmount = paymentDue?.[0] ?? 0n
  const paymentPenalty = paymentDue?.[1] ?? 0n
  const totalPaymentDue = paymentDue?.[2] ?? 0n

  const status: 'active' | 'expired' | 'revoked' = license.isRevoked ? 'revoked' : (license.isExpired || license.isConcluded) ? 'expired' : 'active'
  const statusSeal = license.isConcluded
    ? <span className="seal seal-registered">{t.licenseDetail.concluded}</span>
    : <StatusSeal status={status} size="sm" context="license" />

  const handleActionSuccess = () => {
    refetchLicenses()
    invalidateIndexed()
  }

  return (
    <EntityDetailShell
      className="animate-fade-in-up"
      breadcrumbs={<Link to={backLink}><DetailBackLabel>{t.licenseDetail.back}</DetailBackLabel></Link>}
      header={<EntityHeader
        eyebrow={<span className="inline-flex items-center gap-1.5"><Key className="w-3.5 h-3.5" />{t.licenseDetail.eyebrow} #{license.licenseId.toString()}</span>}
        title={license.title}
        description={license.terms || t.licenseDetail.noTerms}
        media={parentAsset?.imageUrl
          ? <img src={parentAsset.imageUrl} alt={parentAsset.title} className="w-full h-full object-cover" />
          : <Key className="w-14 h-14" style={{ color: 'var(--ink-4)' }} />}
        status={<>{statusSeal}{isDirectRead && <ChainDirectBadge />}</>}
        metadata={<>
          {parentAsset && <Link to={`/assets/${parentAsset.tokenId.toString()}?from=licenses`} className="entity-header__meta-link"><Briefcase className="w-3 h-3" />{parentAsset.title}</Link>}
          <span>{t.common.supply}: {license.supply.toString()}</span>
          <span>{t.common.balance}: {license.balance.toString()}</span>
          {license.isExclusive && <span>{t.common.exclusive}</span>}
          {isRecurring && <span>{t.licenseDetail.recurring}</span>}
        </>}
      />}
      aside={<DetailActionRail title={t.licenseDetail.availableActions} primary={
        <button
          onClick={() => license.publicMetadataURI ? setShowContract(true) : undefined}
          disabled={!license.publicMetadataURI}
          title={!license.publicMetadataURI ? t.licenseDetail.noSignedDocument : undefined}
          className="btn btn-primary w-full"
        ><FileText className="w-3.5 h-3.5" />{t.licenseDetail.viewContract}</button>
      }>
        <div className="entity-action-rail__facts">
          <div><span>{t.licenseDetail.status}</span>{statusSeal}</div>
          <div><span>{t.licenseDetail.licenseId}</span><strong>#{license.licenseId.toString()}</strong></div>
        </div>
        {role !== 'public' && <div className="entity-action-rail__role"><Shield className="w-3.5 h-3.5" />{role === 'issuer' ? t.licenseDetail.issuer : t.licenseDetail.holder}</div>}
        {role === 'issuer' && license.isActive && <IssuerActions license={license} onSuccess={handleActionSuccess} />}
        {isHolder && <LicensePrivateFileAccess license={license} onSuccess={handleActionSuccess} />}
        {role === 'holder' && isRecurring && license.isActive && <RecurringPaymentButton colors={colors} licenseId={license.licenseId} onSuccess={handleActionSuccess} />}
        {role === 'holder' && license.isActive && (
          <button className="btn btn-ghost w-full" onClick={() => setShowListing(true)}>
            <Tag className="w-3.5 h-3.5" />{t.modals.createListing}
          </button>
        )}
        {canDecryptLicenseContent && license.privateContentCid && (
          <PrivateContentDownload
            subject={{ kind: 'license', id: Number(license.licenseId) }}
            cid={license.privateContentCid}
          />
        )}
        {canDecryptAssetContent && parentAsset?.privateContentCid && (
          <PrivateContentDownload
            subject={{ kind: 'asset', id: Number(parentAsset.tokenId) }}
            cid={parentAsset.privateContentCid}
          />
        )}
        <div id="offers" className="entity-offers-panel">
          <p className="allcaps mono entity-offers-panel__title">{t.incomingOffers.title}</p>
          <IncomingOffersPanel
            nftContract={CONTRACT_ADDRESSES.LicenseToken}
            tokenId={license.licenseId}
            canAccept={role === 'holder'}
          />
        </div>
      </DetailActionRail>}
    >
      <DetailSection title={t.licenseDetail.details}>
          <p className="allcaps mono text-[10px] mb-1 mt-4" style={{ color: 'var(--ink-4)' }}>License Details</p>
          <MetaRow icon={Tag} label="License ID" value={`#${license.licenseId.toString()}`} />
          <MetaRow icon={Briefcase} label="IP Asset" value={parentAsset ? `#${parentAsset.tokenId.toString()} — ${parentAsset.title}` : `#${license.ipAssetId.toString()}`} />
          <MetaRow icon={Key} label={t.common.supply} value={license.supply.toString()} />
          <MetaRow icon={Key} label={t.common.balance} value={`${license.balance.toString()} / ${license.supply.toString()}`} />
          <MetaRow icon={Clock} label={t.common.expiry} value={
            license.expiryTime === 0n ? t.common.perpetual
              : daysLeft !== null && daysLeft > 0 ? `${Math.floor(daysLeft)} days left (${formatTimestamp(license.expiryTime)})`
                : `Expired ${formatTimestamp(license.expiryTime)}`
          } valueColor={daysLeft !== null && daysLeft <= 0 ? '#ef4444' : undefined} />
          <MetaRow icon={CreditCard} label={t.common.payment} value={
            !isRecurring ? t.common.oneTime
              : payDays !== null && payDays >= 1
                ? t.licenseDetail.everyDays.replace('{count}', Math.floor(payDays).toString())
                : t.licenseDetail.everyHours.replace('{count}', Math.floor(Number(license.paymentInterval) / 3600).toString())
          } />
          <MetaRow icon={CreditCard} label={t.licenseDetail.paymentAmount} value={
            isRecurring && basePaymentAmount > 0n
              ? `${formatPrice(basePaymentAmount)} PAS · ${t.licenseDetail.baseInstallment}`
              : activeLicenseListing
                ? `${formatPrice(activeLicenseListing.price)} PAS · ${isRecurring ? t.licenseDetail.becomesBaseInstallment : t.licenseDetail.activeListingPrice}`
                : isRecurring
                  ? t.licenseDetail.recurringAmountNotInitialized
                  : t.licenseDetail.noActiveListingPrice
          } />
          {isRecurring && basePaymentAmount > 0n && paymentPenalty > 0n && (
            <MetaRow icon={CreditCard} label={t.licenseDetail.currentPenalty} value={`${formatPrice(paymentPenalty)} PAS`} valueColor="var(--danger)" />
          )}
          {isRecurring && basePaymentAmount > 0n && (
            <MetaRow icon={CreditCard} label={t.licenseDetail.totalDueNow} value={`${formatPrice(totalPaymentDue)} PAS`} />
          )}
          {isRecurring && basePaymentAmount > 0n && activeLicenseListing && (
            <MetaRow icon={Tag} label={t.licenseDetail.resaleListingPrice} value={`${formatPrice(activeLicenseListing.price)} PAS`} />
          )}
          {isRecurring && license.supply > 1n && (
            <div role="alert" className="mt-3 px-3 py-2.5 rounded-sm text-[11px] leading-relaxed" style={{ color: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 28%, var(--line))' }}>
              <strong>{t.licenseDetail.legacyRecurringWarningTitle}</strong>{' '}{t.licenseDetail.legacyRecurringWarning}
            </div>
          )}
          {license.penaltyRateBps !== undefined && (
            <MetaRow icon={Settings} label="Penalty Rate" value={`${(license.penaltyRateBps / 100).toFixed(2)}%`} />
          )}
          <MetaRow icon={ExternalLink} label={t.common.exclusive.charAt(0).toUpperCase() + t.common.exclusive.slice(1)} value={license.isExclusive ? t.common.yes : t.common.no} />

          {/* Issuer-managed private-access grants. */}
          {role === 'issuer' && address && (
            <div className="mt-5">
              <LicenseAccessSchedule
                licenseId={license.licenseId}
                issuerAddress={address}
              />
            </div>
          )}

          {/* Keep unavailable dispute data distinct from an empty docket. */}
          {(licenseDisputes.length > 0 || licenseDisputesError) && (
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-2">
                <Gavel className="w-3.5 h-3.5" style={{ color: 'var(--gold-text)' }} />
                <p className="allcaps mono text-[10px]" style={{ color: 'var(--ink-4)' }}>
                  {t.licenseDetail.disputeDocket.title}
                </p>
                {!licenseDisputesError && (
                  <span className="mono text-[10px]" style={{ color: 'var(--ink-4)' }}>
                    ({licenseDisputes.length})
                  </span>
                )}
              </div>
              {licenseDisputesError && (
                <div
                  className="mb-2 px-3 py-2 rounded-sm text-[11px]"
                  style={{
                    background: 'color-mix(in srgb, var(--warn) 10%, var(--bg-elev))',
                    border: '1px solid color-mix(in srgb, var(--warn) 35%, transparent)',
                    color: 'var(--warn)',
                  }}
                >
                  <div>{t.licenseDetail.disputeDocket.unavailable}</div>
                  <button
                    onClick={() => { void refetchLicenseDisputes() }}
                    className="mt-1.5 text-[10px] underline font-semibold"
                    style={{ color: 'var(--warn)' }}
                  >
                    {t.licenseDetail.disputeDocket.retry}
                  </button>
                </div>
              )}
              {license.isRevoked && (() => {
                const cause = licenseDisputes.find(d => d.status === DisputeStatus.Approved)
                if (!cause) return null
                return (
                  <div className="mb-2 px-3 py-2 rounded-sm text-[11px]" style={{
                    background: 'color-mix(in srgb, var(--danger) 8%, var(--bg-elev))',
                    border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
                    color: 'var(--danger)',
                  }}>
                    {t.licenseDetail.disputeDocket.revokedByPrefix}{' '}
                    <Link to={`/judicial/${cause.disputeId.toString()}?from=license`} className="underline font-semibold" style={{ color: 'var(--danger)' }}>
                      {t.licenseDetail.disputeDocket.revokedByLinkLabel} #{cause.disputeId.toString()}
                    </Link>
                    {cause.resolvedAt > 0n && (
                      <span style={{ color: 'var(--ink-4)' }}>
                        {' '}· {new Date(Number(cause.resolvedAt) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                )
              })()}
              <div className="space-y-1.5">
                {licenseDisputes.map(d => {
                  // Keep every contract dispute state mapped explicitly.
                  const sealStatus = ((): 'disputed' | 'awardGranted' | 'resolved' | 'revoked' | 'expired' => {
                    switch (d.status) {
                      case DisputeStatus.Pending:  return 'disputed'
                      case DisputeStatus.Approved: return 'awardGranted'
                      case DisputeStatus.Rejected: return 'resolved'
                      case DisputeStatus.Executed: return 'revoked'
                      case DisputeStatus.Expired:  return 'expired'
                      default: return 'disputed'
                    }
                  })()
                  return (
                    <Link
                      key={d.disputeId.toString()}
                      to={`/judicial/${d.disputeId.toString()}?from=license`}
                      className="flex items-center justify-between px-3 py-2 rounded-sm transition-opacity hover:opacity-80"
                      style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--line)' }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="mono text-[11px] font-semibold" style={{ color: 'var(--gold-text)' }}>
                          DSP-{new Date().getFullYear()}-{d.disputeId.toString().padStart(4, '0')}
                        </p>
                        <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--ink-3)' }}>
                          {d.reason ?? `Dispute #${d.disputeId.toString()}`}
                        </p>
                      </div>
                      <StatusSeal status={sealStatus} size="sm" />
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Payment timeline (recurring licenses) */}
          {isRecurring && (
            <div className="mt-5">
              <p className="allcaps mono text-[10px] mb-3" style={{ color: 'var(--ink-4)' }}>
                Payment History
              </p>

              {missedPayments !== undefined && missedPayments > 0n && (
                <div className="mb-3 px-3 py-2 rounded-sm text-[11px] font-medium" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {missedPayments.toString()} missed payment{missedPayments > 1n ? 's' : ''}
                </div>
              )}

              {paymentStatus?.nextPaymentDue && (
                <div className="mb-3 px-3 py-2 rounded-sm text-[11px]" style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--line)' }}>
                  <span style={{ color: 'var(--ink-4)' }}>Next due: </span>
                  <span className="font-medium" style={{ color: 'var(--ink)' }}>{new Date(paymentStatus.nextPaymentDue * 1000).toLocaleDateString()}</span>
                </div>
              )}

              {paymentStatus?.paymentHistory && paymentStatus.paymentHistory.length > 0 ? (
                <div className="space-y-2">
                  {paymentStatus.paymentHistory.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-sm" style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--line)' }}>
                      <div>
                        <p className="text-[11px] font-medium" style={{ color: 'var(--ink)' }}>
                          {formatPrice(BigInt(p.base_amount))} PAS
                          {BigInt(p.penalty) > 0n && <span style={{ color: '#ef4444' }}> + {formatPrice(BigInt(p.penalty))} penalty</span>}
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>
                          {p.payment_timestamp ? new Date(p.payment_timestamp * 1000).toLocaleDateString() : `Block ${p.block_number}`}
                        </p>
                      </div>
                      <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--ok)' }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center rounded-sm" style={{ border: '1px dashed var(--line)' }}>
                  <CreditCard className="w-5 h-5 mx-auto mb-1.5" style={{ color: 'var(--ink-4)' }} />
                  <p className="text-[11px]" style={{ color: 'var(--ink-4)' }}>No payments recorded</p>
                </div>
              )}
            </div>
          )}
      </DetailSection>

      {/* Contract modal */}
      {showContract && license.publicMetadataURI && (
        <LicenseContractModal
          colors={colors}
          licenseId={license.licenseId.toString()}
          publicMetadataURI={license.publicMetadataURI}
          onClose={() => setShowContract(false)}
        />
      )}
      {showListing && address && (
        <CreateListingModal
          colors={colors}
          address={address as `0x${string}`}
          initialItem={{ kind: 'license', tokenId: license.licenseId.toString() }}
          onClose={() => setShowListing(false)}
          onSuccess={() => {
            invalidateIndexed()
            setShowListing(false)
          }}
        />
      )}
    </EntityDetailShell>
  )
}
