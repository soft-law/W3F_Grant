import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Scale, AlertTriangle, ChevronDown, ChevronUp, Printer, RefreshCw, Shield, ShieldOff, Coins, ExternalLink, FileText, Gavel } from 'lucide-react'
import { useAccount } from 'wagmi'
import { formatEther } from 'viem'
import type { ThemeColors } from '@/hooks/useTheme'
import { Button } from '@/components/Button'
import { EmptyState } from '../components/EmptyState'
import { SkeletonGrid } from '../components/SkeletonCard'
import { StatusSeal } from '../components/StatusSeal'
import { SectionHead } from '../components/SectionHead'
import { PivotTab } from '@/components/PivotTab'
import { CONTRACT_ADDRESSES, DisputeStatus } from '@/lib/contracts'
import { shortenAddress, formatTimestamp } from '@/lib/contracts'
import { useExecuteAward, useWithdrawableBond, useWithdrawBond, useClaimExpiredBond, type FullDispute } from '@/hooks/useContracts'
import { useIndexedAllDisputes, useInvalidateIndexedQueries } from '@/hooks/useIndexed'
import { WithdrawalHistory } from '@/components/WithdrawalHistory'
import { reviveApiCall } from '@/hooks/useReviveApiCall'
import { useRefreshAfterWrite } from '@/hooks/useRefreshAfterWrite'
import { usePapi } from '@/contexts/papi-context'
import { ABIS } from '@/lib/contracts'
import { toastError } from '@/hooks/useToast'
import { useTxToast } from '@/hooks/useTxToast'
import { useTranslations } from '@/lib/i18n'
import { ResolveModal } from '../modals/ResolveModal'
import type { UserDispute } from '../types'
import { useNow } from '@/hooks/useNow'

function disputeStatusToSeal(status: number): 'disputed' | 'awardGranted' | 'revoked' | 'expired' | 'resolved' {
  switch (status) {
    case 0: return 'disputed'      // Pending — sub judice
    case 1: return 'awardGranted'  // Approved — award exists, enforcement pending
    case 2: return 'resolved'      // Rejected — no award; the license stands
    case 3: return 'revoked'       // Executed — license actually revoked by award
    case 4: return 'expired'       // Expired
    default: return 'disputed'
  }
}

function disputeBorderColor(status: number): string {
  switch (status) {
    case 0: return 'var(--warn)'
    case 1: return 'var(--ok)'
    case 2: return 'var(--danger)'
    case 3: return 'var(--ok)'
    case 4: return 'var(--ink-3)'
    default: return 'var(--warn)'
  }
}

function DisputeTimeline({ status, submittedAt }: { status: number; submittedAt: bigint; colors?: ThemeColors }) {
  const { t } = useTranslations()
  const nowMs = useNow()
  const tl = t.disputes.timeline
  const stages = [
    { label: tl.filed, minStatus: 0 },
    { label: tl.evidence, minStatus: 0 },
    { label: tl.deliberation, minStatus: 0 },
    { label: tl.resolved, minStatus: 1 },
  ]
  const now = BigInt(Math.floor(nowMs / 1000))
  const elapsed = submittedAt > 0n ? Number(now - submittedAt) : 0
  const stageActive = [
    true,
    elapsed >= 0,
    elapsed >= 14 * 86400,
    status >= 1,
  ]

  return (
    <div className="flex items-center gap-1 mt-2 flex-wrap">
      {stages.map((stage, i) => {
        const done = status >= 1 && i < 3
        const active = stageActive[i] && status === 0 && i < 3
        const resolved = i === 3 && status >= 1
        const dotColor = done || resolved ? 'var(--ok)' : active ? 'var(--gold)' : 'var(--line)'
        const textColor = done || resolved ? 'var(--ok)' : active ? 'var(--gold)' : 'var(--ink-4)'
        return (
          <div key={stage.label} className="flex items-center gap-1">
            {i > 0 && <div style={{ width: 12, height: 1, backgroundColor: (done || (stageActive[i] && status >= 1)) ? 'var(--ok)' : 'var(--line)' }} />}
            <div className="flex items-center gap-1">
              <div className="rounded-full" style={{ width: 6, height: 6, backgroundColor: dotColor, flexShrink: 0 }} />
              <span className="mono" style={{ fontSize: 9, color: textColor, whiteSpace: 'nowrap' }}>{stage.label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Rules Document ────────────────────────────────────────────────────────────

function RulesDocument({ colors: _colors }: { colors: ThemeColors }) {
  const rule = (n: string, title: string, text: string) => (
    <div key={n} className="space-y-1">
      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--gold-text)' }}>
        Rule {n} — {title}
      </p>
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ink-4)' }}>{text}</p>
    </div>
  )

  return (
    <div className="space-y-4 px-2">
      <div className="text-center space-y-0.5 pb-3" style={{ borderBottom: '1px solid var(--line)' }}>
        <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--ink-4)' }}>Soft.Law Platform</p>
        <h2 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>RULES OF DISPUTE RESOLUTION</h2>
        <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>GovernanceArbitrator Smart Contract — Polkadot Hub Testnet</p>
        <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--gold-text)' }}>{CONTRACT_ADDRESSES.GovernanceArbitrator}</p>
      </div>

      <div className="px-2 py-2 rounded" style={{ backgroundColor: 'var(--bg-elev-2)', borderLeft: '3px solid var(--gold)' }}>
        <p className="text-[11px] leading-relaxed italic" style={{ color: 'var(--ink-4)' }}>
          These Rules govern the resolution of disputes arising from copyright license agreements executed on the Soft.Law platform. All parties who mint or receive a License Token governed by a Soft.Law license contract are bound by these Rules as a condition of the license. Proceedings are conducted on-chain via the GovernanceArbitrator contract and are final, binding, and automatically enforced.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--ink)' }}>Chapter I — Jurisdiction & Standing</p>
        {rule('1.1', 'Scope of Application', 'These Rules apply to any dispute, controversy, or claim arising out of or in connection with a copyright license agreement minted on the Soft.Law platform, including disputes concerning the validity, breach, termination, or interpretation of a License Token and its associated publicMetadataURI contract document.')}
        {rule('1.2', 'Eligible Parties', `Only the following parties have standing to initiate a dispute under these Rules: (a) the Licensor — the registered owner of the IP Asset token in the IPAsset contract (${CONTRACT_ADDRESSES.IPAsset}); or (b) the Licensee — any wallet address holding an ERC-1155 balance greater than zero (0) in the LicenseToken contract (${CONTRACT_ADDRESSES.LicenseToken}) for the disputed license ID. Third parties, assignees not holding a License Token, and expired licensees have no standing. Any non-owner may also file an IP dispute against a registered IP asset they believe infringes their rights.`)}
        {rule('1.3', 'Subject Matter', 'Disputes may concern: unauthorized use of the licensed work outside the scope of the granted rights; failure to provide required attribution; breach of commercial use restrictions; non-payment of recurring license fees; violation of territory restrictions; or any other material breach of the terms embedded in the license contract stored at the publicMetadataURI of the License Token.')}
      </div>

      <div style={{ borderTop: '1px solid var(--line)' }} />

      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--ink)' }}>Chapter II — Initiation of Proceedings</p>
        {rule('2.1', 'Notice of Dispute', 'Before filing, the complaining party shall attempt good faith resolution with the other party for a period of not less than five (5) days. If the dispute is not resolved, the complaining party may proceed to file under Rule 2.2.')}
        {rule('2.2', 'Filing Requirements', 'A dispute is initiated by calling submitDispute(targetId, disputeType, reason, proofURI) on the GovernanceArbitrator contract. A bond denominated in PAS is required at filing and is held in escrow until the dispute is resolved. The submission must include: (a) the target ID — the License Token ID for license disputes (type 0) or the IP Asset ID for IP disputes (type 1); (b) the dispute type (0 = License, 1 = IP Asset); (c) a written statement of reasons specifying the nature and basis of the dispute; and (d) a proofURI pointing to supporting evidence stored on IPFS, a public URL, or encoded as a data URI.')}
        {rule('2.3', 'Evidence Standards', 'Acceptable evidence includes: on-chain transaction records, screenshots of unauthorized use, IPFS-hosted documents, cryptographically signed statements, prior communications between parties, and any other documentation germane to the dispute. Evidence must be accessible via the proofURI at the time of filing and throughout the resolution period.')}
        {rule('2.4', 'One Dispute Per License', 'Only one active dispute may be open per License Token ID at any time. A new dispute may be filed only after the previous dispute has been resolved or rejected by the arbitrator.')}
        {rule('2.5', 'Respondent Response Period', 'Within ten (10) days of dispute submission, the respondent may submit a counter-statement and supporting evidence by calling submitCounterEvidence(disputeId, responseURI) or, until such function is available on-chain, by submitting evidence to the arbitrator off-chain. Failure to respond does not constitute admission.')}
      </div>

      <div style={{ borderTop: '1px solid var(--line)' }} />

      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--ink)' }}>Chapter III — The Soft.Law Court</p>
        {rule('3.1', 'The Arbitrator', 'The role of arbitrator is performed by the GovernanceArbitrator smart contract and any designated arbitrator address granted the ARBITRATOR_ROLE on the platform. The arbitrator reviews the dispute record, examines the submitted proofURI, and issues a ruling within the mandatory resolution window.')}
        {rule('3.1(a)', 'Arbitrator Independence and Impartiality', 'The arbitrator shall be independent and impartial. Any ARBITRATOR_ROLE holder with a direct financial interest in the disputed License Token (as Licensor, Licensee, or revenue split recipient via the RevenueDistributor contract) shall recuse themselves from ruling on that dispute. Where recusal leaves no eligible arbitrator, the dispute shall be escalated to WIPO fallback arbitration under Rule 5.1.')}
        {rule('3.2', 'Resolution Deadline', 'The GovernanceArbitrator enforces a mandatory resolution window of thirty (30) days from the block timestamp of the on-chain dispute submission. The arbitrator must issue a ruling before the deadline expires. Failure to rule within the deadline shall entitle the submitting party to escalate under Rule 5.1.')}
        {rule('3.3', 'Deliberation', "The arbitrator shall review: the license terms embedded in the License Token's publicMetadataURI; the reason and evidence provided at filing; the on-chain history of the License Token; and any other relevant on-chain data. The arbitrator is not bound by rules of civil procedure and may weigh evidence at their discretion.")}
      </div>

      <div style={{ borderTop: '1px solid var(--line)' }} />

      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--ink)' }}>Chapter IV — Rulings & Enforcement</p>
        {rule('4.1', 'Ruling: Approved', 'If the arbitrator finds in favour of the complainant, the dispute status is set to Approved (status = 1). The ruling is now enforceable: any wallet may call executeAward(disputeId) to revoke the license on-chain (status = 3 — Executed). This follows the DeFi liquidation pattern — enforcement is permissionless, not restricted to the arbitrator. The only on-chain remedy is full license revocation. The gap between Approved and Executed is deliberate: it allows the respondent to voluntarily comply (e.g., correct attribution, cease unauthorized use) before enforcement. As an advisory protocol, enforcers should wait at least 7 days after approval before calling revocation, unless the violation is ongoing and causing immediate harm. This grace period is advisory only and is not technically enforced by the contract. Executed rulings are final and irreversible.')}
        {rule('4.2', 'Ruling: Rejected', 'If the arbitrator finds the dispute without merit, the dispute status is set to Rejected (status = 2). The license remains in full force and effect. The transaction gas cost of the filing is borne by the submitting party. No further action is taken on the License Token.')}
        {rule('4.3', 'Binding Effect', 'All rulings of the Soft.Law Court are final and binding on both parties. By minting or accepting a License Token containing a publicMetadataURI that references these Rules or the Soft.Law Court ADR clause, both parties irrevocably submit to the jurisdiction of the GovernanceArbitrator and agree to give effect to its rulings.')}
        {rule('4.4', 'No Appeal', 'There is no appeal from a ruling of the Soft.Law Court within the on-chain system. A party who believes a ruling was made in error may seek review through the fallback mechanism in Chapter V.')}
        {rule('4.5', 'Costs', 'The gas costs of filing are borne by the submitting party. If the dispute is approved, the arbitrator may, at their discretion, direct that costs be borne by the non-prevailing party in any fallback WIPO proceedings (Rule 5.1).')}
      </div>

      <div style={{ borderTop: '1px solid var(--line)' }} />

      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--ink)' }}>Chapter V — Fallback & Governing Law</p>
        {rule('5.1', 'WIPO Fallback Arbitration', 'For matters not adjudicable by on-chain arbitration — including cross-jurisdictional enforcement of rulings, claims involving physical assets, criminal matters, issues of copyright validity, or where the 30-day deadline has expired without a ruling — the parties agree to submit to binding arbitration under the WIPO Expedited Arbitration Rules, with one arbitrator, conducted in English, with the seat to be agreed by the parties or, failing agreement, determined by the WIPO Arbitration and Mediation Center. The arbitral award shall be final and enforceable under the New York Convention (1958).')}
        {rule('5.2', 'Governing Law', "These Rules and all proceedings hereunder are governed by international conventional law, specifically the Berne Convention for the Protection of Literary and Artistic Works (1886, as amended), the WIPO Copyright Treaty (1996), the TRIPS Agreement (1994), and the UNCITRAL Model Law on International Commercial Arbitration (1985, as revised 2006). Each party's intellectual property rights are additionally governed by the law of the jurisdiction where protection is claimed, consistent with the principle of national treatment under the Berne Convention (Article 5) and applicable WIPO treaties.")}
        {rule('5.3', 'Severability', 'If any provision of these Rules is held unenforceable by a competent tribunal, the remaining provisions remain in full force and effect. The unenforceability of any single Rule does not affect the binding nature of the on-chain arbitration mechanism as a whole.')}
      </div>

      <div className="text-center pt-2 space-y-0.5" style={{ borderTop: '1px solid var(--line)' }}>
        <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>These Rules are incorporated by reference into every copyright license agreement</p>
        <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>issued on the Soft.Law platform via the Soft.Law Court ADR clause.</p>
        <p className="text-[10px] font-semibold mt-1" style={{ color: 'var(--gold-text)' }}>soft.law — Decentralized IP Registry & Licensing</p>
      </div>
    </div>
  )
}

// ── Arbitrator sub-components ─────────────────────────────────────────────────



// License revocation is enforced through the GovernanceArbitrator dispute lifecycle.

function ArbitratorPanel({
  colors,
  executeAward,
  isEnforcing,
  invalidateIndexed,
}: {
  colors: ThemeColors
  executeAward: (id: bigint) => Promise<unknown>
  isEnforcing: boolean
  invalidateIndexed: () => void
}) {
  const { t } = useTranslations()
  const nowMs = useNow()
  const { disputes, isLoading, refetch } = useIndexedAllDisputes(true)
  const txToast = useTxToast()
  const { api: papiApi } = usePapi()
  const [resolveModal, setResolveModal] = useState<FullDispute | null>(null)
  const [enforcingId, setEnforcingId] = useState<bigint | null>(null)

  // Return fresh chain status or fail closed with null.
  async function fetchFreshStatus(disputeId: bigint): Promise<number | null> {
    if (!papiApi) return null
    try {
      const d = await reviveApiCall(papiApi, {
        contractAddress: CONTRACT_ADDRESSES.GovernanceArbitrator,
        abi: ABIS.GovernanceArbitrator,
        functionName: 'getDispute',
        args: [disputeId],
      }) as { status: number }
      return d.status
    } catch {
      // Retry one transient transport failure.
      await new Promise(r => setTimeout(r, 2_000))
      try {
        const d = await reviveApiCall(papiApi, {
          contractAddress: CONTRACT_ADDRESSES.GovernanceArbitrator,
          abi: ABIS.GovernanceArbitrator,
          functionName: 'getDispute',
          args: [disputeId],
        }) as { status: number }
        return d.status
      } catch {
        return null
      }
    }
  }

  return (
    <div className="space-y-3">
      {/* Arbitrator header */}
      <div className="flex items-center justify-between px-3 py-2.5 rounded-sm" style={{ backgroundColor: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: '#8B5CF6' }} />
          <span className="text-[11px] font-semibold" style={{ color: '#8B5CF6' }}>{t.disputes.arbitratorPanel}</span>
        </div>
        <button onClick={() => { refetch() }} className="p-1 rounded-sm" style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--line)' }}>
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} style={{ color: 'var(--ink-4)' }} />
        </button>
      </div>

      {/* All disputes */}
      {isLoading ? (
        <SkeletonGrid colors={colors} count={3} />
      ) : disputes.length === 0 ? (
        <div className="rounded-sm p-4 text-center" style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--line)' }}>
          <Scale className="w-6 h-6 mx-auto mb-1" style={{ color: 'var(--ink-4)' }} />
          <p className="text-xs" style={{ color: 'var(--ink-4)' }}>{t.disputes.noDisputesOnChain}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] font-medium px-0.5" style={{ color: 'var(--ink-4)' }}>{t.disputes.allDisputes} — {disputes.length} {t.disputes.total}</p>
          {disputes.map((d) => {
            const now = BigInt(Math.floor(nowMs / 1000))
            const isOverdue = d.status === 0 && d.submittedAt > 0n && (now - d.submittedAt) > 604800n
            return (
              <Link key={d.disputeId.toString()} to={`/judicial/${d.disputeId.toString()}`} className="block rounded-sm p-3 animate-fade-in-up transition-opacity hover:opacity-80" style={{
                backgroundColor: 'var(--bg-elev)',
                border: `1px solid ${isOverdue ? 'var(--danger)' : 'var(--line)'}`,
                borderLeft: `4px solid ${disputeBorderColor(d.status)}`,
                textDecoration: 'none', color: 'inherit',
              }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>#{d.disputeId.toString()}</span>
                    <StatusSeal status={disputeStatusToSeal(d.status)} size="sm" colors={colors} />
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: 'color-mix(in srgb, var(--gold) 12%, transparent)', color: 'var(--gold-text)' }}>
                      {d.disputeType === 1 ? t.disputes.disputeTypeIP : t.disputes.disputeTypeLicense}
                    </span>
                    {(d.isExpired || d.status === 4) && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--ink-3) 12%, transparent)', color: 'var(--ink-3)' }}>
                        {t.disputes.status.expired}
                      </span>
                    )}
                    {d.bondReleased && d.status !== 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--ok) 12%, transparent)', color: 'var(--ok)' }}>
                        {t.disputes.bondReleased}
                      </span>
                    )}
                    {isOverdue && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-0.5" style={{ backgroundColor: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)' }}>
                        <AlertTriangle className="w-2.5 h-2.5" /> {t.disputes.overdue}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1" onClick={e => e.preventDefault()}>
                    {d.status === DisputeStatus.Pending && (
                      <Button size="sm" onClick={async () => {
                        const freshStatus = await fetchFreshStatus(d.disputeId)
                        if (freshStatus === null) { toastError(t.disputes.connectionTemporarilyDown); return }
                        if (freshStatus !== DisputeStatus.Pending) { toastError(t.disputes.alreadyResolved); return }
                        setResolveModal(d)
                      }} leftIcon={<Scale className="w-3.5 h-3.5" />}>
                        {t.disputes.resolve}
                      </Button>
                    )}
                    {d.status === DisputeStatus.Approved && (
                      <Button size="sm" isLoading={isEnforcing && enforcingId === d.disputeId} onClick={async () => {
                        const freshStatus = await fetchFreshStatus(d.disputeId)
                        if (freshStatus === null) { toastError(t.disputes.connectionTemporarilyDown); return }
                        if (freshStatus !== DisputeStatus.Approved) { toastError(t.disputes.notApprovedForEnforce); return }
                        setEnforcingId(d.disputeId)
                        txToast.start(t.tx.enforcingRevocation)
                        try {
                          await executeAward(d.disputeId)
                        } catch (err) {
                          txToast.onError(err instanceof Error ? err : new Error(String(err)))
                          setEnforcingId(null)
                        }
                      }} leftIcon={<ShieldOff className="w-3.5 h-3.5" />}>
                        {t.disputes.enforceRevocation}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <div>
                    <span className="text-xs" style={{ color: 'var(--ink-4)' }}>
                      {d.disputeType === 1 ? t.disputes.labels.ipAsset : t.disputes.labels.license}:{' '}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--ink)' }}>
                      #{d.disputeType === 1 ? d.ipAssetId?.toString() ?? '?' : d.licenseId.toString()}
                    </span>
                  </div>
                  <div><span className="text-xs" style={{ color: 'var(--ink-4)' }}>{t.disputes.labels.submitter}: </span><span className="text-[11px]" style={{ color: 'var(--ink)' }}>{shortenAddress(d.submitter)}</span></div>
                  <div><span className="text-xs" style={{ color: 'var(--ink-4)' }}>{t.disputes.labels.ipOwner}: </span><span className="text-[11px]" style={{ color: 'var(--ink)' }}>{shortenAddress(d.ipOwner)}</span></div>
                  <div><span className="text-xs" style={{ color: 'var(--ink-4)' }}>{t.disputes.labels.filed}: </span><span className="text-[11px]" style={{ color: 'var(--ink)' }}>{d.submittedAt > 0n ? formatTimestamp(d.submittedAt) : 'N/A'}</span></div>
                  {d.reason && <div className="col-span-2"><span className="text-xs" style={{ color: 'var(--ink-4)' }}>{t.disputes.labels.reason}: </span><span className="text-[11px]" style={{ color: 'var(--ink)' }}>{d.reason}</span></div>}
                  {d.resolutionReason && <div className="col-span-2"><span className="text-xs" style={{ color: 'var(--ink-4)' }}>{t.disputes.labels.resolution}: </span><span className="text-[11px]" style={{ color: 'var(--ink)' }}>{d.resolutionReason}</span></div>}
                </div>
                <DisputeTimeline status={d.status} submittedAt={d.submittedAt} colors={colors} />
              </Link>
            )
          })}
        </div>
      )}


      {resolveModal && (
        <ResolveModal colors={colors} dispute={resolveModal} onClose={() => setResolveModal(null)} onSuccess={() => { refetch(); invalidateIndexed(); setResolveModal(null) }} />
      )}
    </div>
  )
}

// ── Docket phase class ────────────────────────────────────────────────────────

function docketPhaseClass(status: number, submittedAt: bigint): string {
  if (status === 1 || status === 3) return 'docket-ruled'
  if (status === 2) return 'docket-disputed'
  if (status === 4) return ''
  // Pending: after 14 days → deliberation
  const elapsed = Number(BigInt(Math.floor(Date.now() / 1000)) - submittedAt)
  if (elapsed >= 14 * 86400) return 'docket-deliberation'
  return 'docket-evidence'
}

// ── Main export ───────────────────────────────────────────────────────────────

export function JudicialSection({ colors, disputes, isLoading, onSubmitDispute, isArbitrator, searchTerm }: {
  colors: ThemeColors
  disputes: UserDispute[]
  isLoading: boolean
  onSubmitDispute: () => void
  isArbitrator: boolean
  searchTerm?: string
}) {
  const { t } = useTranslations()
  const { address } = useAccount()
  const { api: papiApi } = usePapi()
  const [rulesOpen, setRulesOpen] = useState(false)
  const [claimingId, setClaimingId] = useState<bigint | null>(null)

  // Action gating uses a fresh read and fails closed on chain errors.
  const { data: bondBalance, refetch: refetchBond, error: bondError } = useWithdrawableBond(
    address,
    { staleTime: 0 },
  )
  const { withdrawBond, hash: withdrawBondHash, isPending: isWithdrawingBond, isSuccess: withdrawBondSuccess } = useWithdrawBond()
  const { claimExpiredBond, hash: claimHash, isPending: isClaiming, isSuccess: claimSuccess } = useClaimExpiredBond()

  // Keep award execution state above the tab views so it survives tab changes.
  const { executeAward, hash: enforceHash, isPending: isEnforcing, isSuccess: enforceSuccess } = useExecuteAward()

  const invalidateIndexed = useInvalidateIndexedQueries()
  const txToast = useTxToast()

  useEffect(() => { if (withdrawBondHash) txToast.onHash(withdrawBondHash) }, [withdrawBondHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (withdrawBondSuccess) txToast.onConfirmed(t.disputes.bondWithdrawn)
  }, [withdrawBondSuccess]) // eslint-disable-line react-hooks/exhaustive-deps
  useRefreshAfterWrite(withdrawBondSuccess, {
    refetches: [refetchBond],
    invalidateIndexed,
  })

  useEffect(() => { if (claimHash) txToast.onHash(claimHash) }, [claimHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (claimSuccess) {
      txToast.onConfirmed(t.disputes.bondClaimed)
    }
  }, [claimSuccess]) // eslint-disable-line react-hooks/exhaustive-deps
  useRefreshAfterWrite(claimSuccess, {
    refetches: [refetchBond],
    invalidateIndexed,
    onComplete: () => setClaimingId(null),
  })

  // Lifted executeAward effects — survive ArbitratorPanel unmount.
  useEffect(() => { if (enforceHash) txToast.onHash(enforceHash) }, [enforceHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (enforceSuccess) txToast.onConfirmed(t.disputes.licenseRevoked)
  }, [enforceSuccess]) // eslint-disable-line react-hooks/exhaustive-deps
  useRefreshAfterWrite(enforceSuccess, { invalidateIndexed })

  // Pre-flight helper for per-card Claim Expired Bond — fresh chain read
  // at click time, 1 retry with 2s backoff for transient WS hiccup.
  // Returns null if chain unreachable (fail-closed).
  async function fetchDisputeStatusForClaim(disputeId: bigint): Promise<number | null> {
    if (!papiApi) return null
    const fetchOnce = async () => {
      const d = await reviveApiCall(papiApi, {
        contractAddress: CONTRACT_ADDRESSES.GovernanceArbitrator,
        abi: ABIS.GovernanceArbitrator,
        functionName: 'getDispute',
        args: [disputeId],
      }) as { status: number }
      return d.status
    }
    try { return await fetchOnce() }
    catch {
      await new Promise(r => setTimeout(r, 2_000))
      try { return await fetchOnce() } catch { return null }
    }
  }

  const searchLower = searchTerm?.toLowerCase() ?? ''
  const filteredDisputes = searchLower ? disputes.filter(d => d.reason.toLowerCase().includes(searchLower)) : disputes

  const [searchParams, setSearchParams] = useSearchParams()
  type View = 'file' | 'arbitration'
  const view: View = searchParams.get('view') === 'arbitration' ? 'arbitration' : 'file'
  const setView = (v: View) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (v === 'arbitration') next.set('view', 'arbitration')
      else next.delete('view')
      return next
    }, { replace: true })
  }

  const { disputes: allDisputes } = useIndexedAllDisputes(view === 'arbitration')
  const unresolvedCount = (allDisputes ?? []).filter(d =>
    d.status === DisputeStatus.Pending || d.status === DisputeStatus.Expired
  ).length

  if (isLoading) return <SkeletonGrid colors={colors} count={3} />

  return (
    <div className="space-y-3">
      <SectionHead
        colors={colors}
        eyebrow="§ Judicial · Arbitration"
        title={view === 'file' ? t.disputes.titleFile : t.disputes.titleArbitration}
        sub={view === 'file' ? t.disputes.subtitleFile : t.disputes.subtitleArbitration}
        actions={
          view === 'file' ? (
            <button
              onClick={onSubmitDispute}
              className="btn-primary inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 transition-opacity hover:opacity-80"
            >
              <AlertTriangle style={{ width: 14, height: 14 }} />
              {t.disputes.submitDispute}
            </button>
          ) : undefined
        }
      />

      {/* Two-tab pivot. Per the owner decision (June 2026 G2-judicial). */}
      <div className="flex" style={{ gap: 0, border: '1px solid var(--line)' }}>
        <PivotTab
          active={view === 'file'}
          onClick={() => setView('file')}
          label={t.disputes.tabFileLabel}
          sub={t.disputes.tabFileSub}
          icon={FileText}
        />
        <PivotTab
          active={view === 'arbitration'}
          onClick={() => setView('arbitration')}
          label={t.disputes.tabArbitrationLabel}
          sub={t.disputes.tabArbitrationSub}
          icon={Gavel}
          alert={isArbitrator ? unresolvedCount : undefined}
          alertLabel={t.disputes.actionBadge}
        />
      </div>

      {view === 'file' ? (
        <JudicialPartyView
          colors={colors}
          address={address}
          disputes={disputes}
          filteredDisputes={filteredDisputes}
          searchTerm={searchTerm}
          searchLower={searchLower}
          onSubmitDispute={onSubmitDispute}
          isArbitrator={isArbitrator}
          bondError={bondError}
          bondBalance={bondBalance}
          refetchBond={refetchBond}
          withdrawBond={withdrawBond}
          isWithdrawingBond={isWithdrawingBond}
          isClaiming={isClaiming}
          claimingId={claimingId}
          setClaimingId={setClaimingId}
          claimExpiredBond={claimExpiredBond}
          fetchDisputeStatusForClaim={fetchDisputeStatusForClaim}
          rulesOpen={rulesOpen}
          setRulesOpen={setRulesOpen}
          toastError={toastError}
          txToast={txToast}
        />
      ) : (
        <JudicialArbitrationView
          colors={colors}
          isArbitrator={isArbitrator}
          executeAward={executeAward}
          isEnforcing={isEnforcing}
          invalidateIndexed={invalidateIndexed}
        />
      )}
    </div>
  )
}

// === Party view (LEFT tab — "File & track") ================================
//
function JudicialPartyView({
  colors,
  address,
  disputes,
  filteredDisputes,
  searchTerm,
  searchLower,
  onSubmitDispute,
  isArbitrator: _isArbitrator,
  bondError,
  bondBalance,
  refetchBond,
  withdrawBond,
  isWithdrawingBond,
  isClaiming,
  claimingId,
  setClaimingId,
  claimExpiredBond,
  fetchDisputeStatusForClaim,
  rulesOpen,
  setRulesOpen,
  toastError,
  txToast,
}: {
  colors: ThemeColors
  address?: `0x${string}`
  disputes: UserDispute[]
  filteredDisputes: UserDispute[]
  searchTerm?: string
  searchLower: string
  onSubmitDispute: () => void
  isArbitrator: boolean
  bondError: unknown
  bondBalance: bigint | null | undefined
  refetchBond: () => Promise<{ data: bigint | undefined; error: unknown }>
  withdrawBond: () => Promise<unknown>
  isWithdrawingBond: boolean
  isClaiming: boolean
  claimingId: bigint | null
  setClaimingId: (id: bigint | null) => void
  claimExpiredBond: (id: bigint) => Promise<unknown>
  fetchDisputeStatusForClaim: (id: bigint) => Promise<number | null>
  rulesOpen: boolean
  setRulesOpen: React.Dispatch<React.SetStateAction<boolean>>
  toastError: (msg: string) => void
  txToast: ReturnType<typeof useTxToast>
}) {
  const nowMs = useNow()
  const { t } = useTranslations()
  return (
    <div className="space-y-3">
      {/* Rules document */}
      <div className="rounded-sm overflow-hidden" style={{ border: '1px solid var(--line)' }}>
        <button
          onClick={() => setRulesOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          style={{ background: 'linear-gradient(135deg, var(--bg-elev), var(--bg-elev-2))' }}
        >
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4" style={{ color: 'var(--gold-text)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t.disputes.rulesTitle}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'color-mix(in srgb, var(--gold) 12%, transparent)', color: 'var(--gold-text)' }}>{t.disputes.court}</span>
          </div>
          <div className="flex items-center gap-2">
            {rulesOpen && (
              <button
                onClick={(e) => { e.stopPropagation(); window.print() }}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                style={{ backgroundColor: 'var(--bg-elev-2)', color: 'var(--ink-4)', border: '1px solid var(--line)' }}
              >
                <Printer className="w-3 h-3" /> {t.disputes.print}
              </button>
            )}
            {rulesOpen
              ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--ink-4)' }} />
              : <ChevronDown className="w-4 h-4" style={{ color: 'var(--ink-4)' }} />
            }
          </div>
        </button>
        {rulesOpen && (
          <div className="px-5 py-5" style={{ backgroundColor: 'var(--bg)' }}>
            <RulesDocument colors={colors} />
          </div>
        )}
      </div>

      {/* Fail closed on chain error; do not show a stale withdrawable value. */}
      {address && !bondError && bondBalance != null && bondBalance > 0n && (
        <div className="flex items-center justify-between rounded-sm px-3 py-2.5" style={{ backgroundColor: 'color-mix(in srgb, var(--gold) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 19%, transparent)' }}>
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4" style={{ color: 'var(--gold-text)' }} />
            <span className="text-[11px] font-semibold" style={{ color: 'var(--gold-text)' }}>
              {t.disputes.bondBalance}: {Number(formatEther(bondBalance)).toFixed(2)} PAS
            </span>
          </div>
          <Button size="sm" isLoading={isWithdrawingBond} onClick={async () => {
            // Pre-flight chain read: refuse to submit if balance has dropped
            // to 0 since chip rendered (defeats second-click-after-drain).
            const fresh = await refetchBond()
            if (fresh.error || fresh.data == null) {
              toastError(t.disputes.connectionTemporarilyDown)
              return
            }
            if (fresh.data === 0n) {
              toastError(t.disputes.nothingToWithdraw)
              return
            }
            txToast.start(t.tx.withdrawingBond)
            try {
              await withdrawBond()
            } catch (err) {
              txToast.onError(err instanceof Error ? err : new Error(String(err)))
            }
          }}>
            {t.disputes.withdrawBond}
          </Button>
        </div>
      )}

      {/* Past bond sweeps — account-scoped (BondWithdrawn carries no dispute
          reference on-chain, so it cannot appear in a per-dispute timeline) */}
      <WithdrawalHistory recipient={address} source="bond" />

      {/* Personal dispute list */}
      {/* The arbitrator panel is mounted in the arbitration view. */}

      {/* My disputes */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium" style={{ color: 'var(--ink-4)' }}>
          {disputes.length} {(disputes.length !== 1 ? t.ipSection.stats.disputes : t.common.dispute).toLowerCase()} {t.disputes.onRecord}
        </p>
        <Button size="sm" onClick={onSubmitDispute} leftIcon={<AlertTriangle className="w-3.5 h-3.5" />}>
          {t.disputes.submitDispute}
        </Button>
      </div>

      {disputes.length === 0 ? (
        <EmptyState colors={colors} icon={Scale} title={t.disputes.noDisputes} />
      ) : filteredDisputes.length === 0 && searchLower ? (
        <EmptyState
          colors={colors}
          icon={Scale}
          title={t.common.noSearchMatches.replace('{query}', searchTerm ?? '')}
          subtitle={t.common.noSearchMatchesHint}
        />
      ) : (
        <div className="space-y-3">
          {filteredDisputes.map((d) => {
            const now = BigInt(Math.floor(nowMs / 1000))
            const isOverdue = d.status === 0 && d.submittedAt > 0n && (now - d.submittedAt) > 604800n
            const year = new Date().getFullYear()
            const dd = t.disputeDocket.card
            const docketNo = `${dd.docketPrefix}-${year}-${d.disputeId.toString().padStart(4, '0')}`
            const phaseClass = docketPhaseClass(d.status, d.submittedAt)
            const targetRef = d.disputeType === 1
              ? `IP #${d.ipAssetId ?? '?'}`
              : `License #${d.licenseId.toString()}`
            const isRuled = d.status === 1 || d.status === 3 || d.status === 2
            const typeLabel = d.disputeType === 1 ? dd.types.ipDispute : dd.types.licenseDispute

            return (
              <Link
                key={d.disputeId.toString()}
                to={`/judicial/${d.disputeId.toString()}`}
                className={`docket-card ${phaseClass} animate-fade-in-up`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  position: 'relative',
                  isolation: 'isolate',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                {/* Phase-progress strip — 3 segments: Evidence / Deliberation / Ruled */}
                {(() => {
                  const elapsed = d.submittedAt > 0n ? Number(BigInt(Math.floor(Date.now() / 1000)) - d.submittedAt) : 0
                  const isRuledStatus = d.status === 1 || d.status === 2 || d.status === 3
                  const seg1 = isRuledStatus ? 'done' : 'active'
                  const seg2 = isRuledStatus ? 'done' : elapsed >= 14 * 86400 ? 'active' : ''
                  const seg3 = isRuledStatus ? 'done' : ''
                  return (
                    <div className="phase-track">
                      <div className={`phase-track-seg ${seg1}`} />
                      <div className={`phase-track-seg ${seg2}`} />
                      <div className={`phase-track-seg ${seg3}`} />
                    </div>
                  )
                })()}

                {/* Docket folio strip */}
                <div className="folio-strip-bg">
                  <div className="folio-strip mono" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ color: 'var(--gold-text)', fontWeight: 700 }}>{docketNo}</span>
                    <span style={{ color: 'var(--line)' }}>│</span>
                    <span style={{ color: 'var(--ink-3)' }}>
                      {typeLabel}
                    </span>
                    <span style={{ color: 'var(--line)' }}>│</span>
                    <span style={{ color: d.status === 0 ? 'var(--warn)' : d.status === 1 || d.status === 3 ? 'var(--ok)' : d.status === 2 ? 'var(--danger)' : 'var(--ink-4)' }}>
                      {d.status === 0 ? t.disputes.docket.subJudice : d.status === 1 ? t.disputes.docket.approved : d.status === 2 ? t.disputes.docket.rejected : t.disputes.docket.executed}
                    </span>
                  </div>
                </div>

                {/* Caption — "In the matter of folio" */}
                <div style={{ padding: '8px 14px 4px' }}>
                  <div className="doc-title-eyebrow" style={{ marginBottom: 3 }}>
                    {dd.captionPrefix} {targetRef}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <p className="display" style={{
                      fontSize: 'calc(13px * var(--type-scale))',
                      fontWeight: 700,
                      lineHeight: 1.2,
                      color: 'var(--ink)',
                      margin: 0,
                      flex: 1,
                    }}>
                      {d.reason ? (d.reason.length > 80 ? `${d.reason.slice(0, 78)}…` : d.reason) : `${t.common.dispute} #${d.disputeId.toString()}`}
                    </p>
                    <StatusSeal status={disputeStatusToSeal(d.status)} size="sm" colors={colors} context="dispute" />
                  </div>
                </div>

                {/* Parties block — Petitioner / v. / Respondent (3-col) */}
                <div style={{
                  padding: '6px 14px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  gap: 8,
                  alignItems: 'start',
                  borderTop: '1px solid var(--line-2)',
                }}>
                  <div>
                    <div className="allcaps mono" style={{ fontSize: 8, color: 'var(--ink-4)', marginBottom: 2 }}>
                      {dd.petitioner}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)' }}>
                      {d.submitter?.toLowerCase() === address?.toLowerCase()
                        ? t.disputes.youSubmitter
                        : shortenAddress(d.submitter)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 12 }}>
                    <span className="mono allcaps" style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)' }}>
                      {dd.versus}
                    </span>
                  </div>
                  <div>
                    <div className="allcaps mono" style={{ fontSize: 8, color: 'var(--ink-4)', marginBottom: 2 }}>
                      {dd.respondent}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)' }}>
                      {d.ipOwner
                        ? (d.ipOwner.toLowerCase() === address?.toLowerCase()
                            ? t.disputes.youRespondent
                            : shortenAddress(d.ipOwner))
                        : '—'}
                    </div>
                  </div>
                </div>

                {/* Exhibits — petitioner's evidence */}
                {d.proofURI && (
                  <div style={{ padding: '6px 14px', borderTop: '1px dashed var(--line-2)' }}>
                    <div className="allcaps mono" style={{ fontSize: 8, color: 'var(--ink-4)', marginBottom: 3 }}>
                      {dd.exhibitsLabel}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ color: 'var(--gold-text)', fontWeight: 700 }}>{dd.exA}</span>
                      <span style={{ color: 'var(--line)' }}>·</span>
                      <span
                        role="link"
                        tabIndex={0}
                        onClick={e => { e.preventDefault(); e.stopPropagation(); window.open(d.proofURI, '_blank', 'noopener,noreferrer') }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); window.open(d.proofURI, '_blank', 'noopener,noreferrer') } }}
                        className="inline-flex items-center gap-1 cursor-pointer"
                        style={{ color: 'var(--gold-text)', textDecoration: 'underline' }}
                      >
                        {dd.viewProof} <ExternalLink style={{ width: 9, height: 9 }} />
                      </span>
                    </div>
                  </div>
                )}

                {/* Procedural tally */}
                <div style={{ padding: '0 14px 8px' }}>
                  <div className="tally-bar">
                    <div>
                      <span className="k">{dd.tally.type}</span>
                      <span className="v">{typeLabel}</span>
                    </div>
                    <div>
                      <span className="k">{dd.tally.filed}</span>
                      <span className="v tnum">
                        {d.submittedAt > 0n
                          ? new Date(Number(d.submittedAt) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="k">{dd.tally.bond}</span>
                      <span className="v tnum">
                        {d.bondAmount > 0n ? `${Number(formatEther(d.bondAmount)).toFixed(2)} PAS` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="k">{dd.tally.status}</span>
                      <span className="v" style={{ color: isRuled ? (d.status === 2 ? 'var(--danger)' : 'var(--ok)') : 'var(--warn)' }}>
                        {d.status === 0 ? dd.phase.evidence : d.status === 1 || d.status === 3 ? dd.phase.ruled : d.status === 2 ? dd.phase.ruled : dd.phase.pending}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div style={{ padding: '0 14px 8px', borderTop: '1px dashed var(--line-2)' }}>
                  <DisputeTimeline status={d.status} submittedAt={d.submittedAt} />
                </div>

                {/* Ruling box (if resolved) */}
                {isRuled && (
                  <div style={{
                    margin: '0 14px 8px',
                    padding: '6px 10px',
                    background: d.status === 2
                      ? 'color-mix(in srgb, var(--danger) 8%, var(--bg-elev))'
                      : 'color-mix(in srgb, var(--ok) 8%, var(--bg-elev))',
                    border: `1px solid ${d.status === 2 ? 'color-mix(in srgb, var(--danger) 30%, transparent)' : 'color-mix(in srgb, var(--ok) 30%, transparent)'}`,
                  }}>
                    <div className="allcaps mono" style={{ fontSize: 8, color: d.status === 2 ? 'var(--danger)' : 'var(--ok)', marginBottom: 3 }}>
                      {dd.rulingLabel}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: d.status === 2 ? 'var(--danger)' : 'var(--ok)', fontWeight: 600 }}>
                      {d.status === 2 ? dd.rejected : dd.approved}
                    </div>
                    {d.resolvedAt > 0n && (
                      <div className="mono" style={{ fontSize: 9, color: 'var(--ink-4)', marginTop: 3 }}>
                        {dd.resolvedOn} {new Date(Number(d.resolvedAt) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {d.resolver && (
                          <span> · {dd.resolvedBy} {shortenAddress(d.resolver)}</span>
                        )}
                      </div>
                    )}
                    {d.resolutionReason && (
                      <div className="mono" style={{ fontSize: 9, color: 'var(--ink-3)', marginTop: 3, fontStyle: 'italic' }}>
                        "{d.resolutionReason.length > 80 ? d.resolutionReason.slice(0, 78) + '…' : d.resolutionReason}"
                      </div>
                    )}
                  </div>
                )}

                {/* Bond / claim action — pre-flight chain check + per-row
                    isClaiming state (shared isClaiming across overdue cards
                    was a surveyed inconsistency). */}
                {isOverdue && (
                  <div style={{ padding: '0 14px 8px' }} onClick={e => e.preventDefault()}>
                    <Button size="sm" isLoading={isClaiming && claimingId === d.disputeId} onClick={async () => {
                      const freshStatus = await fetchDisputeStatusForClaim(d.disputeId)
                      if (freshStatus === null) { toastError(t.disputes.connectionTemporarilyDown); return }
                      if (freshStatus !== DisputeStatus.Pending) { toastError(t.disputes.alreadyResolved); return }
                      setClaimingId(d.disputeId)
                      txToast.start(t.tx.claimingBond)
                      try {
                        await claimExpiredBond(d.disputeId)
                      } catch (err) {
                        txToast.onError(err instanceof Error ? err : new Error(String(err)))
                        setClaimingId(null)
                      }
                    }} leftIcon={<Coins className="w-3.5 h-3.5" />}>
                      {t.disputes.claimBond}
                    </Button>
                  </div>
                )}

                {/* Bond released chip */}
                {d.bondReleased && d.status !== 0 && (
                  <div style={{ padding: '0 14px 8px' }}>
                    <span className="chip allcaps mono" style={{ fontSize: 9, color: 'var(--ok)' }}>
                      {t.disputes.bondReleased}
                    </span>
                  </div>
                )}

                {/* Presiding footer */}
                <div style={{
                  borderTop: '1px solid var(--line)',
                  background: 'color-mix(in srgb, var(--gold) 4%, var(--bg-elev-2))',
                  padding: '5px 14px',
                  marginTop: 'auto',
                }}>
                  <span className="allcaps mono" style={{ fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>
                    {dd.presiding}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// === Arbitration view (RIGHT tab — "Arbitration panel") =====================
//
// Keep one panel instance so transaction state survives tab changes.
function JudicialArbitrationView({
  colors,
  isArbitrator,
  executeAward,
  isEnforcing,
  invalidateIndexed,
}: {
  colors: ThemeColors
  isArbitrator: boolean
  executeAward: (id: bigint) => Promise<unknown>
  isEnforcing: boolean
  invalidateIndexed: () => void
}) {
  const { t } = useTranslations()
  if (isArbitrator) {
    return (
      <>
        <ArbitratorPanel
          colors={colors}
          executeAward={executeAward}
          isEnforcing={isEnforcing}
          invalidateIndexed={invalidateIndexed}
        />
        <div style={{ borderTop: '1px solid var(--line)', marginTop: 8 }} />
      </>
    )
  }
  return (
    <div
      className="card"
      style={{
        padding: '24px 20px',
        textAlign: 'center',
        color: 'var(--ink-3)',
      }}
    >
      <Gavel className="w-6 h-6 mx-auto" style={{ color: 'var(--gold-text)' }} />
      <p
        className="display"
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--ink)',
          margin: '10px 0 4px',
        }}
      >
        {t.disputes.arbitratorAccessTitle}
      </p>
      <p
        className="text-xs"
        style={{ color: 'var(--ink-3)', maxWidth: 360, margin: '0 auto', lineHeight: 1.5 }}
      >
        {t.disputes.arbitratorAccessBody}
      </p>
    </div>
  )
}
