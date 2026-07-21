import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { ThemeColors } from '@/hooks/useTheme'
import { CATEGORY_COLORS } from '@/lib/constants/colors'
import type { UserIPAsset, UserLicense } from '@/hooks/useContracts'
import { useWithdrawRevenue } from '@/hooks/useContracts'
import { useIPRevenue, useIPRevenueMap, useInvalidateIndexedQueries, useIndexedPaymentStatus } from '@/hooks/useIndexed'
import { useAccount } from 'wagmi'
import { WithdrawalHistory } from '@/components/WithdrawalHistory'
import { useTxToast } from '@/hooks/useTxToast'
import { useTranslations } from '@/lib/i18n'
import { formatPrice } from '@/lib/contracts'
import { formatEther } from 'viem'
import {
  Key, ScrollText, Plus, ExternalLink, DollarSign,
  ChevronDown, ChevronRight, MoreHorizontal,
  AlertTriangle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/Button'
import type { Section } from '../types'
import { SkeletonGrid } from '../components/SkeletonCard'
import { EmptyState } from '../components/EmptyState'
import { ContextMenu } from '../components/ContextMenu'
import { StatusSeal } from '../components/StatusSeal'
import { DocumentBadge } from '../components/DocumentBadge'
import { SectionHead } from '../components/SectionHead'
import { LegalCite } from '@/components/LegalCite'
import { useNow } from '@/hooks/useNow'

// ── Helpers ──

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  copyright: 'literary', artwork: 'artistic', music: 'musical', video: 'audiovisual',
}

function resolveCategory(raw: string): string {
  return LEGACY_CATEGORY_MAP[raw] || raw
}

type StatusFilter = 'all' | 'active' | 'expiring' | 'revoked'
type SortMode = 'revenue' | 'licenses' | 'name'

const NOW_S = () => BigInt(Math.floor(Date.now() / 1000))
const THIRTY_DAYS = BigInt(30 * 86400)

function isExpiringSoon(lic: UserLicense): boolean {
  if (lic.expiryTime === 0n) return false
  const now = NOW_S()
  return lic.expiryTime > now && lic.expiryTime < now + THIRTY_DAYS
}

function parsePasAmount(raw: string): number {
  try { return parseFloat(formatEther(BigInt(raw))) } catch { return 0 }
}

function formatPas(n: number): string {
  if (n === 0) return '0'
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return n.toFixed(2)
}

function licenseStatus(lic: UserLicense): 'active' | 'expired' | 'revoked' {
  if (lic.isRevoked) return 'revoked'
  if (lic.isConcluded) return 'expired'
  if (lic.isExpired || (!lic.isActive && lic.expiryTime !== 0n && lic.expiryTime < NOW_S())) return 'expired'
  return 'active'
}

function _durationLabel(lic: UserLicense): string {
  if (lic.expiryTime === 0n) return 'perpetual'
  const exp = new Date(Number(lic.expiryTime) * 1000)
  return `expires ${exp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

// ── Sub-components ──

function CategoryTag({ category, colors: _colors }: { category: string; colors: ThemeColors }) {
  const resolved = resolveCategory(category)
  const color = CATEGORY_COLORS[resolved as keyof typeof CATEGORY_COLORS] ?? 'var(--ink-4)'
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-semibold"
      style={{ backgroundColor: `${color}18`, color, letterSpacing: '0.08em' }}
    >
      {resolved}
    </span>
  )
}

function LicenseDocCard({ lic, asset, colors }: { lic: UserLicense; asset: UserIPAsset; colors: ThemeColors }) {
  const { t } = useTranslations()
  const nowMs = useNow()
  const status = licenseStatus(lic)
  const card = t.licenseDoc.card
  const year = new Date().getFullYear()
  const licIdStr = lic.licenseId.toString().padStart(4, '0')
  const instrumentNo = `${card.instrumentPrefix}-${year}-${licIdStr}`
  const resolvedCategory = resolveCategory(asset.category)

  const feeDisplay = lic.paymentInterval > 0n
    ? `${(Number(lic.paymentInterval) / 86400).toFixed(0)}d interval`
    : card.perpetual

  // Recurring licenses derive overdue intervals from indexed payment status.
  const isRecurring = lic.paymentInterval > 0n
  const { data: paymentStatusData } = useIndexedPaymentStatus(isRecurring ? Number(lic.licenseId) : undefined)
  const issuerMissedCount = (() => {
    if (!isRecurring) return 0
    if (!paymentStatusData) return 0
    if (!paymentStatusData.nextPaymentDue) return 0
    const nowSec = Math.floor(nowMs / 1000)
    if (paymentStatusData.nextPaymentDue > nowSec) return 0
    if (!paymentStatusData.lastPaymentTime) {
      // Without a payment baseline, defer to indexed status.
      return 0
    }
    const intervalSec = Number(paymentStatusData.paymentInterval ?? lic.paymentInterval)
    if (intervalSec <= 0) return 0
    const elapsed = nowSec - paymentStatusData.lastPaymentTime
    // first interval is on-time; each interval past that is a missed one
    return Math.max(0, Math.floor(elapsed / intervalSec) - 1)
  })()
  const isOverdueIssuer = issuerMissedCount > 0

  const termDisplay = lic.expiryTime === 0n
    ? card.perpetual
    : new Date(Number(lic.expiryTime) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const menuItems: Array<{ icon: LucideIcon; label: string; onClick: () => void; danger?: boolean; disabled?: boolean; divider?: boolean }> = []
  if (lic.publicMetadataURI) {
    menuItems.push({ icon: ScrollText, label: 'View contract', onClick: () => { window.open(lic.publicMetadataURI, '_blank') } })
  }
  menuItems.push({ icon: ExternalLink, label: 'View on explorer', onClick: () => {} })

  return (
    <Link
      to={`/licenses/${lic.licenseId.toString()}?from=issued`}
      className="card"
      data-type={resolvedCategory}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        overflow: 'hidden',
        borderTop: '1px solid var(--line-2)',
        marginLeft: 12,
        textDecoration: 'none',
        color: 'inherit',
        position: 'relative',
        isolation: 'isolate',
        opacity: status === 'revoked' || status === 'expired' ? 0.6 : 1,
        cursor: 'pointer',
      }}
      onClick={e => e.stopPropagation()}
    >
      <div className="type-rail-v" />

      {/* Instrument folio strip */}
      <div className="folio-strip-bg">
        <div className="folio-strip mono" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: 'var(--gold-text)', fontWeight: 700 }}>{instrumentNo}</span>
          <span style={{ color: 'var(--line)' }}>│</span>
          <span style={{ color: 'var(--ink-3)' }}>{resolvedCategory.slice(0, 3).toUpperCase()}</span>
          <span style={{ color: 'var(--line)' }}>│</span>
          <span style={{ color: 'var(--ink-4)' }}>···</span>
          {status === 'active' && (
            <>
              <span style={{ color: 'var(--line)' }}>│</span>
              <span style={{ color: 'var(--gold-text)', fontWeight: 700, letterSpacing: '0.06em' }}>{card.executed}</span>
            </>
          )}
        </div>
      </div>

      {/* Title band */}
      <div style={{ padding: '8px 14px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="doc-title-eyebrow" style={{ marginBottom: 2 }}>
            {lic.isExclusive ? card.exclusive : card.nonExclusive}
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
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => { e.preventDefault(); e.stopPropagation() }}>
          <StatusSeal status={status} size="sm" colors={colors} />
          {menuItems.length > 0 && (
            <ContextMenu compact items={menuItems} trigger={<MoreHorizontal style={{ width: 14, height: 14, color: 'var(--ink-4)' }} />} />
          )}
        </div>
      </div>

      {/* Parties block — two-col monospace */}
      <div style={{
        padding: '6px 14px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        borderTop: '1px solid var(--line-2)',
      }}>
        <div>
          <div className="allcaps mono" style={{ fontSize: 8, color: 'var(--ink-4)', marginBottom: 2 }}>
            {card.licensor}
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {asset.owner ? `${asset.owner.slice(0, 6)}…${asset.owner.slice(-4)}` : asset.title}
          </div>
        </div>
        <div>
          <div className="allcaps mono" style={{ fontSize: 8, color: 'var(--ink-4)', marginBottom: 2 }}>
            {card.licensee}
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)' }}>
            {lic.balance.toString()} / {lic.supply.toString()} {t.licensesSection.heldOf}
          </div>
        </div>
      </div>

      {/* Tally bar — Term / Fee / Royalty / Uses */}
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
            <span className="k">{card.royalty}</span>
            <span className="v tnum" style={{ color: 'var(--ink-3)' }}>—</span>
          </div>
          <div>
            <span className="k">{card.uses}</span>
            <span className="v tnum">{lic.supply.toString()}</span>
          </div>
        </div>
      </div>

      {/* Roman recitals */}
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

      {/* Penalty rate chip if applicable */}
      {lic.penaltyRateBps !== undefined && lic.penaltyRateBps > 0 && (
        <div style={{ padding: '0 14px 8px' }}>
          <span className="chip mono" style={{ fontSize: 9, padding: '1px 6px', color: 'var(--warn)' }}>
            {(lic.penaltyRateBps / 100).toFixed(1)}% {t.ipSection.penaltyRate}
          </span>
        </div>
      )}

      {/* Recurring licenses with confirmed missed payments. */}
      {isOverdueIssuer && (
        <div style={{ padding: '0 14px 8px' }}>
          <span
            className="chip mono inline-flex items-center gap-1"
            style={{
              fontSize: 9,
              padding: '1px 6px',
              color: 'var(--warn)',
              backgroundColor: 'color-mix(in srgb, var(--warn) 12%, transparent)',
              borderColor: 'color-mix(in srgb, var(--warn) 40%, transparent)',
              border: '1px solid color-mix(in srgb, var(--warn) 40%, transparent)',
            }}
            title={t.licensesSection.issuerOverdueTitle}
          >
            <AlertTriangle style={{ width: 9, height: 9 }} />
            {issuerMissedCount === 1
              ? t.licensesSection.missedOneIssuer
              : t.licensesSection.missedManyIssuer.replace('{n}', String(issuerMissedCount))}
          </span>
        </div>
      )}

      {/* LegalCite footer */}
      <div style={{
        borderTop: '1px solid var(--line)',
        background: 'color-mix(in srgb, var(--gold) 4%, var(--bg-elev-2))',
        marginTop: 'auto',
      }}>
        <LegalCite workType={resolvedCategory} compact />
      </div>
    </Link>
  )
}

function buildSparkline(payments: Array<{ amount: string; blockTimestamp: string | null }>, months = 6): number[] {
  const now = Date.now() / 1000
  const buckets = Array(months).fill(0)
  for (const p of payments) {
    const ts = p.blockTimestamp ? Number(p.blockTimestamp) : 0
    const ageSec = now - ts
    const monthIdx = Math.min(months - 1, Math.floor(ageSec / (30 * 86400)))
    buckets[months - 1 - monthIdx] += parsePasAmount(p.amount)
  }
  return buckets
}

function Sparkline({ data, width = 80, height = 24 }: { data: number[]; width?: number; height?: number }) {
  const max = Math.max(...data, 1)
  if (data.length < 2) return null
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * (height - 2)}`).join(' ')
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke="var(--gold)" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  )
}

function IPAssetLicenseGroup({ asset, licensesForAsset, colors, onCreateLicense }: {
  asset: UserIPAsset
  licensesForAsset: UserLicense[]
  colors: ThemeColors
  onCreateLicense: (ipAssetId?: string) => void
}) {
  const { t } = useTranslations()
  const nowMs = useNow()
  const [expanded, setExpanded] = useState(true)
  const { totalRevenue, royaltyBps, payments: revenuePayments, splits, isLoading: revenueLoading } = useIPRevenue(Number(asset.tokenId))
  const [showRevDetails, setShowRevDetails] = useState(false)
  const earned = parsePasAmount(totalRevenue)
  const royaltyPct = (royaltyBps / 100).toFixed(1)
  const sparkData = buildSparkline(revenuePayments)
  const last30 = sparkData[sparkData.length - 1]
  const prev30 = sparkData[sparkData.length - 2]
  const momentum = last30 > prev30 ? '↑' : last30 < prev30 ? '↓' : '—'
  const momentumColor = last30 > prev30 ? 'var(--ok)' : last30 < prev30 ? 'var(--danger)' : 'var(--ink-4)'
  const now12moStart = nowMs / 1000 - 365 * 86400
  const earned12mo = revenuePayments
    .filter(p => p.blockTimestamp && Number(p.blockTimestamp) >= now12moStart)
    .reduce((s, p) => s + parsePasAmount(p.amount), 0)

  const activeCount = licensesForAsset.filter(l => licenseStatus(l) === 'active').length
  const resolved = resolveCategory(asset.category)

  return (
    <div
      className="rounded-sm overflow-hidden"
      style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--line)' }}
    >
      {/* IP header row */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 p-3 text-left transition-colors hover:opacity-90"
        style={{ cursor: 'pointer' }}
      >
        {/* Thumbnail */}
        <div className="flex-shrink-0">
          {asset.imageUrl ? (
            <img
              src={asset.imageUrl}
              alt={asset.title}
              className="rounded object-cover"
              style={{ width: 48, height: 48 }}
            />
          ) : (
            <DocumentBadge category={resolved} size="md" colors={colors} />
          )}
        </div>

        {/* Center: title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {expanded ? (
              <ChevronDown style={{ width: 14, height: 14, color: 'var(--ink-4)', flexShrink: 0 }} />
            ) : (
              <ChevronRight style={{ width: 14, height: 14, color: 'var(--ink-4)', flexShrink: 0 }} />
            )}
            <CategoryTag category={asset.category} colors={colors} />
            <span className="text-[10px] font-mono" style={{ color: 'var(--ink-4)' }}>
              0x{asset.tokenId.toString(16).padStart(4, '0').toUpperCase()}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>
              · {t.licensesSection.royaltyLabel} {royaltyPct}%
            </span>
          </div>
          <p className="text-sm font-semibold truncate mt-0.5" style={{ color: 'var(--ink)' }}>
            {asset.title}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-4)' }}>
            {licensesForAsset.length} {licensesForAsset.length === 1 ? t.licensesSection.licenseOne : t.licensesSection.licenseMany}
            {' · '}{activeCount} {t.common.active.toLowerCase()}
            {asset.creator && <span> · {t.common.by} {asset.creator}</span>}
          </p>
        </div>

        {/* Right: KPI cells + sparkline */}
        <div className="flex-shrink-0 flex items-center gap-4">
          {!revenueLoading && (
            <>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider mono" style={{ color: 'var(--ink-4)' }}>{t.assetDetail.kpi.twelveMo}</p>
                <p className="mono tnum text-xs font-semibold" style={{ color: earned12mo > 0 ? 'var(--gold-text)' : 'var(--ink-4)' }}>
                  {formatPas(earned12mo)} <span style={{ fontSize: 9, color: 'var(--gold-text)' }}>PAS</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider mono" style={{ color: 'var(--ink-4)' }}>{t.assetDetail.kpi.yield}</p>
                <p className="mono text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>{royaltyPct}%</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider mono" style={{ color: 'var(--ink-4)' }}>{t.assetDetail.kpi.momentum}</p>
                <p className="mono text-xs font-bold" style={{ color: momentumColor }}>{momentum}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider mono" style={{ color: 'var(--ink-4)' }}>{t.assetDetail.kpi.lifetime}</p>
                <p className="mono tnum text-xs font-semibold" style={{ color: earned > 0 ? 'var(--gold-text)' : 'var(--ink-4)' }}>
                  {formatPas(earned)} <span style={{ fontSize: 9, color: 'var(--gold-text)' }}>PAS</span>
                </p>
              </div>
              <Sparkline data={sparkData} width={64} height={24} />
            </>
          )}
          {revenueLoading && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--ink-4)' }}>{t.assetDetail.kpi.revenue}</p>
              <p className="text-base font-bold mono" style={{ color: 'var(--ink-4)' }}>—</p>
            </div>
          )}
        </div>
      </button>

      {/* + Add license inline action */}
      <div className="flex justify-end px-3 pb-2" style={{ borderBottom: expanded ? '1px solid var(--line-2)' : 'none' }}>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onCreateLicense(asset.tokenId.toString()) }}
          className="inline-flex items-center gap-1 text-[11px] font-medium rounded px-2 py-1 transition-opacity hover:opacity-80"
          style={{ color: 'var(--gold-text)', backgroundColor: 'color-mix(in srgb, var(--gold) 7%, transparent)' }}
        >
          <Plus style={{ width: 12, height: 12 }} /> {t.licensesSection.addLicense}
        </button>
      </div>

      {/* Expanded license cards */}
      {expanded && licensesForAsset.map(lic => (
        <LicenseDocCard key={lic.licenseId.toString()} lic={lic} asset={asset} colors={colors} />
      ))}

      {/* Revenue details */}
      {expanded && earned > 0 && (
        <div style={{ borderTop: '1px solid var(--line-2)', padding: '8px 12px' }}>
          <button
            type="button"
            onClick={() => setShowRevDetails(v => !v)}
            className="flex items-center gap-1.5 text-[10px] mono"
            style={{ color: 'var(--gold-text)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
          >
            {showRevDetails ? <ChevronDown style={{ width: 10, height: 10 }} /> : <ChevronRight style={{ width: 10, height: 10 }} />}
            {t.ipSection.revenue.totalEarned}: {formatPas(earned)} PAS
          </button>

          {showRevDetails && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Revenue splits */}
              {splits && splits.recipients.length > 0 && (
                <div>
                  <div className="allcaps mono" style={{ fontSize: 10, color: 'var(--ink-4)', marginBottom: 4 }}>
                    {t.ipSection.revenue.splits}
                  </div>
                  {splits.recipients.map((addr, i) => (
                    <div key={addr} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-3)', padding: '2px 0' }}>
                      <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {addr.slice(0, 6)}...{addr.slice(-4)}
                      </span>
                      <span className="mono" style={{ color: 'var(--ink-2)' }}>
                        {(Number(splits.shares[i]) / 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Payment history */}
              {revenuePayments.length > 0 && (
                <div>
                  <div className="allcaps mono" style={{ fontSize: 10, color: 'var(--ink-4)', marginBottom: 4 }}>
                    {t.ipSection.revenue.paymentHistory}
                  </div>
                  {revenuePayments.slice(0, 8).map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-3)', padding: '2px 0' }}>
                      <span className="mono">
                        {formatPrice(BigInt(p.amount))} PAS
                        <span className="chip" style={{ fontSize: 8, marginLeft: 6, padding: '1px 4px', color: p.isPrimarySale ? 'var(--gold-text)' : 'var(--ink-4)', backgroundColor: p.isPrimarySale ? 'color-mix(in srgb, var(--gold) 10%, transparent)' : 'color-mix(in srgb, var(--ink-4) 10%, transparent)' }}>
                          {p.isPrimarySale ? t.ipSection.revenue.primarySale : t.ipSection.revenue.secondarySale}
                        </span>
                      </span>
                      <span className="mono" style={{ color: 'var(--ink-4)' }}>
                        {p.blockTimestamp
                          ? new Date(Number(p.blockTimestamp) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : `#${p.blockNumber}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {revenuePayments.length === 0 && (
                <p className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{t.ipSection.revenue.noPayments}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Category bar chart ──

function CategoryBar({ groups, colors: _colors }: {
  groups: Array<{ category: string; count: number }>
  colors: ThemeColors
}) {
  const { t } = useTranslations()
  const total = groups.reduce((s, g) => s + g.count, 0)
  if (total === 0) return null

  return (
    <div
      className="rounded-sm p-3"
      style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--line)' }}
    >
      <p className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: 'var(--ink-4)' }}>
        {t.licensesSection.byLicenseKind}
      </p>
      {/* Stacked bar */}
      <div className="flex rounded overflow-hidden" style={{ height: 8 }}>
        {groups.map(g => {
          const resolved = resolveCategory(g.category)
          const color = CATEGORY_COLORS[resolved as keyof typeof CATEGORY_COLORS] ?? 'var(--ink-4)'
          return (
            <div
              key={g.category}
              style={{ width: `${(g.count / total) * 100}%`, backgroundColor: color, minWidth: 4 }}
            />
          )
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {groups.map(g => {
          const resolved = resolveCategory(g.category)
          const color = CATEGORY_COLORS[resolved as keyof typeof CATEGORY_COLORS] ?? 'var(--ink-4)'
          return (
            <span key={g.category} className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--ink-2)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color, display: 'inline-block', flexShrink: 0 }} />
              {resolved.charAt(0).toUpperCase() + resolved.slice(1)} {g.count}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ──

interface LicensesSectionProps {
  colors: ThemeColors
  assets: UserIPAsset[]
  licenses: UserLicense[]
  isLoading: boolean
  revenueBalance?: bigint
  onCreateLicense: (ipAssetId?: string) => void
  onSwitchTab?: (tab: Section) => void
  searchTerm?: string
}

export function LicensesSection({ colors, assets, licenses, isLoading, revenueBalance, onCreateLicense, searchTerm }: LicensesSectionProps) {
  const { address } = useAccount()
  const { t } = useTranslations()
  const txToast = useTxToast()
  const invalidateIndexed = useInvalidateIndexedQueries()
  const { withdrawRevenue, hash: withdrawHash, isPending: isWithdrawing, isSuccess: withdrawSuccess } = useWithdrawRevenue()

  useEffect(() => { if (withdrawHash) txToast.onHash(withdrawHash) }, [withdrawHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (withdrawSuccess) { txToast.onConfirmed(t.ipSection.withdraw); invalidateIndexed() } }, [withdrawSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  const formattedRevenue = revenueBalance === undefined
    ? '—'
    : revenueBalance === 0n
      ? '0.0000'
      : formatPrice(revenueBalance)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [sortMode, setSortMode] = useState<SortMode>('revenue')
  const [showCatDropdown, setShowCatDropdown] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)

  // Group licenses by IP asset
  const licensesByAsset = useMemo(() => {
    return licenses.reduce((acc, lic) => {
      const key = lic.ipAssetId.toString()
      if (!acc[key]) acc[key] = []
      acc[key].push(lic)
      return acc
    }, {} as Record<string, UserLicense[]>)
  }, [licenses])

  // Stats
  const totalLicenses = licenses.length
  const activeLicenses = licenses.filter(l => licenseStatus(l) === 'active').length
  const expiringSoon = licenses.filter(l => licenseStatus(l) === 'active' && isExpiringSoon(l)).length
  const revokedLicenses = licenses.filter(l => licenseStatus(l) === 'revoked').length

  // Collect unique categories from assets that have licenses
  const assetsWithLicenses = useMemo(() => {
    return assets.filter(a => licensesByAsset[a.tokenId.toString()]?.length > 0)
  }, [assets, licensesByAsset])

  // Resolve per-asset revenue once for sorting and reuse existing query keys.
  const revenueIds = useMemo(
    () => assetsWithLicenses.map(a => Number(a.tokenId)),
    [assetsWithLicenses],
  )
  const revenueMap = useIPRevenueMap(revenueIds)

  const categoryGroups = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of assetsWithLicenses) {
      const resolved = resolveCategory(a.category)
      const lics = licensesByAsset[a.tokenId.toString()] ?? []
      counts[resolved] = (counts[resolved] ?? 0) + lics.length
    }
    return Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
  }, [assetsWithLicenses, licensesByAsset])

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>()
    for (const a of assetsWithLicenses) cats.add(resolveCategory(a.category))
    return Array.from(cats).sort()
  }, [assetsWithLicenses])

  const searchLower = searchTerm?.toLowerCase() ?? ''

  // Filter + sort
  const filteredGroups = useMemo(() => {
    let filtered = assetsWithLicenses

    if (searchLower) {
      filtered = filtered.filter(a => a.title.toLowerCase().includes(searchLower))
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(a => resolveCategory(a.category) === categoryFilter)
    }

    // Status filter: only keep assets whose licenses pass the filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(a => {
        const lics = licensesByAsset[a.tokenId.toString()] ?? []
        return lics.some(l => {
          const st = licenseStatus(l)
          if (statusFilter === 'active') return st === 'active'
          if (statusFilter === 'expiring') return st === 'active' && isExpiringSoon(l)
          if (statusFilter === 'revoked') return st === 'revoked'
          return true
        })
      })
    }

    // Use token ID as a stable tiebreaker while revenue data resolves.
    if (sortMode === 'name') {
      filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title))
    } else if (sortMode === 'revenue') {
      filtered = [...filtered].sort((a, b) => {
        const rev = parsePasAmount(revenueMap[Number(b.tokenId)] ?? '0') - parsePasAmount(revenueMap[Number(a.tokenId)] ?? '0')
        return rev !== 0 ? rev : Number(b.tokenId - a.tokenId)
      })
    } else {
      filtered = [...filtered].sort((a, b) =>
        (licensesByAsset[b.tokenId.toString()]?.length ?? 0) - (licensesByAsset[a.tokenId.toString()]?.length ?? 0)
      )
    }

    return filtered
  }, [assetsWithLicenses, categoryFilter, statusFilter, sortMode, licensesByAsset, searchLower, revenueMap])

  // Get filtered licenses for a specific asset based on statusFilter
  const getFilteredLicenses = (assetId: string): UserLicense[] => {
    const lics = licensesByAsset[assetId] ?? []
    if (statusFilter === 'all') return lics
    return lics.filter(l => {
      const st = licenseStatus(l)
      if (statusFilter === 'active') return st === 'active'
      if (statusFilter === 'expiring') return st === 'active' && isExpiringSoon(l)
      if (statusFilter === 'revoked') return st === 'revoked'
      return true
    })
  }

  if (isLoading) return <SkeletonGrid colors={colors} />

  const filterTabs: Array<{ id: StatusFilter; label: string; count?: number }> = [
    { id: 'all', label: t.licensesSection.filterAll, count: totalLicenses },
    { id: 'active', label: t.licensesSection.filterActive, count: activeLicenses },
    { id: 'expiring', label: t.licensesSection.filterExpiring, count: expiringSoon },
    { id: 'revoked', label: t.licensesSection.filterRevoked, count: revokedLicenses },
  ]

  return (
    <div className="space-y-4">
      <SectionHead
        colors={colors}
        eyebrow={t.licensesSection.eyebrow}
        title={
          <>
            {t.licensesSection.titleLead}{' '}
            <span style={{ fontStyle: 'italic', color: 'var(--gold-text)' }}>{t.licensesSection.titleEmphasis}</span>{' '}
            {t.licensesSection.titleTail}
          </>
        }
        sub={t.licensesSection.subtitle}
        actions={
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 transition-opacity hover:opacity-80"
            onClick={() => onCreateLicense()}
          >
            <Plus style={{ width: 14, height: 14 }} />
            {t.licensesSection.mintLicense}
          </button>
        }
      />

      {/* Revenue Balance + Withdraw */}
      <div className="p-3 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--gold) 8%, transparent), var(--bg-elev))', border: '1px solid color-mix(in srgb, var(--gold) 19%, transparent)', clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
        <div>
          <p className="text-[11px] uppercase tracking-wide mono" style={{ color: 'var(--ink-4)', letterSpacing: '0.08em' }}>{t.ipSection.revenueBalance}</p>
          <p className="text-xl font-bold mono" style={{ color: 'var(--ink)' }}>{formattedRevenue} <span className="text-xs" style={{ color: 'var(--gold-text)' }}>PAS</span></p>
        </div>
        <Button size="sm" onClick={async () => {
          txToast.start(t.tx.withdrawingRevenue)
          try { await withdrawRevenue() } catch (err) {
            txToast.onError(err instanceof Error ? err : new Error(String(err)))
          }
        }} isLoading={isWithdrawing} disabled={!revenueBalance || revenueBalance === 0n}>
          <DollarSign className="w-3.5 h-3.5 mr-1" /> {t.ipSection.withdraw}
        </Button>
      </div>

      {/* Past revenue draws — renders only once there is history */}
      <WithdrawalHistory recipient={address} source="revenue" />

      {/* Stats row */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-sm overflow-hidden"
        style={{ backgroundColor: 'var(--line)', border: '1px solid var(--line)' }}
      >
        {([
          { label: t.licensesSection.statsTotal, value: String(totalLicenses), accent: false },
          { label: t.licensesSection.statsActive, value: String(activeLicenses), accent: false, sub: expiringSoon > 0 ? t.licensesSection.expiringSoon.replace('{n}', String(expiringSoon)) : undefined },
          { label: t.licensesSection.statsRevoked, value: String(revokedLicenses), accent: false },
          { label: t.licensesSection.statsWithIP, value: String(assetsWithLicenses.length), accent: false },
        ] as Array<{ label: string; value: string; accent: boolean; sub?: string }>).map(stat => (
          <div
            key={stat.label}
            className="flex flex-col gap-0.5 p-3"
            style={{ backgroundColor: 'var(--bg-elev)' }}
          >
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--ink-4)' }}>
              {stat.label}
            </span>
            <span
              className="text-xl font-bold mono"
              style={{
                color: stat.accent ? 'var(--gold-text)' : 'var(--ink)',
              }}
            >
              {stat.value}
            </span>
            {stat.sub && (
              <span className="text-[10px]" style={{ color: 'var(--warn)' }}>{stat.sub}</span>
            )}
          </div>
        ))}
      </div>

      {/* Category bar */}
      {categoryGroups.length > 0 && <CategoryBar groups={categoryGroups} colors={colors} />}

      {/* Filter tabs + dropdowns */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        {/* Tabs */}
        <div className="flex items-center gap-1">
          {filterTabs.map(tab => {
            const active = statusFilter === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className="chip transition-colors"
                style={active ? {
                  backgroundColor: 'color-mix(in srgb, var(--gold) 10%, transparent)',
                  color: 'var(--gold-text)',
                  borderColor: 'color-mix(in srgb, var(--gold) 25%, transparent)',
                } : undefined}
              >
                {tab.label}{tab.count !== undefined ? ` · ${tab.count}` : ''}
              </button>
            )
          })}
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-2">
          {/* Category dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowCatDropdown(v => !v); setShowSortDropdown(false) }}
              className="inline-flex items-center gap-1 text-[11px] font-medium rounded-md px-2.5 py-1.5"
              style={{ border: '1px solid var(--line)', color: 'var(--ink-2)', backgroundColor: 'var(--bg-elev)' }}
            >
              {categoryFilter === 'all' ? t.licensesSection.allWorkTypes : categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1)}
              <ChevronDown style={{ width: 12, height: 12 }} />
            </button>
            {showCatDropdown && (
              <>
                <div className="fixed inset-0" style={{ zIndex: 40 }} onClick={() => setShowCatDropdown(false)} />
                <div
                  className="absolute right-0 top-full mt-1 rounded-sm shadow-lg py-1"
                  style={{ zIndex: 50, minWidth: 140, backgroundColor: 'var(--bg-elev-2)', border: '1px solid var(--line)' }}
                >
                  <button
                    type="button"
                    onClick={() => { setCategoryFilter('all'); setShowCatDropdown(false) }}
                    className="w-full text-left text-xs px-3 py-1.5 hover:opacity-80"
                    style={{ color: categoryFilter === 'all' ? 'var(--gold-text)' : 'var(--ink-2)' }}
                  >
                    {t.licensesSection.allWorkTypes}
                  </button>
                  {uniqueCategories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => { setCategoryFilter(cat); setShowCatDropdown(false) }}
                      className="w-full text-left text-xs px-3 py-1.5 hover:opacity-80"
                      style={{ color: categoryFilter === cat ? 'var(--gold-text)' : 'var(--ink-2)' }}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowSortDropdown(v => !v); setShowCatDropdown(false) }}
              className="inline-flex items-center gap-1 text-[11px] font-medium rounded-md px-2.5 py-1.5"
              style={{ border: '1px solid var(--line)', color: 'var(--ink-2)', backgroundColor: 'var(--bg-elev)' }}
            >
              {t.licensesSection.sortPrefix} {sortMode === 'revenue' ? t.licensesSection.sortRevenue : sortMode === 'licenses' ? t.licensesSection.sortLicenses : t.licensesSection.sortName}
              <ChevronDown style={{ width: 12, height: 12 }} />
            </button>
            {showSortDropdown && (
              <>
                <div className="fixed inset-0" style={{ zIndex: 40 }} onClick={() => setShowSortDropdown(false)} />
                <div
                  className="absolute right-0 top-full mt-1 rounded-sm shadow-lg py-1"
                  style={{ zIndex: 50, minWidth: 120, backgroundColor: 'var(--bg-elev-2)', border: '1px solid var(--line)' }}
                >
                  {(['revenue', 'licenses', 'name'] as SortMode[]).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => { setSortMode(mode); setShowSortDropdown(false) }}
                      className="w-full text-left text-xs px-3 py-1.5 hover:opacity-80"
                      style={{ color: sortMode === mode ? 'var(--gold-text)' : 'var(--ink-2)' }}
                    >
                      {mode === 'revenue' ? t.licensesSection.sortRevenue : mode === 'licenses' ? t.licensesSection.sortLicenses : t.licensesSection.sortName}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {licenses.length === 0 && (
        <EmptyState
          colors={colors}
          icon={Key}
          title={t.licensesSection.noLicenses}
          subtitle={t.licensesSection.noLicensesHint}
          action={{ label: t.licensesSection.mintLicense, onClick: () => onCreateLicense() }}
        />
      )}

      {/* No results after filter */}
      {licenses.length > 0 && filteredGroups.length === 0 && (
        <div className="rounded-sm p-6 text-center" style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--line)' }}>
          <p className="text-sm" style={{ color: 'var(--ink-4)' }}>{t.licensesSection.noResults}</p>
        </div>
      )}

      {/* IP Asset groups */}
      <div className="space-y-3">
        {filteredGroups.map(asset => (
          <IPAssetLicenseGroup
            key={asset.tokenId.toString()}
            asset={asset}
            licensesForAsset={getFilteredLicenses(asset.tokenId.toString())}
            colors={colors}
            onCreateLicense={onCreateLicense}
          />
        ))}
      </div>
    </div>
  )
}
