import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ThemeColors } from '@/hooks/useTheme'
import type { UserLicense } from '@/hooks/useContracts'
import {
  useMakeRecurringPayment,
  useGetTotalPaymentDue,
  useGetMissedPayments,
} from '@/hooks/useContracts'
import { useInvalidateIndexedQueries, useIndexedPaymentStatus } from '@/hooks/useIndexed'
import { useTranslations } from '@/lib/i18n'
import { CONTRACT_ADDRESSES, formatPrice } from '@/lib/contracts'
import { toastError } from '@/hooks/useToast'
import { useTxToast } from '@/hooks/useTxToast'
import { AlertTriangle, CreditCard, Key, ChevronDown, ChevronUp } from 'lucide-react'
import { LegalCite } from '@/components/LegalCite'
import { SectionHead } from '../components/SectionHead'
import { EmptyState } from '../components/EmptyState'
import { SkeletonGrid } from '../components/SkeletonCard'

const NOW_S = () => BigInt(Math.floor(Date.now() / 1000))
const THIRTY_DAYS_S = BigInt(30 * 86400)

function isExpiringSoon(lic: UserLicense): boolean {
  if (lic.expiryTime === 0n) return false
  const now = NOW_S()
  return lic.expiryTime > now && lic.expiryTime < now + THIRTY_DAYS_S
}

function formatInterval(seconds: bigint): string {
  if (seconds === 0n) return '—'
  const s = Number(seconds)
  if (s >= 31536000) return `${Math.round(s / 31536000)}y`
  if (s >= 2592000) return `${Math.round(s / 2592000)}mo`
  if (s >= 86400) return `${Math.round(s / 86400)}d`
  return `${Math.round(s / 3600)}h`
}

function formatExpiry(expiryTime: bigint): string {
  if (expiryTime === 0n) return 'Perpetual'
  const d = new Date(Number(expiryTime) * 1000)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCountdown(nextDueSec: number, t: { nextDueIn: string; overdueDays: string }): { text: string; color: string } {
  const nowSec = Math.floor(Date.now() / 1000)
  const diff = nextDueSec - nowSec
  const days = Math.ceil(Math.abs(diff) / 86400)
  if (diff > 0) return { text: t.nextDueIn.replace('{days}', String(days)), color: days <= 3 ? 'var(--warn)' : 'var(--ink-3)' }
  return { text: t.overdueDays.replace('{days}', String(days)), color: 'var(--danger)' }
}

function formatPasCompact(n: number): string {
  if (n >= 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return n.toLocaleString(undefined, { maximumFractionDigits: n < 10 ? 1 : 0 })
}

function cadenceLabel(lic: UserLicense, cadence: ReturnType<typeof t_cadence>): string {
  if (lic.paymentInterval === 0n) return cadence.oneTime
  const s = Number(lic.paymentInterval)
  if (s >= 31536000) return cadence.yearly
  if (s >= 2592000) return cadence.monthly
  if (s >= 86400 * 7) return cadence.weekly
  if (s >= 86400) return cadence.daily
  return cadence.periodic
}

// Tiny helper so cadenceLabel can accept the translations object
function t_cadence(t: ReturnType<typeof useTranslations>['t']) {
  return t.heldLicenses.cadence
}

// ── Status report from child rows upward ──
interface RowStatusReport {
  payStatus: 'oneTime' | 'paid' | 'due' | 'overdue' | 'atRisk'
  totalDueBigint: bigint
  paidTotal: number
}

// ── Filter types ──
type HeldFilter = 'all' | 'overdue' | 'due-soon' | 'renewal' | 'good-standing'

// ── Per-row component — hooks run once per license row ──
function HeldLicenseRow({
  lic,
  onPaySuccess,
  registerAttentionRef,
  onStatusReport,
}: {
  lic: UserLicense
  onPaySuccess: () => void
  registerAttentionRef?: (id: string, el: HTMLAnchorElement | null) => void
  onStatusReport?: (id: string, report: RowStatusReport) => void
}) {
  const { t } = useTranslations()
  const navigate = useNavigate()
  const [showHistory, setShowHistory] = useState(false)
  const isRecurring = lic.paymentInterval > 0n
  const { data: paymentData } = useGetTotalPaymentDue(
    CONTRACT_ADDRESSES.LicenseToken,
    lic.licenseId,
  )
  const { data: missedRaw } = useGetMissedPayments(
    CONTRACT_ADDRESSES.LicenseToken,
    lic.licenseId,
  )
  const totalDue = paymentData?.[2]
  const missed = missedRaw ?? 0n

  const { data: paymentStatus } = useIndexedPaymentStatus(
    isRecurring ? Number(lic.licenseId) : undefined,
  )

  const { makeRecurringPayment, hash, isPending, isSuccess } = useMakeRecurringPayment()
  const invalidateIndexed = useInvalidateIndexedQueries()
  const txToast = useTxToast()

  useEffect(() => {
    if (hash) txToast.onHash(hash)
  }, [hash]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isSuccess) {
      txToast.onConfirmed(t.recurringPayment.paymentSent)
      invalidateIndexed()
      onPaySuccess()
    }
  }, [isSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePay = async () => {
    if (!totalDue) { toastError(t.recurringPayment.fetchFailed); return }
    txToast.start(t.tx.makingPayment)
    try {
      await makeRecurringPayment(CONTRACT_ADDRESSES.LicenseToken, lic.licenseId, totalDue)
    } catch (err) {
      txToast.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  // Status classification
  type PayStatus = 'oneTime' | 'paid' | 'due' | 'overdue' | 'atRisk'
  let payStatus: PayStatus = 'paid'
  if (!isRecurring) {
    payStatus = 'oneTime'
  } else if (missed >= 3n) {
    payStatus = 'atRisk'
  } else if (missed > 0n) {
    payStatus = 'overdue'
  } else if (totalDue && totalDue > 0n) {
    payStatus = 'due'
  } else {
    payStatus = 'paid'
  }

  // Paid lifetime from payment history
  const history = useMemo(
    () => paymentStatus?.paymentHistory ?? [],
    [paymentStatus?.paymentHistory],
  )
  const paidTotal = useMemo(() => {
    return history.reduce((s, p) => {
      try { return s + parseFloat(formatPrice(BigInt(p.base_amount))) } catch { return s }
    }, 0)
  }, [history])

  // Send resolved recurring-payment status to the parent aggregate.
  useEffect(() => {
    if (!onStatusReport || !isRecurring) return
    // Wait for both payment reads.
    if (paymentData === undefined || missedRaw === undefined) return
    onStatusReport(lic.licenseId.toString(), {
      payStatus,
      totalDueBigint: totalDue ?? 0n,
      paidTotal,
    })
  }, [paymentData, missedRaw, payStatus, totalDue, paidTotal]) // eslint-disable-line react-hooks/exhaustive-deps

  const STATUS_COLOR: Record<PayStatus, string> = {
    oneTime: 'var(--ink-3)',
    paid: 'var(--ok)',
    due: 'var(--warn)',
    overdue: 'var(--danger)',
    atRisk: 'var(--danger)',
  }
  const STATUS_LABELS: Record<PayStatus, string> = {
    oneTime: t.heldLicenses.paymentStatus.oneTime,
    paid: t.heldLicenses.paymentStatus.paid,
    due: t.heldLicenses.paymentStatus.due,
    overdue: t.heldLicenses.paymentStatus.overdue,
    atRisk: t.heldLicenses.paymentStatus.atRisk,
  }

  const isRevoked = lic.isRevoked
  const isExpired = lic.isExpired || (lic.expiryTime > 0n && lic.expiryTime < NOW_S())

  const nextDue = paymentStatus?.nextPaymentDue ?? null
  const countdown = nextDue ? formatCountdown(nextDue, t.heldLicenses) : null
  const needsAttention = !isRevoked && !isExpired && (payStatus === 'overdue' || payStatus === 'atRisk')

  // Severity border — colour-codes card edge by status
  const sevBorder = payStatus === 'overdue' || payStatus === 'atRisk'
    ? 'var(--danger)'
    : payStatus === 'due'
      ? 'var(--warn)'
      : isExpiringSoon(lic)
        ? 'var(--warn)'
        : 'var(--line)'

  const card = t.licenseDoc.card
  const year = new Date().getFullYear()
  const licIdStr = lic.licenseId.toString().padStart(4, '0')
  const instrumentNo = `${card.instrumentPrefix}-${year}-${licIdStr}`

  const termDisplay = lic.expiryTime === 0n
    ? card.perpetual
    : formatExpiry(lic.expiryTime)

  const feeDisplay = lic.paymentInterval > 0n
    ? formatInterval(lic.paymentInterval)
    : card.perpetual

  // Cadence shown under the status block.
  const cadenceStr = cadenceLabel(lic, t_cadence(t))
  const cycleN = history.length > 0
    ? t.heldLicenses.cadence.cycleN.replace('{n}', String(history.length))
    : null

  return (
    <Link
      ref={el => {
        if (registerAttentionRef) registerAttentionRef(lic.licenseId.toString(), needsAttention ? el : null)
      }}
      to={`/licenses/${lic.licenseId.toString()}?from=held`}
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        overflow: 'hidden',
        opacity: isRevoked || isExpired ? 0.6 : 1,
        textDecoration: 'none',
        color: 'inherit',
        position: 'relative',
        isolation: 'isolate',
        cursor: 'pointer',
        borderColor: sevBorder,
        borderWidth: 1.5,
      }}
    >
      <div className="type-rail-v" />

      {/* Instrument folio strip */}
      <div className="folio-strip-bg">
        <div className="folio-strip mono" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: 'var(--gold-text)', fontWeight: 700 }}>{instrumentNo}</span>
          <span style={{ color: 'var(--line)' }}>│</span>
          <span style={{ color: 'var(--ink-4)' }}>···</span>
          {isRevoked ? (
            <>
              <span style={{ color: 'var(--line)' }}>│</span>
              <span style={{ color: 'var(--danger)' }}>REVOKED</span>
            </>
          ) : !isExpired ? (
            <>
              <span style={{ color: 'var(--line)' }}>│</span>
              <span style={{ color: 'var(--gold-text)', fontWeight: 700, letterSpacing: '0.06em' }}>{card.executed}</span>
            </>
          ) : null}
        </div>
      </div>

      {/* Main row: status block · title/meta · schedule chip · actions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto',
        gap: 12,
        padding: '12px 14px',
        alignItems: 'center',
      }}>
        {/* Status block */}
        <div style={{
          width: 64,
          padding: '10px 6px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          border: `1.5px solid ${STATUS_COLOR[payStatus]}`,
          background: `color-mix(in srgb, ${STATUS_COLOR[payStatus]} 12%, transparent)`,
          color: STATUS_COLOR[payStatus],
        }}>
          <div className="mono allcaps" style={{ fontSize: 9, letterSpacing: '0.08em', fontWeight: 700, textAlign: 'center' }}>
            {STATUS_LABELS[payStatus]}
          </div>
          {totalDue !== undefined && totalDue > 0n && (
            <div className="mono" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {formatPasCompact(parseFloat(formatPrice(totalDue)))}
            </div>
          )}
          <div className="mono" style={{ fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>PAS</div>
        </div>

        {/* Title + provenance */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
            <div className="doc-title-eyebrow">
              {lic.isExclusive ? card.exclusive : card.nonExclusive}
            </div>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{instrumentNo}</span>
          </div>
          <p className="display" style={{
            fontSize: 'calc(13px * var(--type-scale))',
            fontWeight: 700,
            lineHeight: 1.2,
            color: 'var(--ink)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {lic.title || `License #${lic.licenseId.toString()}`}
          </p>
          <div style={{ marginTop: 3, color: 'var(--ink-3)', fontSize: 11, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="mono">IP #{lic.ipAssetId.toString()}</span>
            {cycleN && (
              <>
                <span>·</span>
                <span className="mono" style={{ color: 'var(--ink-2)' }}>{cycleN}</span>
              </>
            )}
          </div>
        </div>

        {/* Schedule chip */}
        <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 100 }}>
          <div className="allcaps mono" style={{ fontSize: 9.5, color: 'var(--ink-4)', letterSpacing: '0.08em' }}>
            {cadenceStr}
          </div>
          {countdown && (
            <div className="mono" style={{ fontSize: 11.5, color: countdown.color, marginTop: 3, whiteSpace: 'nowrap' }}>
              {countdown.text}
            </div>
          )}
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 2 }}>
            {termDisplay}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {isRecurring && !isRevoked && !isExpired && (payStatus === 'due' || payStatus === 'overdue' || payStatus === 'atRisk') && (
            <button
              className="btn btn-sm btn-primary"
              onClick={e => { e.stopPropagation(); handlePay() }}
              disabled={isPending || !totalDue}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                ...(payStatus === 'overdue' || payStatus === 'atRisk'
                  ? { background: 'var(--danger)', borderColor: 'var(--danger)', color: 'white', boxShadow: 'none' }
                  : {}),
              }}
            >
              <CreditCard style={{ width: 12, height: 12 }} />
              {isPending ? t.recurringPayment.paying : t.heldLicenses.payNow}
            </button>
          )}
          {needsAttention && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={e => {
                e.preventDefault()
                e.stopPropagation()
                navigate(`/judicial?licenseId=${lic.licenseId.toString()}`)
              }}
              style={{ color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 45%, var(--line))', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <AlertTriangle style={{ width: 10, height: 10 }} />
              {t.profile.disputes.fileDispute}
            </button>
          )}
          {isRecurring && history.length > 0 && (
            <button
              className="btn btn-ghost btn-sm btn-icon"
              onClick={e => { e.stopPropagation(); setShowHistory(h => !h) }}
              title={showHistory ? t.heldLicenses.hideHistory : t.heldLicenses.showHistory}
              style={{ width: 32, height: 32 }}
            >
              {showHistory ? <ChevronUp style={{ width: 11, height: 11 }} /> : <ChevronDown style={{ width: 11, height: 11 }} />}
            </button>
          )}
        </div>
      </div>

      {/* Tally bar — Term / Fee / Missed (below main row) */}
      <div style={{ padding: '0 14px 8px' }}>
        <div className="tally-bar">
          <div>
            <span className="k">{card.term}</span>
            <span className="v tnum">{termDisplay}</span>
          </div>
          <div>
            <span className="k">{card.fee}</span>
            <span className="v tnum" style={{ color: lic.paymentInterval > 0n ? 'var(--warn)' : 'var(--ink-3)' }}>
              {feeDisplay}
            </span>
          </div>
          <div>
            <span className="k">{card.uses}</span>
            <span className="v tnum">{lic.supply.toString()}</span>
          </div>
          {missed > 0n && (
            <div>
              <span className="k">missed</span>
              <span className="v tnum" style={{ color: 'var(--danger)' }}>{missed.toString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Recitals */}
      <div style={{ padding: '0 14px 8px', borderTop: '1px dashed var(--line-2)' }}>
        <div className="recital">
          <span className="num">I</span>
          <span>{card.recitalI}</span>
        </div>
        <div className="recital">
          <span className="num">II</span>
          <span>{card.recitalII}</span>
        </div>
      </div>

      {/* Expandable payment history */}
      {showHistory && history.length > 0 && (
        <div style={{ borderTop: '1px solid var(--line)', padding: '8px 14px' }} onClick={e => e.stopPropagation()}>
          <div className="allcaps mono" style={{ fontSize: 10, color: 'var(--ink-4)', marginBottom: 6 }}>
            {t.heldLicenses.paymentHistory}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {history.slice(0, 10).map((p) => (
              <div
                key={p.id}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--ink-3)' }}
              >
                <span className="mono">
                  {formatPrice(BigInt(p.base_amount))} PAS
                  {BigInt(p.penalty) > 0n && (
                    <span style={{ color: 'var(--danger)', marginLeft: 6 }}>
                      +{formatPrice(BigInt(p.penalty))} penalty
                    </span>
                  )}
                </span>
                <span className="mono" style={{ color: 'var(--ink-4)' }}>
                  {p.payment_timestamp
                    ? new Date(p.payment_timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : `#${p.block_number}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LegalCite footer */}
      <div style={{
        borderTop: '1px solid var(--line)',
        background: 'color-mix(in srgb, var(--gold) 4%, var(--bg-elev-2))',
        marginTop: 'auto',
      }}>
        <LegalCite workType="literary" compact />
      </div>
    </Link>
  )
}

// ── Obligation stat cell ──
function ObligationStat({
  label,
  value,
  hint,
  accentColor,
  accent,
}: {
  label: string
  value: string | number
  hint?: string
  accentColor?: string
  accent?: boolean
}) {
  return (
    <div style={{ padding: '16px 18px', borderRight: '1px solid var(--line)' }}>
      <div className="allcaps mono" style={{ fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em' }}>{label}</div>
      <div className="mono" style={{
        fontSize: 22,
        color: accentColor ?? (accent ? 'var(--gold-text)' : 'var(--ink)'),
        marginTop: 6,
        letterSpacing: '-0.01em',
      }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

// ── Filter pills ──
function FilterPills({
  value,
  onChange,
  options,
}: {
  value: HeldFilter
  onChange: (v: HeldFilter) => void
  options: Array<{ v: HeldFilter; l: string }>
}) {
  return (
    <div style={{
      display: 'inline-flex',
      padding: 3,
      background: 'var(--bg-elev-2)',
      border: '1px solid var(--line)',
      gap: 2,
      flexWrap: 'wrap',
    }}>
      {options.map(o => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          style={{
            padding: '5px 10px',
            fontSize: 12,
            fontWeight: 500,
            background: value === o.v ? 'var(--bg-elev)' : 'transparent',
            color: value === o.v ? 'var(--ink)' : 'var(--ink-3)',
            boxShadow: value === o.v ? '0 1px 0 rgba(0,0,0,0.15)' : 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}

// ── Main Section ──
export function HeldLicensesSection({
  colors,
  heldLicenses,
  isLoading,
  refetchHeldLicenses,
  searchTerm,
}: {
  colors: ThemeColors
  heldLicenses: UserLicense[]
  isLoading: boolean
  refetchHeldLicenses: () => void
  searchTerm?: string
}) {
  const { t } = useTranslations()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<HeldFilter>('all')

  // Aggregate the latest recurring-payment status from each row.
  const [statusReports, setStatusReports] = useState<Map<string, RowStatusReport>>(() => new Map())

  const handleStatusReport = useCallback((id: string, report: RowStatusReport) => {
    setStatusReports((previous) => {
      const existing = previous.get(id)
      if (
        existing?.payStatus === report.payStatus
        && existing.totalDueBigint === report.totalDueBigint
        && existing.paidTotal === report.paidTotal
      ) return previous
      const next = new Map(previous)
      next.set(id, report)
      return next
    })
  }, [])

  // Attention refs (for scroll-to behavior)
  const attentionRefs = useRef<Map<string, HTMLAnchorElement>>(new Map())

  const searchLower = searchTerm?.toLowerCase().trim() ?? ''
  const visibleLicenses = useMemo(() => {
    return heldLicenses.filter(l => {
      if (!searchLower) return true
      return (
        l.title.toLowerCase().includes(searchLower) ||
        l.licenseId.toString().includes(searchLower) ||
        l.ipAssetId.toString().includes(searchLower)
      )
    })
  }, [heldLicenses, searchLower])

  const recurringIds = useMemo(
    () => visibleLicenses.filter(l => l.paymentInterval > 0n && !l.isRevoked && !l.isConcluded).map(l => l.licenseId.toString()),
    [visibleLicenses],
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SectionHead eyebrow="LICENSES" title={t.heldLicenses.title} sub={t.heldLicenses.subtitle} />
        <SkeletonGrid colors={colors} />
      </div>
    )
  }

  const heldTotal = heldLicenses.length

  // Stats derivable from flat UserLicense[] without hooks
  const renewalsCount = visibleLicenses.filter(l =>
    !l.isRevoked && !l.isConcluded && isExpiringSoon(l)
  ).length

  // allResolved = every recurring-license row has contributed a report
  // statusRev ensures this expression re-evaluates after each report
  const allResolved = recurringIds.length > 0 && recurringIds.every(id => statusReports.has(id))

  // Derive aggregate only when enough rows have reported
  const overdueReports = Array.from(statusReports.values()).filter(r => r.payStatus === 'overdue' || r.payStatus === 'atRisk')
  const dueSoonReports = Array.from(statusReports.values()).filter(r => r.payStatus === 'due')
  const overdueCount = overdueReports.length
  const dueSoonCount = dueSoonReports.length

  const overdueAmtRaw = overdueReports.reduce((s, r) => {
    try { return s + parseFloat(formatPrice(r.totalDueBigint)) } catch { return s }
  }, 0)
  const dueSoonAmtRaw = dueSoonReports.reduce((s, r) => {
    try { return s + parseFloat(formatPrice(r.totalDueBigint)) } catch { return s }
  }, 0)
  const paidLifetimeRaw = Array.from(statusReports.values()).reduce((s, r) => s + r.paidTotal, 0)

  const overdueAmt = formatPasCompact(overdueAmtRaw)
  const dueSoonAmt = formatPasCompact(dueSoonAmtRaw)
  const paidLifetime = formatPasCompact(paidLifetimeRaw)

  // Filter logic
  // For overdue/due-soon filters: rely on resolved statuses only.
  // When not yet resolved, fall back to showing all to avoid false-empty.
  const statusFilteredLicenses = (() => {
    if (filter === 'all') return visibleLicenses
    if (filter === 'renewal') return visibleLicenses.filter(l => !l.isRevoked && !l.isConcluded && isExpiringSoon(l))
    if (filter === 'good-standing') {
      return visibleLicenses.filter(l => {
        const report = statusReports.get(l.licenseId.toString())
        if (!report) return !l.isRevoked && !l.isConcluded
        return report.payStatus === 'paid' || report.payStatus === 'oneTime'
      })
    }
    if (filter === 'overdue') {
      return visibleLicenses.filter(l => {
        const report = statusReports.get(l.licenseId.toString())
        return report && (report.payStatus === 'overdue' || report.payStatus === 'atRisk')
      })
    }
    if (filter === 'due-soon') {
      return visibleLicenses.filter(l => {
        const report = statusReports.get(l.licenseId.toString())
        return report && report.payStatus === 'due'
      })
    }
    return visibleLicenses
  })()

  const registerAttentionRef = (id: string, el: HTMLAnchorElement | null) => {
    if (el) attentionRefs.current.set(id, el)
    else attentionRefs.current.delete(id)
  }

  const scrollToFirstAttention = () => {
    const first = attentionRefs.current.values().next().value
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' })
      first.style.outline = '2px solid var(--danger)'
      setTimeout(() => { first.style.outline = '' }, 1600)
    }
  }

  // Settle-all scrolls to first overdue card (the pay button is on the card)
  const settleAll = () => scrollToFirstAttention()

  const statsLoading = !allResolved && recurringIds.length > 0

  return (
    <div>
      <SectionHead
        eyebrow="LICENSES"
        title={t.heldLicenses.title}
        sub={t.heldLicenses.subtitle}
        actions={
          <button className="btn btn-ghost btn-sm" onClick={refetchHeldLicenses}>
            {t.common.refresh}
          </button>
        }
      />

      {/* Obligation stat row — 4-cell grid */}
      {visibleLicenses.length > 0 && (
        <div className="card" style={{ padding: 0, marginBottom: 18, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            <ObligationStat
              label={t.heldLicenses.stats.overdueObligations}
              value={statsLoading ? t.heldLicenses.stats.loading : overdueCount}
              hint={overdueCount > 0 ? t.heldLicenses.stats.toSettle.replace('{n}', overdueAmt) : undefined}
              accentColor={overdueCount > 0 ? 'var(--danger)' : undefined}
            />
            <ObligationStat
              label={t.heldLicenses.stats.dueSoon}
              value={statsLoading ? t.heldLicenses.stats.loading : dueSoonCount}
              hint={dueSoonCount > 0 ? t.heldLicenses.stats.scheduled.replace('{n}', dueSoonAmt) : undefined}
            />
            <ObligationStat
              label={t.heldLicenses.stats.renewals}
              value={renewalsCount}
              hint={renewalsCount > 0 ? t.heldLicenses.stats.expiringSoon : undefined}
            />
            <ObligationStat
              label={t.heldLicenses.stats.paidLifetime}
              value={statsLoading ? t.heldLicenses.stats.loading : `${paidLifetime} PAS`}
              hint={t.heldLicenses.stats.nLicenses.replace('{n}', String(visibleLicenses.length))}
              accent
            />
          </div>
        </div>
      )}

      {/* Execution alert banner — shown only when real overdue data is confirmed */}
      {!statsLoading && overdueCount > 0 && (
        <div style={{
          padding: '12px 14px',
          background: 'color-mix(in srgb, var(--danger) 12%, var(--bg-elev))',
          border: '1.5px solid var(--danger)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: 14,
        }}>
          <div style={{
            width: 32,
            height: 32,
            flexShrink: 0,
            border: '1.5px solid var(--danger)',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 16,
          }}>!</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="allcaps mono" style={{ color: 'var(--danger)', letterSpacing: '0.08em', fontSize: 10.5 }}>
              {t.heldLicenses.executionAlert}
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 500 }}>
              {t.heldLicenses.executionAlertDetail
                .replace('{n}', String(overdueCount))
                .replace('{plural}', overdueCount === 1 ? '' : 's')}
            </div>
          </div>
          <button
            className="btn btn-primary"
            style={{ flexShrink: 0, background: 'var(--danger)', borderColor: 'var(--danger)', color: 'white', boxShadow: 'none' }}
            onClick={settleAll}
          >
            {t.heldLicenses.settleAll.replace('{n}', overdueAmt)}
          </button>
        </div>
      )}

      {/* Filter pills */}
      {visibleLicenses.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <FilterPills
            value={filter}
            onChange={setFilter}
            options={[
              { v: 'all', l: `${t.heldLicenses.filter.all} · ${visibleLicenses.length}` },
              { v: 'overdue', l: statsLoading ? t.heldLicenses.filter.overdue : `${t.heldLicenses.filter.overdue} · ${overdueCount}` },
              { v: 'due-soon', l: statsLoading ? t.heldLicenses.filter.dueSoon : `${t.heldLicenses.filter.dueSoon} · ${dueSoonCount}` },
              { v: 'renewal', l: `${t.heldLicenses.filter.renewals} · ${renewalsCount}` },
              { v: 'good-standing', l: t.heldLicenses.filter.goodStanding },
            ]}
          />
        </div>
      )}

      {/* Empty state */}
      {visibleLicenses.length === 0 ? (
        heldTotal > 0 && searchLower ? (
          <EmptyState
            icon={Key}
            title={t.common.noSearchMatches.replace('{query}', searchTerm ?? '')}
            subtitle={t.common.noSearchMatchesHint}
          />
        ) : (
          <EmptyState
            icon={Key}
            title={t.heldLicenses.empty}
            subtitle={t.heldLicenses.emptyHint}
            action={{ label: t.heldLicenses.browseExchange, onClick: () => navigate('/explorer') }}
          />
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {statusFilteredLicenses.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              {filter !== 'all' ? t.licensesSection.noResults : t.heldLicenses.empty}
            </div>
          ) : (
            statusFilteredLicenses.map(lic => (
              <HeldLicenseRow
                key={lic.licenseId.toString()}
                lic={lic}
                onPaySuccess={refetchHeldLicenses}
                registerAttentionRef={registerAttentionRef}
                onStatusReport={handleStatusReport}
              />
            ))
          )}
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', textAlign: 'right', marginTop: 4 }}>
            {statusFilteredLicenses.length} / {visibleLicenses.length} total
          </div>
        </div>
      )}
    </div>
  )
}
