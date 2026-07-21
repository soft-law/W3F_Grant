import { Tag, Send, Music, Film, FileText, Code, Drama, Loader2, AlertTriangle, Settings } from 'lucide-react'
import { formatEther } from 'viem'
import type { ThemeColors } from '@/hooks/useTheme'
import { AssetMedia } from './AssetMedia'
import { formatPrice } from '@/lib/contracts'
import { shortenAddress } from '@/lib/contracts'
import { useTranslations } from '@/lib/i18n'
import { timeAgo } from '@/lib/timeAgo'
import { useIPRevenue } from '@/hooks/useIndexed'
import type { ListingItem } from '@/hooks/useIndexed'
import { DocumentBadge } from './DocumentBadge'
import { LegalCite } from '@/components/LegalCite'
import { useNow } from '@/hooks/useNow'

// Map workType to a fallback icon. Used when there's no image (musical, audiovisual,
// literary, dramatic, software) — the metadata file lives in `animation_url` or
// `external_url`, not `image`, so the indexer's `image_url` is empty for these.
function workTypeIcon(category?: string) {
  const c = (category || '').toLowerCase()
  if (c.includes('music')) return Music
  if (c.includes('audio') || c.includes('video') || c.includes('film')) return Film
  if (c.includes('literary') || c.includes('book') || c.includes('text')) return FileText
  if (c.includes('software') || c.includes('code')) return Code
  if (c.includes('dramatic') || c.includes('script') || c.includes('drama')) return Drama
  return Tag
}

// Normalize free-form category strings to the 6 keys the CSS type-rail understands.
// Defaults to 'literary' which has rail-pattern: none — a safe no-op.
function resolveCategory(category?: string): string {
  const c = (category || '').toLowerCase()
  if (c.includes('music')) return 'musical'
  if (c.includes('audio') || c.includes('video') || c.includes('film')) return 'audiovisual'
  if (c.includes('software') || c.includes('code')) return 'software'
  if (c.includes('dramatic') || c.includes('script') || c.includes('drama')) return 'dramatic'
  if (c.includes('artistic') || c.includes('art') || c.includes('visual')) return 'artistic'
  return 'literary'
}

// Derive a short IPFS CID from the listing's best available URI
function extractCid(listing: ListingItem): string | null {
  const candidates = [listing.imageUrl, listing.animationUrl, listing.privateCid]
  for (const c of candidates) {
    if (!c) continue
    if (c.startsWith('ipfs://')) return c.replace('ipfs://', '').slice(0, 24)
    if (c.startsWith('Qm') || c.startsWith('bafy')) return c.slice(0, 24)
  }
  return null
}

// Inline folio strip for listing cards (SL- prefix for IP tokenId)
function ListingFolioStrip({ listing, dataType }: { listing: ListingItem; dataType: string }) {
  const { t } = useTranslations()
  const year = new Date().getFullYear()
  const tokenIdStr = listing.tokenId.toString().padStart(4, '0')
  const typeAbbrev = dataType.slice(0, 3).toUpperCase()
  const prefix = `${t.listingCard.card.folioLabel}-${year}-${tokenIdStr}`
  const hexShort = `0x${listing.tokenId.toString(16).padStart(4, '0').toUpperCase()}`
  return (
    <div className="folio-strip-bg">
      <div className="folio-strip mono">
        <span style={{ color: 'var(--gold-text)', fontWeight: 700 }}>{prefix}</span>
        <span style={{ color: 'var(--line)' }}>│</span>
        <span style={{ color: 'var(--ink-3)' }}>{typeAbbrev}</span>
        <span style={{ color: 'var(--line)' }}>│</span>
        <span style={{ color: 'var(--ink-4)' }}>···</span>
        <span style={{ color: 'var(--line)' }}>│</span>
        <span style={{ color: 'var(--ink-4)' }}>{hexShort}</span>
      </div>
    </div>
  )
}

export function ListingCard({ listing, colors, onBuy, onOffer, onView, isBuying, isOwn, onChallenge }: { listing: ListingItem; colors: ThemeColors; onBuy: () => void; onOffer: () => void; onView: () => void; isBuying: boolean; isOwn: boolean; onChallenge?: () => void }) {
  const { t } = useTranslations()
  const nowMs = useNow()
  const isIP = listing.isERC721
  const FallbackIcon = workTypeIcon(listing.category)
  const dataType = resolveCategory(listing.category)

  // ── Per-IP revenue (from indexer) ──────────────────────────────────────
  // For an IP listing the IP asset id is the tokenId itself. For a license
  // listing the IP it derives from is on `ipAssetId`.
  const ipAssetId = isIP
    ? Number(listing.tokenId)
    : listing.ipAssetId !== undefined ? Number(listing.ipAssetId) : undefined
  const { totalRevenue, royaltyBps, isLoading: revenueLoading, payments } = useIPRevenue(ipAssetId)

  const priceEth = Number(formatEther(listing.price))
  const lifetimeEth = (() => {
    try { return Number(formatEther(BigInt(totalRevenue))) } catch { return 0 }
  })()

  const now = Math.floor(nowMs / 1000)
  const yearAgo = now - 365 * 86400
  const last12Mo = payments.reduce((sum, p) => {
    if (!p.blockTimestamp) return sum
    // The API returns Unix seconds.
    const ts = Math.floor(new Date(Number(p.blockTimestamp) * 1000).getTime() / 1000)
    if (!ts || ts < yearAgo) return sum
    try { return sum + Number(formatEther(BigInt(p.amount ?? '0'))) } catch { return sum }
    return sum
  }, 0)

  const annualYieldPct = priceEth > 0 && last12Mo > 0 ? (last12Mo / priceEth) * 100 : 0
  const monthlyRevEth = last12Mo / 12
  const paybackMonths = priceEth > 0 && monthlyRevEth > 0 ? Math.ceil(priceEth / monthlyRevEth) : 0

  // Sparkline: last 12 payments by chronological order
  const sparklineData = payments.slice(-12).map(p => {
    try { return Number(formatEther(BigInt(p.amount ?? '0'))) } catch { return 0 }
  })
  const sparkMax = Math.max(...sparklineData, 0.0001)
  const showStatsGrid = !revenueLoading && (annualYieldPct > 0 || lifetimeEth > 0)

  // Compute the ribbon from trailing revenue data.
  const hasRevenue = monthlyRevEth > 0
  // Compare the two most recent payment buckets when available.
  const monthlyDeltaPct = (() => {
    if (sparklineData.length < 2) return 0
    const last = sparklineData[sparklineData.length - 1] ?? 0
    const prev = sparklineData[sparklineData.length - 2] ?? 0
    if (prev <= 0) return last > 0 ? 100 : 0
    return ((last - prev) / prev) * 100
  })()

  const buyLabel = isIP ? t.listingCard.acquireIp : t.listingCard.buy
  const card = t.listingCard.card
  const ipfsCid = extractCid(listing)

  return (
    <div
      onClick={onView}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onView()
        }
      }}
      aria-label={`${listing.title}, ${isIP ? 'IP Asset' : 'License'}`}
      className="card group animate-fade-in-up focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gold)]"
      data-type={dataType}
      style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
    >
      <div className="type-rail-v" />

      {/* Folio strip — registry identifier */}
      <ListingFolioStrip listing={listing} dataType={dataType} />

      {/* Thumbnail */}
      <div
        className="relative w-full overflow-hidden flex-shrink-0"
        style={{
          paddingTop: '62%',
          backgroundColor: 'var(--bg-elev-2)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div style={{ position: 'absolute', inset: 0 }}>
          <AssetMedia
            imageUrl={listing.imageUrl}
            animationUrl={listing.animationUrl}
            category={listing.category}
            fallbackIcon={FallbackIcon}
            tokenId={listing.tokenId}
          />
        </div>
        {/* Hover gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* "EXHIBIT A" corner tab — legal attachment framing */}
        <div className="mono" style={{
          position: 'absolute', top: 0, left: 0,
          fontSize: 9, letterSpacing: '0.14em',
          color: 'var(--gold-on-dark)', background: 'rgba(0,0,0,0.78)',
          padding: '2px 8px', fontWeight: 600, zIndex: 2,
        }}>
          {card.exhibitA}
        </div>

        {/* DocumentBadge — top left (below EXHIBIT A) */}
        <div className="absolute top-6 left-2">
          <DocumentBadge category={listing.category || ''} type={isIP ? 'IP' : 'License'} size="sm" colors={colors} />
        </div>

        {/* Top-right stack: Yours pill (if own) + FULL IP / LICENSE badge */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {isOwn && (
            <span className="px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: 'rgba(245,158,11,0.92)', color: 'white', backdropFilter: 'blur(4px)', borderRadius: 2 }}>
              {t.listingCard.yours}
            </span>
          )}
          <span
            className="inline-flex items-center"
            style={{
              background: isIP ? 'rgba(217, 119, 6, 0.92)' : 'rgba(0, 0, 0, 0.65)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.22)',
              fontWeight: 600,
              fontSize: 10,
              letterSpacing: '0.04em',
              padding: '3px 8px',
              backdropFilter: 'blur(4px)',
              borderRadius: 2,
            }}
          >
            {isIP ? `◆ ${t.listingCard.fullIp}` : `◇ ${t.listingCard.license}`}
          </span>
        </div>

        {/* IPFS CID overlay — bottom strip, evidence vocabulary */}
        {ipfsCid && (
          <div style={{
            position: 'absolute', bottom: hasRevenue ? 48 : 0, left: 0, right: 0, zIndex: 2,
            padding: '3px 8px',
            background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.82))',
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: 'rgba(255,255,255,0.78)', letterSpacing: '0.04em',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>{card.cidPrefix} {ipfsCid}…</span>
            <span>{card.shaVerified}</span>
          </div>
        )}

        {/* Live earnings ribbon — only shown when revenue data is present */}
        {hasRevenue && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              padding: '8px 12px 10px',
              background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.85))',
              color: 'white',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              pointerEvents: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="earn-dot" />
              <span className="mono allcaps" style={{ fontSize: 9.5, opacity: 0.72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isIP ? t.listingCard.ipEarning : t.listingCard.licenseEarning}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, minWidth: 0 }}>
                <span className="mono tnum" style={{ fontSize: 18, fontWeight: 700, color: '#FDE68A', whiteSpace: 'nowrap' }}>
                  {monthlyRevEth.toFixed(monthlyRevEth >= 100 ? 0 : 2)}
                </span>
                <span style={{ fontSize: 10, opacity: 0.65, whiteSpace: 'nowrap' }}>{t.listingCard.perMonth}</span>
              </div>
              {monthlyDeltaPct !== 0 && (
                <span className="tnum" style={{ fontSize: 10.5, color: monthlyDeltaPct >= 0 ? 'var(--ok)' : 'var(--danger)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {monthlyDeltaPct >= 0 ? '▲' : '▼'} {Math.abs(monthlyDeltaPct).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Meta */}
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate leading-tight" style={{ color: 'var(--ink)' }}>{listing.title}</p>
          <p className="mono truncate" style={{ fontSize: 10, marginTop: 2, color: 'var(--ink-4)' }}>
            Token #{listing.tokenId.toString()}{listing.category ? ` · ${listing.category}` : ''}
          </p>
          {!isIP && listing.ipAssetId && (
            <p className="mono" style={{ fontSize: 10, marginTop: 2, fontWeight: 500, color: 'var(--gold-text)' }}>IP #{listing.ipAssetId.toString()}</p>
          )}
        </div>

        {/* Financial stats grid — only when revenue data exists */}
        {showStatsGrid && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr auto',
            gap: 1,
            backgroundColor: 'var(--line)',
            border: '1px solid var(--line)',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            {/* Annual Yield */}
            <div style={{ backgroundColor: 'var(--bg-elev)', padding: '6px 8px' }}>
              <div className="mono allcaps" style={{ fontSize: 8, marginBottom: 2, color: 'var(--ink-4)' }}>
                {t.listingCard.annYield}
              </div>
              {annualYieldPct > 0 ? (
                <>
                  <div className="tnum" style={{ color: 'var(--gold-text)', fontWeight: 700, fontSize: 13, lineHeight: 1.1 }}>{annualYieldPct.toFixed(0)}%</div>
                  {paybackMonths > 0 && (
                    <div className="tnum" style={{ color: 'var(--ink-4)', fontSize: 8, marginTop: 1 }}>~{paybackMonths} {t.listingCard.moPayback}</div>
                  )}
                </>
              ) : (
                <div style={{ color: 'var(--ink-4)', fontSize: 11, fontWeight: 600 }}>—</div>
              )}
            </div>

            {/* Lifetime */}
            <div style={{ backgroundColor: 'var(--bg-elev)', padding: '6px 8px' }}>
              <div className="mono allcaps" style={{ fontSize: 8, marginBottom: 2, color: 'var(--ink-4)' }}>
                {t.listingCard.lifetime}
              </div>
              {lifetimeEth > 0 ? (
                <div className="tnum" style={{ color: 'var(--ink)', fontWeight: 700, fontSize: 11, lineHeight: 1.1 }}>
                  {lifetimeEth >= 1000 ? `${(lifetimeEth / 1000).toFixed(1)}k` : lifetimeEth.toFixed(2)}
                </div>
              ) : (
                <div style={{ color: 'var(--ink-4)', fontSize: 11 }}>—</div>
              )}
              {royaltyBps > 0 && (
                <div className="tnum" style={{ color: 'var(--ink-4)', fontSize: 8, marginTop: 1 }}>{(royaltyBps / 100).toFixed(1)}% {t.listingCard.royalty}</div>
              )}
            </div>

            {/* Last 12 mo */}
            <div style={{ backgroundColor: 'var(--bg-elev)', padding: '6px 8px' }}>
              <div className="mono allcaps" style={{ fontSize: 8, marginBottom: 2, color: 'var(--ink-4)' }}>
                {t.listingCard.last12Mo}
              </div>
              {last12Mo > 0 ? (
                <div className="tnum" style={{ color: 'var(--ink)', fontWeight: 700, fontSize: 11, lineHeight: 1.1 }}>
                  {last12Mo >= 1000 ? `${(last12Mo / 1000).toFixed(1)}k` : last12Mo.toFixed(2)}
                </div>
              ) : (
                <div style={{ color: 'var(--ink-4)', fontSize: 11 }}>—</div>
              )}
            </div>

            {/* Revenue sparkline */}
            <div style={{ backgroundColor: 'var(--bg-elev)', padding: '6px 8px', minWidth: 36 }}>
              {sparklineData.length > 1 ? (() => {
                const W = 100, H = 24
                const step = W / (sparklineData.length - 1)
                const path = sparklineData.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(H - (p / sparkMax) * H).toFixed(1)}`).join(' ')
                const fill = `${path} L ${W} ${H} L 0 ${H} Z`
                const lastX = ((sparklineData.length - 1) * step).toFixed(1)
                const lastY = (H - (sparklineData[sparklineData.length - 1] / sparkMax) * H).toFixed(1)
                return (
                  <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 24, display: 'block' }}>
                    <path d={fill} fill="color-mix(in srgb, var(--gold) 18%, transparent)" />
                    <path d={path} fill="none" stroke="var(--gold-deep)" strokeWidth="1.4" strokeLinejoin="round" />
                    <circle cx={lastX} cy={lastY} r="2.2" fill="var(--gold)" />
                  </svg>
                )
              })() : null}
            </div>
          </div>
        )}

        {/* Price hero block */}
        <div style={{
          border: '1px solid color-mix(in srgb, var(--gold) 25%, transparent)',
          backgroundColor: 'color-mix(in srgb, var(--gold) 3%, transparent)',
          borderRadius: 0,
          clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          <span className="mono allcaps" style={{ fontSize: 9, color: 'var(--ink-4)' }}>ASKING</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span className="mono tnum" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>{formatPrice(listing.price)}</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-4)' }}>PAS</span>
          </div>
          <span className="mono truncate" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
            {shortenAddress(listing.seller)}{listing.createdAt > 0 ? ` · ${timeAgo(new Date(listing.createdAt * 1000).toISOString())}` : ''}
          </span>
        </div>

        {/* Recitals */}
        <div style={{ borderTop: '1px dashed var(--line-2)', paddingTop: 6 }}>
          <div className="recital">
            <span className="num">I</span>
            <span>{card.recitalI}</span>
          </div>
          <div className="recital">
            <span className="num">II</span>
            <span>{card.recitalII}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1" onClick={e => e.stopPropagation()}>
          {isOwn && (
            <button
              className="btn btn-ghost btn-sm w-full"
              onClick={e => { e.stopPropagation(); onView() }}
              title={t.listingCard.manage}
            >
              <Settings className="w-3 h-3" style={{ color: 'var(--gold-text)' }} />
              <span style={{ marginLeft: 4 }}>{t.listingCard.manage}</span>
            </button>
          )}
          {!isOwn && (
            <>
              <button
                className="btn btn-primary btn-sm w-full"
                onClick={e => { e.stopPropagation(); onBuy() }}
                disabled={isBuying}
              >
                {isBuying ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                {buyLabel}
              </button>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ flex: 1 }}
                  onClick={e => { e.stopPropagation(); onOffer() }}
                >
                  <Send className="w-3 h-3" style={{ color: 'var(--gold-text)' }} />
                  <span style={{ marginLeft: 4 }}>{isIP ? card.bid : t.listingDetail.makeOffer}</span>
                </button>
                {onChallenge && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{
                      color: 'var(--danger)',
                      borderColor: 'color-mix(in srgb, var(--danger) 45%, var(--line))',
                      padding: '6px 8px',
                    }}
                    title={card.challenge}
                    onClick={e => { e.stopPropagation(); onChallenge() }}
                  >
                    <AlertTriangle className="w-3 h-3" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>

      </div>

      {/* Legal-basis citation footer */}
      <div style={{
        borderTop: '1px solid var(--line)',
        background: 'color-mix(in srgb, var(--gold) 4%, var(--bg-elev-2))',
        marginTop: 'auto',
      }}>
        <LegalCite workType={dataType} compact />
      </div>
    </div>
  )
}
