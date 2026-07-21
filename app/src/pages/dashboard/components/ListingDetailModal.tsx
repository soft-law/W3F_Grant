import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { X, Tag, User, Calendar, Activity, ShoppingCart, Send, ShieldCheck, ShieldOff, Briefcase, Package, Clock, CreditCard, XCircle, Music, Film, FileText, Code, Drama, ExternalLink } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ThemeColors } from '@/hooks/useTheme'
import { Button } from '@/components/Button'
import { formatPrice, formatTimestamp, shortenAddress } from '@/lib/contracts'
import type { ListingItem } from '@/hooks/useIndexed'
import { useTranslations } from '@/lib/i18n'
import { IncomingOffersPanel } from './IncomingOffersPanel'
import { PrivateContentDownload } from './PrivateContentDownload'
import { useNow } from '@/hooks/useNow'
import { DynamicIcon } from '@/components/DynamicIcon'

// Pick the right player + fallback icon from category. Audio gets <audio>,
// video gets <video>, downloadable docs get a link with a category icon.
function mediaKindFor(category?: string): 'image' | 'audio' | 'video' | 'document' {
  const c = (category || '').toLowerCase()
  if (c.includes('music')) return 'audio'
  if (c.includes('audio') || c.includes('video') || c.includes('film')) return 'video'
  if (c.includes('literary') || c.includes('dramatic') || c.includes('software') || c.includes('code') || c.includes('script')) return 'document'
  return 'image'
}

function documentIconFor(category?: string): LucideIcon {
  const c = (category || '').toLowerCase()
  if (c.includes('music')) return Music
  if (c.includes('audio') || c.includes('video') || c.includes('film')) return Film
  if (c.includes('software') || c.includes('code')) return Code
  if (c.includes('dramatic') || c.includes('script') || c.includes('drama')) return Drama
  if (c.includes('literary') || c.includes('book') || c.includes('text')) return FileText
  return Tag
}

function MetaRow({ icon, label, value, valueColor }: { icon: LucideIcon; label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-start gap-3 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
      <div className="flex items-center gap-2 w-28 flex-shrink-0">
        <DynamicIcon icon={icon} className="w-3.5 h-3.5" style={{ color: 'var(--ink-4)' }} />
        <span className="text-xs" style={{ color: 'var(--ink-4)' }}>{label}</span>
      </div>
      <span className="text-xs font-medium flex-1" style={{ color: valueColor ?? 'var(--ink)' }}>{value}</span>
    </div>
  )
}

export function ListingDetailModal({ listing, colors, isOwn, isBuying, isCancelling, onClose, onBuy, onCancel, onOffer, privateCid }: { listing: ListingItem; colors: ThemeColors; isOwn: boolean; isBuying: boolean; isCancelling: boolean; onClose: () => void; onBuy: () => void; onCancel: () => void; onOffer: () => void; privateCid?: string }) {
  const { t } = useTranslations()
  const nowMs = useNow()
  const isIP = listing.isERC721

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])
  const typeColor = isIP ? '#8b5cf6' : '#3b82f6'
  const mediaKind = mediaKindFor(listing.category)
  const docIcon = documentIconFor(listing.category)

  // For ERC-1155 license listings, the tokenId IS the licenseId.
  // Fall back to localStorage (set by PrivateContentUpload after mint) if no
  // explicit CID prop was passed by the caller.
  const { resolvedCid, resolvedFileName } = useMemo(() => {
    if (privateCid) return { resolvedCid: privateCid, resolvedFileName: undefined as string | undefined }
    if (isIP) return { resolvedCid: undefined, resolvedFileName: undefined }
    try {
      const raw = window.localStorage.getItem(`softlaw-private-cid-${listing.tokenId.toString()}`)
      if (!raw) return { resolvedCid: undefined, resolvedFileName: undefined }
      const parsed = JSON.parse(raw) as { cid?: string; fileName?: string }
      return { resolvedCid: parsed.cid, resolvedFileName: parsed.fileName }
    } catch {
      return { resolvedCid: undefined, resolvedFileName: undefined }
    }
  }, [privateCid, isIP, listing.tokenId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <motion.div
        className="w-full max-w-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: colors.background.primary, border: `1px solid ${colors.border.primary}`, maxHeight: '90vh', boxShadow: '0 0 0 1px rgba(229,169,19,0.15), 0 8px 32px rgba(0,0,0,0.4)', clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >

        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${colors.border.primary}` }}>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: typeColor, color: 'white' }}>{isIP ? t.modals.ipAsset : t.modals.license}</span>
            <span className="text-xs" style={{ color: colors.text.muted }}>{(t.registry.categories as Record<string, string>)[listing.category] ?? listing.category}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-sm hover:opacity-70 transition-opacity" style={{ backgroundColor: colors.background.tertiary }}>
            <X className="w-4 h-4" style={{ color: colors.text.muted }} />
          </button>
        </div>

        {/* Body: two columns */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: media (image / audio / video / document) */}
          <div className="w-56 flex-shrink-0 p-4">
            <div className="w-full aspect-square rounded-sm overflow-hidden flex items-center justify-center" style={{ backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.primary}` }}>
              {mediaKind === 'video' && listing.animationUrl ? (
                <video src={listing.animationUrl} controls preload="metadata" poster={listing.imageUrl || undefined} className="w-full h-full object-cover">
                  <track kind="captions" />
                </video>
              ) : mediaKind === 'audio' && listing.animationUrl ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-3">
                  <Music className="w-12 h-12" style={{ color: colors.accent.goldText }} />
                  <audio src={listing.animationUrl} controls className="w-full" />
                </div>
              ) : mediaKind === 'document' && listing.animationUrl ? (
                <a href={listing.animationUrl} target="_blank" rel="noopener noreferrer" className="w-full h-full flex flex-col items-center justify-center gap-2 hover:opacity-80 transition-opacity">
                  <DynamicIcon icon={docIcon} className="w-14 h-14" style={{ color: colors.text.muted }} />
                  <span className="text-[10px] font-medium flex items-center gap-1" style={{ color: colors.accent.goldText }}>
                    {t.licenseContract.viewOnIPFS} <ExternalLink className="w-2.5 h-2.5" />
                  </span>
                </a>
              ) : listing.imageUrl ? (
                <img src={listing.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <DynamicIcon icon={docIcon} className="w-12 h-12" style={{ color: colors.text.muted }} />
              )}
            </div>

            {/* Price block below image */}
            <div className="mt-3 rounded-sm p-3 text-center" style={{ background: `linear-gradient(135deg, ${colors.accent.gold}15, ${colors.background.secondary})`, border: `1px solid ${colors.accent.gold}30` }}>
              <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: colors.text.muted }}>{t.marketplace.listing.price}</p>
              <p className="text-xl font-bold" style={{ color: colors.accent.goldText }}>{formatPrice(listing.price)}</p>
              <p className="text-[10px]" style={{ color: colors.text.muted }}>PAS</p>
            </div>
          </div>

          {/* Right: metadata */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Title */}
              <h2 className="text-lg font-bold mb-1 leading-tight" style={{ color: colors.text.primary }}>{listing.title}</h2>
              {isOwn && <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold mb-3" style={{ backgroundColor: `${colors.accent.gold}20`, color: colors.accent.goldText }}>{t.listingDetail.yourListing}</span>}

              {/* Description */}
              {listing.description && (
                <div className="mt-3 p-3 rounded-sm" style={{ backgroundColor: colors.background.secondary, border: `1px solid ${colors.border.primary}` }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1.5 font-semibold" style={{ color: colors.text.muted }}>{t.listingDetail.description}</p>
                  <p className="text-xs leading-relaxed" style={{ color: colors.text.secondary }}>{listing.description}</p>
                </div>
              )}

              {/* Incoming offers — only shown to the listing owner */}
              {isOwn && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: colors.text.muted }}>{t.listingDetail.incomingOffers}</p>
                  <IncomingOffersPanel nftContract={listing.nftContract} tokenId={listing.tokenId} canAccept />
                </div>
              )}

              {/* Core details */}
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: colors.text.muted }}>{t.listingDetail.tokenInfo}</p>
                <MetaRow icon={Tag} label={t.listingDetail.tokenId} value={`#${listing.tokenId.toString()}`} />
                <MetaRow icon={User} label={t.listingDetail.seller} value={shortenAddress(listing.seller)} />
                {listing.createdAt > 0 && (
                  <MetaRow icon={Calendar} label={t.listingDetail.listed} value={new Date(listing.createdAt * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} />
                )}
                <MetaRow icon={Activity} label={t.listingDetail.status} value={listing.isActive ? t.common.active : t.common.inactive} valueColor={listing.isActive ? '#22c55e' : colors.text.muted} />
              </div>

              {/* License-specific section */}
              {!isIP && (
                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: colors.text.muted }}>{t.listingDetail.licenseDetails}</p>
                  {listing.isExclusive !== undefined && (
                    <MetaRow
                      icon={listing.isExclusive ? ShieldCheck : ShieldOff}
                      label={t.listingDetail.exclusivity}
                      value={listing.isExclusive ? t.listingDetail.exclusive : t.listingDetail.nonExclusive}
                      valueColor={listing.isExclusive ? '#8b5cf6' : colors.text.primary}
                    />
                  )}
                  {listing.ipAssetId !== undefined && (
                    <MetaRow icon={Briefcase} label={t.listingDetail.parentIP} value={listing.ipAssetTitle ? `${listing.ipAssetTitle} (#${listing.ipAssetId.toString()})` : `#${listing.ipAssetId.toString()}`} valueColor={colors.accent.gold} />
                  )}
                  {listing.supply !== undefined && (
                    <MetaRow icon={Package} label={t.listingDetail.supply} value={listing.supply.toString()} />
                  )}
                  {listing.expiryTime !== undefined && (
                    <MetaRow
                      icon={Clock}
                      label={t.listingDetail.expiry}
                      value={listing.expiryTime === 0n ? t.common.perpetual : (() => {
                        const now = BigInt(Math.floor(nowMs / 1000))
                        const diff = listing.expiryTime - now
                        if (diff <= 0n) return `${t.common.expired} (${formatTimestamp(listing.expiryTime)})`
                        const days = Number(diff) / 86400
                        return days >= 1
                          ? `${Math.floor(days)}${t.common.daysLeft} (${formatTimestamp(listing.expiryTime)})`
                          : `${Math.floor(Number(diff) / 3600)}${t.common.hoursLeft}`
                      })()}
                      valueColor={listing.expiryTime !== 0n && listing.expiryTime < BigInt(Math.floor(nowMs / 1000)) ? '#ef4444' : undefined}
                    />
                  )}
                  {listing.paymentInterval !== undefined && listing.paymentInterval > 0n && (
                    <MetaRow
                      icon={CreditCard}
                      label={t.listingDetail.payment}
                      value={Number(listing.paymentInterval) >= 86400
                        ? t.common.everyDays.replace('{n}', String(Math.floor(Number(listing.paymentInterval) / 86400)))
                        : t.common.everyHours.replace('{n}', String(Math.floor(Number(listing.paymentInterval) / 3600)))}
                    />
                  )}
                  {listing.isRevoked !== undefined && (
                    <MetaRow icon={XCircle} label={t.listingDetail.revoked} value={listing.isRevoked ? t.listingDetail.yes : t.listingDetail.no} valueColor={listing.isRevoked ? '#ef4444' : '#22c55e'} />
                  )}
                  {listing.isExpired !== undefined && (
                    <MetaRow icon={Clock} label={t.listingDetail.expired} value={listing.isExpired ? t.listingDetail.yes : t.listingDetail.no} valueColor={listing.isExpired ? '#ef4444' : '#22c55e'} />
                  )}
                  {listing.terms && (
                    <div className="mt-2 p-3 rounded-sm" style={{ backgroundColor: colors.background.secondary, border: `1px solid ${colors.border.primary}` }}>
                      <p className="text-[10px] uppercase tracking-wider mb-1.5 font-semibold" style={{ color: colors.text.muted }}>{t.listingDetail.terms}</p>
                      <p className="text-xs leading-relaxed" style={{ color: colors.text.secondary }}>{listing.terms}</p>
                    </div>
                  )}

                  {/* Private content — only when a CID is known and the viewer is not the seller */}
                  {resolvedCid && !isOwn && (
                    <div className="mt-3">
                      <p className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: colors.text.muted }}>{t.privateContent.downloadTitle}</p>
                      <PrivateContentDownload
                        licenseId={Number(listing.tokenId)}
                        cid={resolvedCid}
                        fileName={resolvedFileName}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action footer */}
            <div className="px-5 py-4 flex gap-2" style={{ borderTop: `1px solid ${colors.border.primary}` }}>
              {isOwn ? (
                <Button variant="outline" className="flex-1" onClick={onCancel} isLoading={isCancelling}>
                  <X className="w-4 h-4 mr-2" /> {t.listingDetail.cancelListing}
                </Button>
              ) : (
                <>
                  <Button className="flex-1" onClick={onBuy} isLoading={isBuying}>
                    <ShoppingCart className="w-4 h-4 mr-2" /> {t.listingDetail.buyNow}
                  </Button>
                  <Button variant="outline" onClick={onOffer}>
                    <Send className="w-4 h-4 mr-2" /> {t.listingDetail.makeOffer}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
