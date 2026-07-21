import { FolioStrip } from '@/components/FolioStrip'
import { LegalCite } from '@/components/LegalCite'
import { StatusSeal } from './StatusSeal'
import { AssetMedia } from './AssetMedia'
import { useIPRevenue } from '@/hooks/useIndexed'
import { formatEther } from 'viem'
import { useTranslations } from '@/lib/i18n'
import type { ThemeColors } from '@/hooks/useTheme'

type ValidStatus = 'active' | 'indexing' | 'disputed' | 'expired' | 'revoked' | 'stuck' | 'invalidated'
const VALID_STATUSES: ReadonlySet<string> = new Set(['active', 'indexing', 'disputed', 'expired', 'revoked', 'stuck', 'invalidated'])

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  copyright: 'literary',
  artwork: 'artistic',
  music: 'musical',
  video: 'audiovisual',
}

function resolveCategory(raw: string): string {
  return LEGACY_CATEGORY_MAP[raw] || raw
}

function formatDate(val: string | number): string {
  try {
    const d = typeof val === 'number' ? new Date(val < 1e12 ? val * 1000 : val) : new Date(val)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return '' }
}

// Tally bar component — "schedule of charges" strip
function TallyBar({ tokenId, licenses, listings }: { tokenId: bigint; licenses?: number; listings?: number }) {
  const { t } = useTranslations()
  const { totalRevenue, isLoading } = useIPRevenue(Number(tokenId))
  const earned = (() => { try { return parseFloat(formatEther(BigInt(totalRevenue))) } catch { return 0 } })()
  const card = t.ipSection.card

  return (
    <div className="tally-bar">
      <div>
        <span className="k">{card.licenses}</span>
        <span className="v">{String(licenses ?? 0)}</span>
      </div>
      <div>
        <span className="k">{card.offerings}</span>
        <span className="v">{String(listings ?? 0)}</span>
      </div>
      <div>
        <span className="k">{card.receivables}</span>
        <span className="v tnum" style={{ color: earned > 0 ? 'var(--gold-text)' : 'var(--ink-3)' }}>
          {isLoading ? '—' : earned > 0 ? (
            <>
              {earned.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
              <span style={{ color: 'var(--ink-4)', fontSize: 9 }}>PAS</span>
            </>
          ) : '—'}
        </span>
      </div>
    </div>
  )
}

export interface AssetCardProps {
  asset: {
    tokenId: bigint
    title: string
    description?: string
    category: string
    imageUrl?: string
    animationUrl?: string
    metadataURI?: string
    owner: string
    isWrapped?: boolean
    royaltyRate?: bigint | number
    createdAt?: string | number
    status?: string
  }
  licenses?: number
  listings?: number
  colors: ThemeColors
  onClick?: () => void
  onCreateLicense?: () => void
  onCreateListing?: () => void
  onGenerateCertificate?: () => void
  onFileNotice?: () => void
  jurisdiction?: string
  // Optional extra buttons appended to the action rail (e.g. Certificate, ContextMenu)
  actionExtras?: React.ReactNode
  // Optional slot for StudioSection's license rows + inline forms
  extensionContent?: React.ReactNode
}

export function AssetCard({
  asset,
  licenses,
  listings,
  colors: _colors,
  onClick,
  onCreateLicense,
  onCreateListing,
  onFileNotice,
  jurisdiction,
  actionExtras,
  extensionContent,
}: AssetCardProps) {
  const { t } = useTranslations()
  const card = t.ipSection.card
  const resolvedCategory = resolveCategory(asset.category || '')

  const rawStatus = asset.status ?? 'active'
  const status: ValidStatus = VALID_STATUSES.has(rawStatus) ? (rawStatus as ValidStatus) : 'active'

  // Derive display values
  const royaltyPct = asset.royaltyRate !== undefined
    ? ((Number(asset.royaltyRate) || 0) / 100).toFixed(1)
    : null

  const ipfsShort = asset.metadataURI
    ? asset.metadataURI.startsWith('ipfs://')
      ? asset.metadataURI.replace('ipfs://', '').slice(0, 24)
      : asset.metadataURI.slice(0, 24)
    : null

  return (
    <div
      className="card"
      data-type={resolvedCategory}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        position: 'relative',
        isolation: 'isolate',
      }}
      onClick={onClick}
    >
      {/* Vertical type-rail — 4px left border, pattern-coded per IP type */}
      <div className="type-rail-v" />

      {/* 1. Folio strip — legal-side identifier */}
      <FolioStrip tokenId={asset.tokenId} workType={resolvedCategory} jurisdiction={jurisdiction} />

      {/* 2. Preview strip — landscape exhibit */}
      <div style={{
        position: 'relative',
        paddingTop: '40%',
        background: 'var(--bg-input)',
        overflow: 'hidden',
        borderBottom: '1px solid var(--line)',
      }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <AssetMedia
            imageUrl={asset.imageUrl}
            animationUrl={asset.animationUrl}
            category={resolvedCategory}
            tokenId={asset.tokenId}
          />
        </div>

        {/* "EXHIBIT A" corner tab — reframes image as legal attachment */}
        <div className="mono" style={{
          position: 'absolute', top: 0, left: 0,
          fontSize: 9, letterSpacing: '0.14em',
          color: 'var(--gold-on-dark)', background: 'rgba(0,0,0,0.78)',
          padding: '2px 8px', fontWeight: 600, zIndex: 2,
        }}>
          {card.exhibitA}
        </div>

        {/* Status seal — overlaid top-right */}
        <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 3 }}>
          <StatusSeal status={status} size="sm" context="asset" />
        </div>

        {/* IPFS CID overlay — bottom gradient strip, evidence vocabulary */}
        {ipfsShort && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2,
            padding: '3px 8px',
            background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.82))',
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: 'rgba(255,255,255,0.78)', letterSpacing: '0.04em',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>{card.cidPrefix} {ipfsShort}…</span>
            <span>{card.shaVerified}</span>
          </div>
        )}
      </div>

      {/* 3. Title block */}
      <div style={{ padding: '10px 14px 6px' }}>
        {/* Eyebrow — registry category label */}
        <div className="doc-title-eyebrow" style={{ marginBottom: 3 }}>
          {resolvedCategory.toUpperCase()}
        </div>
        <p className="display" style={{
          fontSize: 'calc(14px * var(--type-scale))',
          fontWeight: 700,
          lineHeight: 1.2,
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
          margin: 0,
          textWrap: 'balance',
        } as React.CSSProperties}>
          {asset.title}
        </p>
        {(asset.owner || asset.createdAt) && (
          <div className="mono" style={{ fontSize: 9, color: 'var(--ink-4)', marginTop: 3, display: 'flex', gap: 6 }}>
            {asset.owner && (
              <span>{asset.owner.slice(0, 6)}…{asset.owner.slice(-4)}</span>
            )}
            {asset.owner && asset.createdAt && <span style={{ color: 'var(--line)' }}>·</span>}
            {asset.createdAt && <span>{formatDate(asset.createdAt)}</span>}
          </div>
        )}
      </div>

      {/* 4. Royalty + jurisdiction chips */}
      {(royaltyPct !== null || jurisdiction) && (
        <div style={{ padding: '0 14px 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {royaltyPct !== null && (
            <span className="chip mono" style={{ fontSize: 9, padding: '1px 6px' }}>
              <span style={{ color: 'var(--gold-text)' }}>royalty</span>
              <span style={{ color: 'var(--ink-2)' }}>{royaltyPct}%</span>
            </span>
          )}
          {jurisdiction && (
            <span className="chip mono" style={{ fontSize: 9, padding: '1px 6px', color: 'var(--ink-3)' }}>
              jur. <span style={{ color: 'var(--ink-2)' }}>
                {jurisdiction.length > 14 ? `${jurisdiction.slice(0, 12)}…` : jurisdiction}
              </span>
            </span>
          )}
        </div>
      )}

      {/* 5. Tally bar — Licenses · Offerings · Receivables */}
      <div style={{ padding: '0 14px 10px' }}>
        <TallyBar tokenId={asset.tokenId} licenses={licenses} listings={listings} />
      </div>

      {/* 6. Recitals — short roman clause summary */}
      <div style={{ padding: '0 14px 10px', borderTop: '1px dashed var(--line-2)' }}>
        <div className="recital">
          <span className="num">I</span>
          <span>{card.recitalI}</span>
        </div>
        <div className="recital">
          <span className="num">II</span>
          <span>{card.recitalII}</span>
        </div>
      </div>

      {/* 7. Action rail — wraps when card is narrow so Certificate + kebab stay reachable */}
      <div
        style={{ padding: '0 14px 10px', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'stretch' }}
        onClick={e => e.stopPropagation()}
      >
        {onCreateLicense && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ flex: '1 1 0', minWidth: 88 }}
            onClick={e => { e.stopPropagation(); onCreateLicense() }}
          >
            {card.issueLicense}
          </button>
        )}
        {onCreateListing && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ flex: '1 1 0', minWidth: 64 }}
            onClick={e => { e.stopPropagation(); onCreateListing() }}
          >
            {card.list}
          </button>
        )}
        {onFileNotice && (
          <button
            className="btn btn-ghost btn-sm"
            style={{
              color: 'var(--danger)',
              borderColor: 'color-mix(in srgb, var(--danger) 45%, var(--line))',
              padding: '6px 8px',
              flex: '1 1 100%',
              marginTop: 2,
            }}
            title={card.fileNotice}
            onClick={e => { e.stopPropagation(); onFileNotice() }}
          >
            {card.fileNotice}
          </button>
        )}
        {actionExtras}
      </div>

      {/* 8. Legal-basis citation footer */}
      <div style={{
        borderTop: '1px solid var(--line)',
        background: 'color-mix(in srgb, var(--gold) 4%, var(--bg-elev-2))',
      }}>
        <LegalCite workType={resolvedCategory} compact />
      </div>

      {/* 9. Optional extension slot (license rows, inline forms from StudioSection) */}
      {extensionContent && (
        <div onClick={e => e.stopPropagation()}>
          {extensionContent}
        </div>
      )}
    </div>
  )
}
