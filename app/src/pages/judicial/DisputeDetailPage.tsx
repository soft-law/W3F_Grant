import { useState, useMemo, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Scale, Tag, User, Shield, Clock, ExternalLink,
  Coins, FileText, Gavel, ShieldOff, AlertTriangle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatEther } from 'viem'
import { useTheme } from '@/hooks/useTheme'
import { usePreloadedData } from '@/contexts/data-preloader-context'
import { useInvalidateIndexedQueries, mapFullDispute } from '@/hooks/useIndexed'
import type { IndexerDisputeRow } from '@/hooks/useIndexed'
import { fetchIndexer } from '@/lib/indexer'
import { DisputeStatus, shortenAddress, formatTimestamp } from '@/lib/contracts'
import { useTranslations } from '@/lib/i18n'
import {
  useHasRole, ARBITRATOR_ROLE, useExecuteAward, useClaimExpiredBond,
  useGetTimeRemaining, useIsDisputeOverdue, useGetDispute,
} from '@/hooks/useContracts'
import type { FullDispute } from '@/hooks/useContracts'
import { useTxToast } from '@/hooks/useTxToast'
import { useRefreshAfterWrite } from '@/hooks/useRefreshAfterWrite'
import { toastError } from '@/hooks/useToast'
import { useDirectDispute } from '@/hooks/useDirectReads'
import { ChainDirectBadge } from '@/components/ChainDirectBadge'
import { useResilience } from '@/contexts/resilience-context'
import { StatusSeal } from '@/pages/dashboard/components/StatusSeal'
import { ResolveModal } from '@/pages/dashboard/modals/ResolveModal'
import { Button } from '@/components/Button'
import { BondTimeline } from '@/components/BondTimeline'
import {
  DetailActionRail,
  DetailBackLabel,
  DetailEmptyState,
  DetailErrorState,
  DetailLoadingState,
  DetailSection,
  EntityDetailShell,
  EntityHeader,
} from '@/components/detail'

const MetaRow = ({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-3 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
    <div className="flex items-center gap-2 w-28 flex-shrink-0">
      <Icon className="w-3.5 h-3.5" style={{ color: 'var(--ink-4)' }} />
      <span className="allcaps mono text-[10px]" style={{ color: 'var(--ink-4)' }}>{label}</span>
    </div>
    <div className="mono text-xs font-medium flex-1 break-all" style={{ color: 'var(--ink)' }}>{children}</div>
  </div>
)

// Keep in lockstep with disputeStatusToSeal in JudicialSection.tsx.
function disputeStatusToSeal(status: number): 'disputed' | 'awardGranted' | 'revoked' | 'expired' | 'resolved' {
  switch (status) {
    case 0: return 'disputed'      // Pending — sub judice
    case 1: return 'awardGranted'  // Approved — award exists, enforcement pending
    case 2: return 'resolved'      // Rejected — no award; the license stands
    case 3: return 'revoked'       // Executed — license actually revoked by award
    case 4: return 'expired'
    default: return 'disputed'
  }
}

function disputeStatusLabel(status: number): string {
  switch (status) {
    case 0: return 'Pending'
    case 1: return 'Approved'
    case 2: return 'Rejected'
    case 3: return 'Executed'
    case 4: return 'Expired'
    default: return 'Unknown'
  }
}

function DisputeTimeline({ status }: { status: number }) {
  const stages = ['Filed', 'Reviewed', 'Resolved'] as const
  return (
    <div className="flex items-center gap-1 mt-1">
      {stages.map((stage, i) => {
        const isCurrent = status === 0 && i === 0
        return (
          <div key={stage} className="flex items-center gap-1">
            {i > 0 && <div className="w-4 h-px" style={{ backgroundColor: (status >= 1 && i <= 2) ? 'var(--ok)' : 'var(--line)' }} />}
            <div className="flex items-center gap-1">
              <div className="rounded-full" style={{
                width: 8, height: 8,
                backgroundColor: (status >= 1) ? 'var(--ok)' : isCurrent ? 'var(--gold)' : 'var(--line)',
              }} />
              <span className="text-[10px]" style={{
                color: (status >= 1) ? 'var(--ok)' : isCurrent ? 'var(--gold-text)' : 'var(--ink-4)',
              }}>{stage}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function DisputeDetailPage() {
  const { disputeId: disputeIdParam } = useParams<{ disputeId: string }>()
  const [searchParams] = useSearchParams()
  const { colors } = useTheme()
  const { t } = useTranslations()
  const invalidateIndexed = useInvalidateIndexedQueries()
  const { disputes, address } = usePreloadedData()
  const txToast = useTxToast()

  const disputeId = disputeIdParam && /^\d+$/.test(disputeIdParam) ? BigInt(disputeIdParam) : undefined

  useEffect(() => {
    if (disputeId === undefined) return
    const existing = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    const canonical = existing ?? document.createElement('link')
    const previousHref = existing?.href
    canonical.rel = 'canonical'
    canonical.href = `${window.location.origin}/judicial/${disputeId.toString()}`
    if (!existing) document.head.appendChild(canonical)
    return () => {
      if (!existing) canonical.remove()
      else if (previousHref) existing.href = previousHref
    }
  }, [disputeId])

  const preloadedDispute = useMemo(
    () => disputeId !== undefined ? disputes.find(d => d.disputeId === disputeId) : undefined,
    [disputes, disputeId],
  )

  const {
    data: fetchedDispute,
    isLoading: isFetching,
    isError: isFetchError,
    refetch: refetchDispute,
  } = useQuery({
    queryKey: ['dispute-detail', disputeIdParam],
    queryFn: () => fetchIndexer<{ data: IndexerDisputeRow }>(`/api/disputes/${disputeIdParam}`).then(r => mapFullDispute(r.data)),
    enabled: disputeId !== undefined,
    staleTime: 30_000,
  })

  const indexedDispute: FullDispute | undefined = fetchedDispute ?? (preloadedDispute ? {
    disputeId: preloadedDispute.disputeId,
    disputeType: preloadedDispute.disputeType,
    ipAssetId: BigInt(preloadedDispute.ipAssetId ?? 0),
    licenseId: preloadedDispute.licenseId,
    submitter: '',
    ipOwner: '',
    awardRecipient: '',
    reason: preloadedDispute.reason,
    proofURI: '',
    status: preloadedDispute.status,
    submittedAt: preloadedDispute.submittedAt,
    resolvedAt: 0n,
    bondAmount: 0n,
    resolver: '',
    resolutionReason: '',
    isExpired: preloadedDispute.isExpired,
    bondReleased: preloadedDispute.bondReleased,
  } : undefined)

  const { indexerHealth } = useResilience()
  const needsDirectRead = isFetchError || indexerHealth !== 'healthy'
  const { dispute: directDispute, isLoading: directLoading } = useDirectDispute(disputeId, needsDirectRead)

  const isDirectRead = needsDirectRead && !!directDispute

  const dispute: FullDispute | undefined = isDirectRead && directDispute ? {
    disputeId: directDispute.disputeId,
    disputeType: directDispute.disputeType,
    ipAssetId: directDispute.ipAssetId,
    licenseId: directDispute.licenseId,
    submitter: directDispute.submitter,
    ipOwner: directDispute.ipOwner,
    awardRecipient: directDispute.awardRecipient,
    reason: directDispute.reason,
    proofURI: directDispute.proofURI,
    status: directDispute.status,
    submittedAt: directDispute.submittedAt,
    resolvedAt: directDispute.resolvedAt,
    bondAmount: directDispute.bondAmount,
    resolver: directDispute.resolver,
    resolutionReason: directDispute.resolutionReason,
    isExpired: false,
    bondReleased: false,
  } : indexedDispute

  const { data: isArbitratorData } = useHasRole('GovernanceArbitrator', ARBITRATOR_ROLE, address)
  const isArbitrator = !!isArbitratorData

  const { data: timeRemaining } = useGetTimeRemaining(disputeId ?? 0n, { enabled: disputeId !== undefined })
  const { data: isOverdue } = useIsDisputeOverdue(disputeId ?? 0n, { enabled: disputeId !== undefined })

  // Fetch fresh chain state before privileged dispute actions.
  const { refetch: refetchChainDispute } = useGetDispute(
    disputeId ?? 0n,
    { staleTime: 0, enabled: disputeId !== undefined },
  )

  const isSubmitter = !!(address && dispute?.submitter && dispute.submitter.toLowerCase() === address.toLowerCase())
  const isIpOwner = !!(address && dispute?.ipOwner && dispute.ipOwner.toLowerCase() === address.toLowerCase())
  const role: 'arbitrator' | 'submitter' | 'ipOwner' | 'public' =
    isArbitrator ? 'arbitrator' : isSubmitter ? 'submitter' : isIpOwner ? 'ipOwner' : 'public'
  const returnContext = searchParams.get('from')
  const backLink = returnContext === 'license' && dispute
    ? `/licenses/${dispute.licenseId.toString()}?from=issued`
    : '/judicial'

  const executeAward = useExecuteAward()
  const claimBond = useClaimExpiredBond()

  useEffect(() => { if (executeAward.hash) txToast.onHash(executeAward.hash) }, [executeAward.hash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (executeAward.isSuccess) txToast.onConfirmed(t.disputes.licenseRevoked)
  }, [executeAward.isSuccess]) // eslint-disable-line react-hooks/exhaustive-deps
  useRefreshAfterWrite(executeAward.isSuccess, {
    refetches: [refetchChainDispute],
    invalidateIndexed,
  })

  useEffect(() => { if (claimBond.hash) txToast.onHash(claimBond.hash) }, [claimBond.hash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (claimBond.isSuccess) txToast.onConfirmed(t.disputes.bondClaimed)
  }, [claimBond.isSuccess]) // eslint-disable-line react-hooks/exhaustive-deps
  useRefreshAfterWrite(claimBond.isSuccess, {
    refetches: [refetchChainDispute],
    invalidateIndexed,
  })

  const [showResolve, setShowResolve] = useState(false)

  if (isFetching && !dispute) {
    return <DetailLoadingState label={t.disputes.detailLoading} />
  }

  if (!dispute) {
    const back = <Link to={backLink} className="btn btn-ghost btn-sm"><DetailBackLabel>{t.disputes.detailBack}</DetailBackLabel></Link>
    if (isFetchError && !directDispute && !directLoading) {
      return (
        <DetailErrorState
          title={t.disputes.detailUnavailable}
          message={t.disputes.detailTryAgain}
          retry={<button type="button" className="btn btn-primary btn-sm" onClick={() => { void refetchDispute() }}>{t.common.retry}</button>}
          back={back}
        />
      )
    }
    if (!directLoading) {
      return (
        <DetailEmptyState
          title={t.disputes.detailNotFound.replace('{id}', disputeIdParam ?? '')}
          message={t.disputes.detailNotFoundHint}
          action={back}
        />
      )
    }
    return <DetailLoadingState label={t.disputes.detailLoading} />
  }

  const sealStatus = disputeStatusToSeal(dispute.status)
  const statusLabel = disputeStatusLabel(dispute.status)
  const isLicenseDispute = dispute.disputeType === 0
  const targetId = isLicenseDispute ? dispute.licenseId.toString() : dispute.ipAssetId.toString()
  const targetLink = isLicenseDispute ? `/licenses/${targetId}?from=judicial` : `/assets/${targetId}?from=judicial`
  const targetLabel = isLicenseDispute ? `License #${targetId}` : `IP Asset #${targetId}`
  const typeLabel = isLicenseDispute ? 'License Dispute' : 'IP Dispute'
  const daysRemaining = timeRemaining !== undefined ? Number(timeRemaining) / 86400 : null

  // Display gates use indexed state; every write still performs the fresh
  // chain pre-flight immediately before submission. Actions are independent:
  // an address holding more than one role must not lose an available remedy.
  const hasDisputeActions =
    (role === 'arbitrator' && dispute.status === DisputeStatus.Pending)
    || (!!address && dispute.status === DisputeStatus.Approved)
    || (isSubmitter && !!isOverdue && dispute.status === DisputeStatus.Pending)
  const disputeActions = (
    <div className="grid gap-2">
      {role === 'arbitrator' && dispute.status === DisputeStatus.Pending && (
        <Button
          onClick={async () => {
            const fresh = await refetchChainDispute()
            if (fresh.data?.status !== DisputeStatus.Pending) {
              toastError(t.disputes.alreadyResolved)
              return
            }
            setShowResolve(true)
          }}
          leftIcon={<Gavel className="w-3.5 h-3.5" />}
        >
          {t.disputes.resolve}
        </Button>
      )}
      {address && dispute.status === DisputeStatus.Approved && (
        <Button
          onClick={async () => {
            const fresh = await refetchChainDispute()
            if (fresh.data?.status !== DisputeStatus.Approved) {
              toastError(t.disputes.notApprovedForEnforce)
              return
            }
            txToast.start(t.tx.enforcingRevocation)
            try { await executeAward.executeAward(dispute.disputeId) }
            catch (err) { txToast.onError(err instanceof Error ? err : new Error(String(err))) }
          }}
          isLoading={executeAward.isPending}
          leftIcon={<ShieldOff className="w-3.5 h-3.5" />}
        >
          {t.disputes.enforceRevocation}
        </Button>
      )}
      {isSubmitter && isOverdue && dispute.status === DisputeStatus.Pending && (
        <Button
          onClick={async () => {
            const fresh = await refetchChainDispute()
            if (fresh.data?.status !== DisputeStatus.Pending) {
              toastError(t.disputes.alreadyResolved)
              return
            }
            txToast.start(t.tx.claimingBond)
            try { await claimBond.claimExpiredBond(dispute.disputeId) }
            catch (err) { txToast.onError(err instanceof Error ? err : new Error(String(err))) }
          }}
          isLoading={claimBond.isPending}
          leftIcon={<Coins className="w-3.5 h-3.5" />}
        >
          {t.disputes.claimBond}
        </Button>
      )}
    </div>
  )

  return (
    <EntityDetailShell
      className="animate-fade-in-up"
      breadcrumbs={<Link to={backLink} className="transition-opacity hover:opacity-70"><DetailBackLabel>{t.disputes.detailBack}</DetailBackLabel></Link>}
      header={(
        <EntityHeader
          eyebrow={typeLabel}
          title={`${t.disputes.detailTitle} #${dispute.disputeId.toString()}`}
          description={dispute.reason || t.disputes.detailNoReason}
          status={<>{<StatusSeal status={sealStatus} size="sm" />}{isDirectRead && <ChainDirectBadge />}</>}
          metadata={(
            <>
              <Link to={targetLink} className="transition-opacity hover:opacity-70" style={{ color: 'var(--gold-text)' }}>
                <Tag className="inline w-3 h-3 mr-1" />{targetLabel}
              </Link>
              <span>{statusLabel}</span>
              {dispute.submittedAt > 0n && <span>{formatTimestamp(dispute.submittedAt)}</span>}
            </>
          )}
        />
      )}
      aside={(
        <DetailActionRail title={t.disputes.detailCaseStatus} primary={hasDisputeActions ? disputeActions : undefined}>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="allcaps mono text-[10px]" style={{ color: 'var(--ink-4)' }}>Status</span>
              <StatusSeal status={sealStatus} size="sm" />
            </div>
            <div className="flex justify-between items-center">
              <span className="allcaps mono text-[10px]" style={{ color: 'var(--ink-4)' }}>Dispute ID</span>
              <span className="mono tnum text-[11px] font-bold" style={{ color: 'var(--ink)' }}>#{dispute.disputeId.toString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="allcaps mono text-[10px]" style={{ color: 'var(--ink-4)' }}>Type</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{
                backgroundColor: 'color-mix(in srgb, var(--gold) 12%, transparent)', color: 'var(--gold-text)',
              }}>{typeLabel}</span>
            </div>
            {dispute.bondAmount > 0n && (
              <div className="flex justify-between items-center">
                <span className="allcaps mono text-[10px]" style={{ color: 'var(--ink-4)' }}>Bond</span>
                <span className="mono tnum text-[11px] font-bold" style={{ color: 'var(--gold-text)' }}>
                  {Number(formatEther(dispute.bondAmount)).toFixed(2)} PAS
                </span>
              </div>
            )}
            {daysRemaining !== null && dispute.status === DisputeStatus.Pending && (
              <div className="flex justify-between items-center">
                <span className="allcaps mono text-[10px]" style={{ color: 'var(--ink-4)' }}>Time Left</span>
                <span className="mono tnum text-[11px] font-bold" style={{
                  color: daysRemaining <= 3 ? 'var(--danger)' : 'var(--ink)',
                }}>
                  {daysRemaining > 0 ? `${Math.floor(daysRemaining)}d ${Math.floor((daysRemaining % 1) * 24)}h` : 'Overdue'}
                </span>
              </div>
            )}
            <DisputeTimeline status={dispute.status} />
          </div>
          {role !== 'public' && (
            <div className="rounded-sm px-3 py-2 text-center text-[11px] font-semibold mt-3" style={{
              backgroundColor: role === 'arbitrator' ? 'rgba(139,92,246,0.10)' : 'color-mix(in srgb, var(--gold) 10%, transparent)',
              color: role === 'arbitrator' ? '#8b5cf6' : 'var(--gold-text)',
              border: `1px solid ${role === 'arbitrator' ? 'rgba(139,92,246,0.25)' : 'color-mix(in srgb, var(--gold) 25%, transparent)'}`,
            }}>
              <Shield className="w-3.5 h-3.5 inline mr-1.5" />
              {role === 'arbitrator' ? 'Arbitrator' : role === 'submitter' ? 'Submitter' : 'IP Owner'}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {(dispute.isExpired || dispute.status === DisputeStatus.Expired) && (
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                backgroundColor: 'color-mix(in srgb, var(--ink-3) 12%, transparent)', color: 'var(--ink-3)',
              }}>{t.disputes.status.expired}</span>
            )}
            {dispute.bondReleased && dispute.status !== DisputeStatus.Pending && (
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                backgroundColor: 'color-mix(in srgb, var(--ok) 12%, transparent)', color: 'var(--ok)',
              }}>{t.disputes.bondReleased}</span>
            )}
            {isOverdue && dispute.status === DisputeStatus.Pending && (
              <span className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-0.5" style={{
                backgroundColor: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)',
              }}>
                <AlertTriangle className="w-2.5 h-2.5" /> {t.disputes.overdue}
              </span>
            )}
          </div>
        </DetailActionRail>
      )}
    >
      <DetailSection title={t.disputes.detailDetails}>
          <MetaRow icon={Tag} label="Dispute ID">
            <span className="mono tnum">#{dispute.disputeId.toString()}</span>
          </MetaRow>
          <MetaRow icon={Scale} label="Type">
            {typeLabel}
          </MetaRow>
          <MetaRow icon={Tag} label="Target">
            <Link to={targetLink} className="transition-opacity hover:opacity-70" style={{ color: 'var(--gold-text)' }}>
              {targetLabel}
            </Link>
          </MetaRow>
          <MetaRow icon={User} label="Submitter">
            {dispute.submitter ? shortenAddress(dispute.submitter) : '—'}
          </MetaRow>
          <MetaRow icon={User} label="IP Owner">
            {dispute.ipOwner ? shortenAddress(dispute.ipOwner) : '—'}
          </MetaRow>
          <MetaRow icon={Clock} label="Filed">
            {dispute.submittedAt > 0n ? formatTimestamp(dispute.submittedAt) : '—'}
          </MetaRow>
          {dispute.bondAmount > 0n && (
            <MetaRow icon={Coins} label="Bond">
              <span className="mono tnum">{Number(formatEther(dispute.bondAmount)).toFixed(4)} PAS</span>
            </MetaRow>
          )}

          {/* Proof URI */}
          {dispute.proofURI && (
            <MetaRow icon={FileText} label="Evidence">
              <a
                href={dispute.proofURI}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 transition-opacity hover:opacity-70"
                style={{ color: 'var(--gold-text)' }}
              >
                View proof <ExternalLink className="w-3 h-3" />
              </a>
            </MetaRow>
          )}
      </DetailSection>

      <DetailSection title={t.disputes.detailBondHistory}>
        <BondTimeline disputeId={dispute.disputeId} />
      </DetailSection>

      {dispute.status !== DisputeStatus.Pending && dispute.resolvedAt > 0n && (
        <DetailSection title={t.disputes.detailResolution}>
              <div className="space-y-2">
                <MetaRow icon={Clock} label="Resolved">
                  {formatTimestamp(dispute.resolvedAt)}
                </MetaRow>
                {dispute.resolver && (
                  <MetaRow icon={Shield} label="Resolver">
                    {shortenAddress(dispute.resolver)}
                  </MetaRow>
                )}
                {dispute.awardRecipient && dispute.status === DisputeStatus.Approved && (
                  <MetaRow icon={User} label="Award To">
                    {shortenAddress(dispute.awardRecipient)}
                  </MetaRow>
                )}
              </div>

              {dispute.resolutionReason && (
                <div className="mt-3 p-3 rounded-sm" style={{
                  backgroundColor: dispute.status === DisputeStatus.Approved || dispute.status === DisputeStatus.Executed
                    ? 'rgba(34,197,94,0.06)' : dispute.status === DisputeStatus.Rejected ? 'rgba(239,68,68,0.06)' : 'var(--bg-elev)',
                  border: `1px solid ${dispute.status === DisputeStatus.Approved || dispute.status === DisputeStatus.Executed
                    ? 'rgba(34,197,94,0.2)' : dispute.status === DisputeStatus.Rejected ? 'rgba(239,68,68,0.2)' : 'var(--line)'}`,
                }}>
                  <p className="allcaps mono text-[10px] mb-1.5" style={{ color: 'var(--ink-4)' }}>Resolution Reason</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>{dispute.resolutionReason}</p>
                </div>
              )}
        </DetailSection>
      )}

      {showResolve && (
        <ResolveModal
          colors={colors}
          dispute={dispute}
          onClose={() => setShowResolve(false)}
          onSuccess={() => { invalidateIndexed(); setShowResolve(false) }}
        />
      )}
    </EntityDetailShell>
  )
}
