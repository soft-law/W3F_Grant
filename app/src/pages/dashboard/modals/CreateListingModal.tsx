import { useState, useEffect, useRef, useMemo } from 'react'
import { Image as ImageIcon, Music, Film, FileText, Code, Drama, Briefcase, Key, Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ThemeColors } from '@/hooks/useTheme'
import { Button } from '@/components/Button'
import { useTxToast } from '@/hooks/useTxToast'
import { useCreateListing, useApproveIPAsset, useApproveLicenseToken, useIsApprovedForAll, usePlatformFee, useAssetRoyalty } from '@/hooks/useContracts'
import { useIndexedAssets, useIndexedHeldLicenses, useInvalidateIndexedQueries } from '@/hooks/useIndexed'
import { CONTRACT_ADDRESSES, parsePrice } from '@/lib/contracts'
import { useTranslations } from '@/lib/i18n'
import { Modal } from '../components/Modal'
import { ContextualEntitySummary } from '../components/ContextualEntitySummary'
import { hasContextualListingSubject } from '@/lib/modal-entry-context'

// Category → fallback icon for asset rows. License rows always use the Key icon.
function workTypeIcon(category?: string): LucideIcon {
  const c = (category || '').toLowerCase()
  if (c.includes('music')) return Music
  if (c.includes('audio') || c.includes('video') || c.includes('film')) return Film
  if (c.includes('software') || c.includes('code')) return Code
  if (c.includes('dramatic') || c.includes('script') || c.includes('drama')) return Drama
  if (c.includes('literary') || c.includes('book') || c.includes('text')) return FileText
  if (c.includes('artistic') || c.includes('art')) return ImageIcon
  return Briefcase
}

// Both IP assets and licenses are listable. Modeling them as a discriminated
// union lets the picker render one combined list and the form derive
// `isERC721` straight from the selection.
type ListableItem =
  | {
      kind: 'ip'
      key: string
      tokenId: bigint
      title: string
      category: string
      imageUrl?: string
    }
  | {
      kind: 'license'
      key: string
      tokenId: bigint
      title: string
      ipAssetId: bigint
      terms: string
      isExclusive: boolean
    }

export function CreateListingModal({ colors, address, initialAssetId, initialItem, onClose, onSuccess }: {
  colors: ThemeColors
  address: `0x${string}`
  initialAssetId?: string
  initialItem?: { kind: 'ip' | 'license'; tokenId: string }
  onClose: () => void
  onSuccess: () => void
}) {
  const { t } = useTranslations()
  const txToast = useTxToast()
  const invalidateIndexed = useInvalidateIndexedQueries()
  const { createListing, hash: listingHash, isPending, isConfirming, isSuccess, error } = useCreateListing()
  const { setApprovalForAll: approveIP, isPending: approvingIP } = useApproveIPAsset()
  const { setApprovalForAll: approveLicense, isPending: approvingLicense } = useApproveLicenseToken()
  const { data: ipApproved } = useIsApprovedForAll('IPAsset', address, CONTRACT_ADDRESSES.Marketplace)
  const { data: licenseApproved } = useIsApprovedForAll('LicenseToken', address, CONTRACT_ADDRESSES.Marketplace)

  const { assets, isLoading: assetsLoading } = useIndexedAssets(address)
  // Only current ERC-1155 holders can list a license. The issuer-side
  // `useIndexedLicenses` projection includes licenses the wallet may not own.
  const { licenses, isLoading: licensesLoading } = useIndexedHeldLicenses(address)

  const items = useMemo<ListableItem[]>(() => {
    const ipItems: ListableItem[] = assets.map((a) => ({
      kind: 'ip',
      key: `ip-${a.tokenId}`,
      tokenId: a.tokenId,
      title: a.title || 'Untitled',
      category: a.category || '',
      imageUrl: a.imageUrl,
    }))
    const licenseItems: ListableItem[] = licenses
      .filter((l) => l.isActive)
      .map((l) => ({
        kind: 'license',
        key: `lic-${l.licenseId}`,
        tokenId: l.licenseId,
        title: l.title || `License #${l.licenseId}`,
        ipAssetId: l.ipAssetId,
        terms: l.terms || '',
        isExclusive: l.isExclusive,
      }))
    return [...ipItems, ...licenseItems]
  }, [assets, licenses])

  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const hasFixedSubject = hasContextualListingSubject({ initialAssetId, initialItem })
  const requested = initialItem ?? (initialAssetId ? { kind: 'ip' as const, tokenId: initialAssetId } : undefined)
  const requestedKey = requested
    ? items.find((it) => it.kind === requested.kind && it.tokenId.toString() === requested.tokenId)?.key ?? null
    : null
  const effectiveSelectedKey = selectedKey ?? requestedKey
  const selected = items.find((it) => it.key === effectiveSelectedKey) ?? null
  const isIP = selected?.kind === 'ip'

  const [price, setPrice] = useState('')

  // Live economics provide an accurate fee and net tally. platformFee is
  // admin-settable and emits no event → must read live RPC, never hardcode.
  // Royalty is read live per IP asset (the same value distributePayment uses).
  const { data: platformFeeBps } = usePlatformFee()
  const { data: assetRoyaltyBps } = useAssetRoyalty(isIP && selected ? selected.tokenId : undefined)

  const listingDoneRef = useRef(false)

  // When listing tx submitted — advance toast to "confirming"
  useEffect(() => {
    if (listingHash) txToast.onHash(listingHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingHash])

  // When listing confirmed — advance to "indexing", invalidate immediately,
  // close the modal so the new listing shows up in the marketplace without
  // waiting for the success toast to fade. Toast lingers as visual feedback.
  useEffect(() => {
    if (!isSuccess || listingDoneRef.current) return
    listingDoneRef.current = true
    txToast.onConfirmed(t.modals.createListing)
    invalidateIndexed()
    onSuccess()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess])

  useEffect(() => {
    if (error) txToast.onError(error instanceof Error ? error : new Error(String(error)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return

    const needsApproval = isIP ? !ipApproved : !licenseApproved
    listingDoneRef.current = false

    if (needsApproval) {
      txToast.start(isIP ? t.modals.ipAsset : t.modals.license, [
        { label: t.tx.approvingAsset, status: 'active' },
      ])
    } else {
      txToast.start(isIP ? t.modals.ipAsset : t.modals.license)
    }

    try {
      if (needsApproval) {
        if (isIP) await approveIP(CONTRACT_ADDRESSES.Marketplace, true)
        else await approveLicense(CONTRACT_ADDRESSES.Marketplace, true)
        txToast.advanceToSigning()
      }
      const contract = isIP ? CONTRACT_ADDRESSES.IPAsset : CONTRACT_ADDRESSES.LicenseToken
      await createListing(contract, selected.tokenId, parsePrice(price), isIP, { chainedAfterApproval: needsApproval })
    } catch (err) {
      txToast.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  const isLoading = isPending || isConfirming || approvingIP || approvingLicense
  const pickLoading = assetsLoading || licensesLoading

  return (
    <Modal colors={colors} title={t.modals.createListing} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Contextual card/detail actions keep their subject fixed. Only the
            global listing entry point asks the user to select an entity. */}
        {hasFixedSubject ? (
          <ContextualEntitySummary
            label={t.modals.listingSelectionLabel}
            title={selected?.title}
            subtitle={selected
              ? selected.kind === 'ip'
                ? `${t.modals.ipAsset} #${selected.tokenId}`
                : `${t.modals.license} #${selected.tokenId} · IP #${selected.ipAssetId}`
              : undefined}
            imageUrl={selected?.kind === 'ip' ? selected.imageUrl : undefined}
            fallbackIcon={selected?.kind === 'ip' ? workTypeIcon(selected.category) : Key}
            isLoading={pickLoading && !selected}
            unavailableText={t.modals.contextItemUnavailable}
          />
        ) : (
        <div data-testid="listing-entity-picker">
          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>
            {t.modals.pickerSelectListable}
          </p>

          {pickLoading ? (
            <div className="space-y-1">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="animate-pulse rounded-sm h-12" style={{ backgroundColor: 'var(--bg-elev-2)' }} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--ink-4)' }}>
              {t.modals.pickerNoListable}
            </p>
          ) : (
            <div className="rounded-sm overflow-hidden max-h-64 overflow-y-auto" style={{ border: '1px solid var(--line)' }}>
              {items.map((item, idx) => {
                const isSelected = effectiveSelectedKey === item.key
                const FallbackIcon = item.kind === 'ip' ? workTypeIcon(item.category) : Key
                const typeLabel = item.kind === 'ip'
                  ? `IP Asset · ${(t.registry.categories as Record<string, string>)[item.category] ?? item.category ?? '—'}`
                  : `${t.modals.license} · IP #${item.ipAssetId} · ${item.isExclusive ? t.listingDetail.exclusive : t.listingDetail.nonExclusive}${item.terms ? ` · ${item.terms}` : ''}`
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedKey(item.key)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-colors"
                    style={{
                      backgroundColor: isSelected ? 'color-mix(in srgb, var(--gold) 8%, transparent)' : 'transparent',
                      borderTop: idx === 0 ? 'none' : '1px solid var(--line)',
                    }}
                  >
                    <div className="w-10 h-10 rounded flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ backgroundColor: 'var(--bg-elev-2)' }}>
                      {item.kind === 'ip' && item.imageUrl
                        ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        : <FallbackIcon className="w-4 h-4" style={{ color: item.kind === 'license' ? 'var(--gold-text)' : 'var(--ink-4)' }} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium truncate leading-tight" style={{ color: isSelected ? 'var(--gold-text)' : 'var(--ink)' }}>
                        {item.title}
                        <span className="ml-1.5 font-normal" style={{ color: 'var(--ink-4)' }}>#{String(item.tokenId)}</span>
                      </p>
                      <p className="text-[10px] truncate" style={{ color: 'var(--ink-4)' }}>{typeLabel}</p>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--gold-text)' }} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        )}

        {/* Price */}
        <input
          type="text"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={`${t.marketplace.listing.price} (PAS)`}
          className="input"
          required
        />

        {/* Live fee and resale-royalty estimate. */}
        {price && !isNaN(parseFloat(price)) && parseFloat(price) > 0 && platformFeeBps !== undefined && (() => {
          const p = parseFloat(price)
          const feeBps = Number(platformFeeBps)
          const fee = (p * feeBps) / 10000
          const net = p - fee
          const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 })
          return (
            <div className="mono" style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3, padding: '8px 10px', border: '1px solid var(--line)', background: 'var(--bg-elev-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-3)' }}>
                <span>{t.marketplace.listing.feeNote} ({feeBps / 100}%)</span>
                <span>−{fmt(fee)} PAS</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink)', fontWeight: 700 }}>
                <span>{t.marketplace.listing.youReceive}</span>
                <span>~{fmt(net)} PAS</span>
              </div>
              {isIP && assetRoyaltyBps !== undefined && Number(assetRoyaltyBps) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-4)' }}>
                  <span>{t.marketplace.listing.royaltyOnResale}</span>
                  <span>{Number(assetRoyaltyBps) / 100}%</span>
                </div>
              )}
            </div>
          )
        })()}

        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error.message}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            className="btn btn-ghost"
            style={{ minWidth: '25%', color: 'var(--ink-3)' }}
            onClick={onClose}
          >
            {t.common.cancel}
          </button>
          <Button type="submit" className="flex-1" isLoading={isLoading} disabled={!selected || !price || isLoading}>
            {t.modals.list}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
