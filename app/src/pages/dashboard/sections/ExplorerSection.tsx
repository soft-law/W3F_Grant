import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Transaction } from '@/lib/timeAgo'
import {
  RefreshCw, Plus, Tag,
  MessageCircle, Activity, ExternalLink,
  Music, Film, FileText, Code, Drama, ShoppingCart,
} from 'lucide-react'
import type { ThemeColors } from '@/hooks/useTheme'
import { AssetMedia } from '../components/AssetMedia'
import { getEventColor, getEventIcon } from '@/lib/explorerEvents'
import type { ContractEvent } from '@/lib/explorerEvents'
import { humanizeEvent as humanizeEventVerb } from '@/lib/humanizeEvent'
import { useIndexedActiveOffers, useIndexedExplorerEvents, useIndexedAllAssets } from '@/hooks/useIndexed'
import type { ListingItem } from '@/hooks/useIndexed'
import {
  explorerUrlForEvent, formatPrice, shortenAddress,
} from '@/lib/contracts'
import { useTranslations } from '@/lib/i18n'
import { timeAgo } from '@/lib/timeAgo'
import { SkeletonEventRows } from '../components/SkeletonCard'
import { SkeletonCard } from '../components/SkeletonCard'
import { EmptyState } from '../components/EmptyState'
import { ListingCard } from '../components/ListingCard'
import { SectionHead } from '../components/SectionHead'
import { canonicalEntityRoute, canonicalEventEntityRoute, withEntityFocus } from '@/lib/entity-routes'
import { isOfferAcceptable } from '@/lib/marketplace-state'
import { useNow } from '@/hooks/useNow'

type WorkTypeFilter = 'all' | 'musical' | 'audiovisual' | 'literary' | 'software' | 'dramatic' | 'other'
type SortMode = 'newest' | 'price-asc' | 'price-desc'

interface ExplorerSectionProps {
  colors: ThemeColors
  listings?: ListingItem[]
  address?: string
  onListWork?: () => void
  onMyOffers?: () => void
  searchTerm?: string
  transactions?: Transaction[]
  isLoadingTx?: boolean
}

// ── Human-readable activity helper ─────────────────────────────────────────
// Builds the verb + actor + subject + amount tuple for the live ledger.
// Verb lookup delegates to the shared humanizeEvent util.
function buildEventDisplay(event: ContractEvent): {
  verb: string
  actor: string
  title: string
  amount: bigint | undefined
} {
  const args = event.args as Record<string, unknown>
  const verb = humanizeEventVerb(event.eventName)

  const actor = (
    args.from
    ?? args.seller
    ?? args.buyer
    ?? args.submitter
    ?? args.operator
    ?? args.licensee
    ?? ''
  ) as string

  const titleArg = args.title as string | undefined
  const tokenIdArg = args.tokenId
  const title = titleArg
    ?? (tokenIdArg !== undefined && tokenIdArg !== null ? `#${String(tokenIdArg)}` : '')

  let amount: bigint | undefined
  const rawAmt = args.price ?? args.amount
  if (rawAmt !== undefined && rawAmt !== null) {
    try { amount = BigInt(rawAmt as string | number) } catch { /* skip */ }
  }

  return { verb, actor, title, amount }
}

function categoryMatches(category: string | undefined, filter: WorkTypeFilter): boolean {
  if (filter === 'all') return true
  const c = (category || '').toLowerCase()
  switch (filter) {
    case 'musical': return c.includes('music')
    case 'audiovisual': return c.includes('audio') || c.includes('video') || c.includes('film')
    case 'literary': return c.includes('literary') || c.includes('book') || c.includes('text')
    case 'software': return c.includes('software') || c.includes('code')
    case 'dramatic': return c.includes('dramatic') || c.includes('script') || c.includes('drama')
    case 'other': return !(
      c.includes('music') || c.includes('audio') || c.includes('video') || c.includes('film')
      || c.includes('literary') || c.includes('book') || c.includes('text')
      || c.includes('software') || c.includes('code')
      || c.includes('dramatic') || c.includes('script') || c.includes('drama')
    )
    default: return true
  }
}

function workTypeIcon(category?: string) {
  const c = (category || '').toLowerCase()
  if (c.includes('music')) return Music
  if (c.includes('audio') || c.includes('video') || c.includes('film')) return Film
  if (c.includes('literary') || c.includes('book') || c.includes('text')) return FileText
  if (c.includes('software') || c.includes('code')) return Code
  if (c.includes('dramatic') || c.includes('script') || c.includes('drama')) return Drama
  return Tag
}

function PulseStat({
  label, value, accent, live, isLast,
}: { label: string; value: string | number; accent?: boolean; live?: boolean; colors?: ThemeColors; isLast?: boolean }) {
  return (
    <div
      className="flex flex-col gap-1 min-w-0"
      style={{
        padding: '12px 16px',
        borderRight: isLast ? undefined : '1px solid var(--line)',
      }}
    >
      <span className="allcaps mono truncate" style={{ color: 'var(--ink-4)' }}>
        {label}
      </span>
      <span className="flex items-center gap-1.5 min-w-0">
        {live && <span className="earn-dot" />}
        <span
          className="text-xl font-bold truncate tnum"
          style={{ color: accent ? 'var(--gold-text)' : 'var(--ink)' }}
        >
          {value}
        </span>
      </span>
    </div>
  )
}

// The live feed shows market pulse (mints, sales, licenses, disputes, offers, revenue).
// Lifecycle/admin wiring events add noise without reader value; their history
// lives in on-chain provenance + Blockscout links, not the feed.
const LIFECYCLE_FEED_EXCLUDE = new Set([
  'RoleGranted',
  'RoleRevoked',
  'Upgraded',
  'DisputeBondUpdated',
  'ArbitratorContractSet',
  'ArbitratorContractUpdated',
  'LicenseTokenContractSet',
  'MarketplaceContractUpdated',
  'RevenueDistributorSet',
])

export function ExplorerSection({ colors, listings, address, onListWork, onMyOffers, searchTerm, transactions }: ExplorerSectionProps) {
  const { t } = useTranslations()
  const navigateTo = useNavigate()
  const [workType, setWorkType] = useState<WorkTypeFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('newest')

  // Pull a wider event window for the live feed + stats; tabs filter from here.
  const { events, isLoading, refetch } = useIndexedExplorerEvents('all', 200)
  const { offers: indexedOpenOffers, isLoading: offersLoading, refetch: refetchOffers } = useIndexedActiveOffers(24)
  const offerNow = BigInt(Math.floor(useNow() / 1000))
  const openOffers = useMemo(
    () => indexedOpenOffers.filter(offer => isOfferAcceptable(offer, offerNow)),
    [indexedOpenOffers, offerNow],
  )

  const txMap = useMemo(() => {
    const m = new Map<string, Transaction>()
    if (transactions) {
      for (const tx of transactions) {
        if (tx.hash) m.set(tx.hash.toLowerCase(), tx)
      }
    }
    return m
  }, [transactions])
  const { assets: allAssets } = useIndexedAllAssets()
  const assetMap = useMemo(() => {
    const m = new Map<string, typeof allAssets[number]>()
    for (const a of allAssets) m.set(String(a.tokenId), a)
    return m
  }, [allAssets])

  // ── Stats ──
  const stats = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    const dayAgo = now - 86400
    const latestBlock = events[0]?.blockNumber?.toString() ?? '--'

    let mints24h = 0
    let volume24h = 0n
    for (const ev of events) {
      const ts = ev.blockTimestamp ?? 0
      const within24h = ts > 0 && ts >= dayAgo
      if (ev.eventName === 'IPMinted' && within24h) mints24h++
      if (within24h && ev.eventName === 'Sale') {
        const raw = (ev.args as { price?: string | number | bigint }).price
        if (raw !== undefined && raw !== null) {
          try { volume24h += BigInt(raw as string | number) } catch { /* skip */ }
        }
      }
    }

    return {
      latestBlock,
      mints24h,
      volume24h,
      offerCount: openOffers.length,
      listingCount: listings?.length ?? 0,
    }
  }, [events, listings, openOffers.length])

  // ── Tab content sources ──
  const searchLower = searchTerm?.toLowerCase() ?? ''

  const filteredListings = useMemo(() => {
    if (!listings) return []
    let filtered = listings.filter(l => categoryMatches(l.category, workType))
    if (searchLower) filtered = filtered.filter(l => (l.title ?? '').toLowerCase().includes(searchLower))
    const sorted = [...filtered]
    if (sortMode === 'price-asc') sorted.sort((a, b) => {
      const pa = BigInt(a.price || '0'); const pb = BigInt(b.price || '0'); return pa < pb ? -1 : pa > pb ? 1 : 0
    })
    else if (sortMode === 'price-desc') sorted.sort((a, b) => {
      const pa = BigInt(a.price || '0'); const pb = BigInt(b.price || '0'); return pa > pb ? -1 : pa < pb ? 1 : 0
    })
    return sorted
  }, [listings, workType, sortMode, searchLower])

  const recentMints = useMemo(() => {
    let mints = events.filter(e => e.eventName === 'IPMinted')
    if (searchLower) {
      mints = mints.filter(e => {
        const tokenId = (e.args as { tokenId?: string | number | bigint }).tokenId
        const asset = tokenId !== undefined ? assetMap.get(String(tokenId)) : undefined
        return asset ? asset.title.toLowerCase().includes(searchLower) : false
      })
    }
    return mints.slice(0, 24)
  }, [events, searchLower, assetMap])

  // ── Live-feed curation ──
  const feedEvents = useMemo(
    () => events.filter(e => !LIFECYCLE_FEED_EXCLUDE.has(e.eventName)),
    [events],
  )

  // ── Section divider ──
  function SectionDivider({ label, count }: { label: string; count: number }) {
    return (
      <div
        className="flex items-center gap-3 py-2"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        <span className="allcaps mono" style={{ color: 'var(--ink-4)' }}>
          § {label}
        </span>
        <span
          className="mono tnum"
          style={{ fontSize: 10, padding: '2px 6px', backgroundColor: 'var(--bg-elev-2)', color: 'var(--gold-text)' }}
        >
          {count}
        </span>
      </div>
    )
  }

  return (
    <>
    <div className="space-y-6">
      <SectionHead
        colors={colors}
        eyebrow={`§ ${t.explorer.title} · ${t.explorer.kicker}`}
        title={t.explorer.tagline}
        actions={
          <>
            {onListWork && (
              <button onClick={onListWork} className="btn btn-ghost btn-sm">
                <Tag style={{ width: 12, height: 12 }} />
                {t.explorer.listWork}
              </button>
            )}
            <button
              onClick={() => {
                if (onMyOffers) { onMyOffers(); return }
                const el = document.getElementById('explorer-open-offers')
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className="btn btn-primary btn-sm"
            >
              <ShoppingCart style={{ width: 12, height: 12 }} />
              {t.explorer.myOffers} · {openOffers.length}
            </button>
          </>
        }
      />

      {/* ── PulseStats bar ── */}
      <div className="overflow-x-auto">
        <div
          className="card grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            padding: 0,
          }}
        >
          <PulseStat label={t.explorer.stats.block} value={stats.latestBlock} live colors={colors} />
          <PulseStat
            label={t.explorer.stats.volume24h}
            value={`${formatPrice(stats.volume24h)} PAS`}
            accent
            colors={colors}
          />
          <PulseStat label={t.explorer.stats.listings} value={stats.listingCount} colors={colors} />
          <PulseStat label={t.explorer.stats.offers} value={stats.offerCount} colors={colors} />
          <PulseStat label={t.explorer.stats.mints24h} value={stats.mints24h} colors={colors} isLast />
        </div>
      </div>

      {/* ── 2-column layout: main + live feed aside ── */}
      <div className="grid gap-6 md:grid-cols-[1fr_320px] items-start">
        {/* ── Main: three stacked sections ── */}
        <div className="min-w-0 space-y-8">
          {/* Filter pills + sort */}
          <div className="flex flex-wrap items-center gap-2">
            {([
              ['all', t.explorer.allWorkTypes],
              ['musical', t.explorer.workTypes.musical],
              ['audiovisual', t.explorer.workTypes.audiovisual],
              ['literary', t.explorer.workTypes.literary],
              ['software', t.explorer.workTypes.software],
              ['dramatic', t.explorer.workTypes.dramatic],
              ['other', t.explorer.workTypes.other],
            ] as [WorkTypeFilter, string][]).map(([id, label]) => {
              const active = workType === id
              return (
                <button
                  key={id}
                  onClick={() => setWorkType(id)}
                  className="chip"
                  style={{
                    backgroundColor: active ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : undefined,
                    borderColor: active ? 'var(--gold)' : undefined,
                    color: active ? 'var(--gold-text)' : undefined,
                  }}
                >
                  {label}
                </button>
              )
            })}

            <div className="flex items-center gap-2 ml-auto">
              <select
                value={sortMode}
                onChange={e => setSortMode(e.target.value as SortMode)}
                className="input mono"
                style={{ width: 'auto', padding: '4px 8px', fontSize: 11 }}
              >
                <option value="newest">{t.explorer.sort.newest}</option>
                <option value="price-asc">{t.explorer.sort.priceAsc}</option>
                <option value="price-desc">{t.explorer.sort.priceDesc}</option>
              </select>
              <button
                onClick={() => { refetch(); refetchOffers() }}
                className="btn-icon"
                title="Refresh"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
                  style={{ color: 'var(--ink-4)' }}
                />
              </button>
            </div>
          </div>

          {/* ── § Listed for sale ── */}
          <section className="space-y-3">
            <SectionDivider label={t.explorer.tabs.listed} count={filteredListings.length} />
            {filteredListings.length === 0 ? (
              searchLower ? (
                <EmptyState
                  colors={colors}
                  icon={Tag}
                  title={t.common.noSearchMatches.replace('{query}', searchTerm ?? '')}
                  subtitle={t.common.noSearchMatchesHint}
                />
              ) : (
                <EmptyState colors={colors} icon={Tag} title={t.explorer.noListings} />
              )
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredListings.map((listing, idx) => (
                  <div key={listing.id} className="animate-fade-in-up" style={{ animationDelay: `${Math.min(idx * 0.05, 0.6)}s` }}>
                    <ListingCard
                      listing={listing}
                      colors={colors}
                      onBuy={() => navigateTo(`/explorer/listing/${listing.listingId}`)}
                      onOffer={() => navigateTo(`/explorer/listing/${listing.listingId}`)}
                      onView={() => navigateTo(`/explorer/listing/${listing.listingId}`)}
                      isBuying={false}
                      isOwn={!!address && listing.seller.toLowerCase() === address.toLowerCase()}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── § Open offers ── */}
          <section id="explorer-open-offers" className="space-y-3 scroll-mt-20">
            <SectionDivider label={t.explorer.tabs.openOffers} count={openOffers.length} />
            {offersLoading && openOffers.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} colors={colors} />
                ))}
              </div>
            ) : openOffers.length === 0 ? (
              <EmptyState colors={colors} icon={MessageCircle} title={t.explorer.noOpenOffers} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {openOffers.map((offer, idx) => {
                  const tokenId = offer.tokenId
                  const price = offer.price
                  const buyer = offer.buyer
                  const entityRoute = canonicalEntityRoute(offer)
                  const offerRoute = entityRoute ? withEntityFocus(entityRoute, 'offers') : null
                  let priceStr = '—'
                  if (price !== undefined && price !== null) {
                    try { priceStr = `${formatPrice(price)} PAS` } catch { priceStr = String(price) }
                  }
                  return (
                    <Link
                      key={offer.offerId}
                      to={offerRoute ?? `/explorer`}
                      className="card animate-fade-in-up flex items-center gap-3"
                      style={{ padding: 12, animationDelay: `${Math.min(idx * 0.05, 0.6)}s` }}
                      aria-label={`${priceStr} offer for token ${tokenId !== undefined ? String(tokenId) : '?'}`}
                    >
                      <div
                        className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: `${getEventColor('OfferCreated')}20`,
                          color: getEventColor('OfferCreated'),
                        }}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="mono text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                            #{tokenId !== undefined ? String(tokenId) : '?'}
                          </span>
                          <span className="mono tnum text-sm font-bold" style={{ color: 'var(--gold-text)' }}>
                            {priceStr}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
                          {buyer && <span>{shortenAddress(buyer)}</span>}
                          <span>·</span>
                          <span>{t.explorer.block} {offer.blockNumber.toString()}</span>
                          {offer.expiryTime > 0n && (
                            <>
                              <span>·</span>
                              <span>{t.incomingOffers.expires} {new Date(Number(offer.expiryTime) * 1000).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── § Just minted ── */}
          <section className="space-y-3">
            <SectionDivider label={t.explorer.tabs.justMinted} count={recentMints.length} />
            {isLoading && events.length === 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} colors={colors} />
                ))}
              </div>
            ) : recentMints.length === 0 ? (
              <EmptyState colors={colors} icon={Plus} title={t.explorer.noMints} />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {recentMints.map((ev, idx) => {
                  const tokenId = (ev.args as { tokenId?: string | number | bigint }).tokenId
                  const asset = tokenId !== undefined ? assetMap.get(String(tokenId)) : undefined
                  const FallbackIcon = workTypeIcon(asset?.category ?? (ev.args as { workType?: string }).workType)
                  const entityRoute = canonicalEventEntityRoute(ev)
                  return (
                    <Link
                      key={ev.id}
                      to={entityRoute ?? '/explorer'}
                      className="card group animate-fade-in-up flex flex-col gap-2"
                      style={{ padding: 0, overflow: 'hidden', animationDelay: `${Math.min(idx * 0.05, 0.6)}s` }}
                    >
                      <div
                        className="relative aspect-square w-full flex items-center justify-center overflow-hidden"
                        style={{ backgroundColor: 'var(--bg-elev-2)' }}
                      >
                        <AssetMedia
                          imageUrl={asset?.imageUrl}
                          animationUrl={asset?.animationUrl}
                          category={asset?.category}
                          fallbackIcon={FallbackIcon}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap px-2.5">
                        <span
                          className="type-tag"
                          style={{ fontSize: 10 }}
                        >
                          {asset?.category ?? ev.contract}
                        </span>
                        <span className="mono text-xs font-semibold truncate" style={{ color: 'var(--ink)' }}>
                          #{tokenId !== undefined ? String(tokenId) : '?'}
                        </span>
                      </div>
                      {asset && (
                        <div className="text-xs font-medium truncate px-2.5" style={{ color: 'var(--ink)' }}>
                          {asset.title}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mono px-2.5 pb-2.5" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
                        <span>{t.explorer.block} {ev.blockNumber.toString()}</span>
                        {ev.blockTimestamp && (
                          <>
                            <span>·</span>
                            <span>{timeAgo(new Date(ev.blockTimestamp * 1000).toISOString())}</span>
                          </>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* ── Live feed aside (desktop only) ── */}
        <aside
          className="hidden md:block"
          style={{ position: 'sticky', top: 80 }}
        >
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              className="flex items-center justify-between px-3 py-2"
              style={{ borderBottom: '1px solid var(--line)' }}
            >
              <div className="flex items-center gap-2">
                <span className="earn-dot" />
                <span className="allcaps mono" style={{ color: 'var(--ink-4)' }}>
                  {t.explorer.liveFeed}
                </span>
              </div>
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
                blk {stats.latestBlock}
              </span>
            </div>
            <div
              className="overflow-y-auto"
              style={{ maxHeight: 460 }}
            >
              {isLoading && feedEvents.length === 0 ? (
                <SkeletonEventRows colors={colors} />
              ) : feedEvents.length === 0 ? (
                <div className="p-3"><EmptyState colors={colors} icon={Activity} title={t.explorer.noEvents} /></div>
              ) : (
                feedEvents.slice(0, 50).map((event: ContractEvent) => {
                  const Icon = getEventIcon(event.eventName)
                  const { verb, actor, title, amount } = buildEventDisplay(event)
                  const accent = getEventColor(event.eventName)
                  return (
                    <a
                      key={event.id}
                      href={explorerUrlForEvent(event.transactionHash, event.blockNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-2.5 px-3 py-2.5 transition-colors"
                      style={{ borderBottom: '1px solid var(--line-2)' }}
                    >
                      <div
                        className="w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          backgroundColor: `${accent}18`,
                          color: accent,
                          borderRadius: 14,
                        }}
                      >
                        <Icon className="w-3 h-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1 mb-px flex-wrap" style={{ fontSize: 11 }}>
                          {actor && (
                            <span className="mono" style={{ color: 'var(--ink-2)' }}>
                              {shortenAddress(actor)}
                            </span>
                          )}
                          <span style={{ color: 'var(--ink-4)' }}>{verb}</span>
                          {title && (
                            <span className="font-medium truncate" style={{ color: 'var(--ink)', maxWidth: 160 }}>
                              {title}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
                          <span className="mono tnum">#{event.blockNumber.toString()}</span>
                          <span>·</span>
                          {amount !== undefined && amount > 0n && (
                            <>
                              <span className="mono tnum font-semibold" style={{ color: 'var(--gold-text)' }}>
                                {formatPrice(amount)} PAS
                              </span>
                              <span>·</span>
                            </>
                          )}
                          {event.blockTimestamp && (
                            <span>{timeAgo(new Date(event.blockTimestamp * 1000).toISOString())}</span>
                          )}
                          {(() => {
                            const tx = txMap.get((event.transactionHash ?? '').toLowerCase())
                            if (!tx) return null
                            return (
                              <>
                                <span>·</span>
                                <span className="mono">{shortenAddress(tx.from)}</span>
                                {tx.to && (
                                  <>
                                    <span>→</span>
                                    <span className="mono">{shortenAddress(tx.to)}</span>
                                  </>
                                )}
                                {!tx.status && (
                                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>✗</span>
                                )}
                              </>
                            )
                          })()}
                          <ExternalLink
                            className="w-2.5 h-2.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: 'var(--gold-text)' }}
                          />
                        </div>
                      </div>
                    </a>
                  )
                })
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
    </>
  )
}
