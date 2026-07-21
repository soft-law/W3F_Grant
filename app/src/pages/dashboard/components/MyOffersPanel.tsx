import { useState, useEffect } from 'react'
import { Send, ChevronDown, ChevronRight, Loader2, X } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useCancelOffer } from '@/hooks/useContracts'
import { useInvalidateIndexedQueries } from '@/hooks/useIndexed'
import { useTxToast } from '@/hooks/useTxToast'
import { CONTRACT_ADDRESSES, formatPrice, formatTimestamp } from '@/lib/contracts'
import { useTranslations } from '@/lib/i18n'
import { Loader } from './Loader'
import { useNow } from '@/hooks/useNow'
import { isOfferAwaitingRefund } from '@/lib/marketplace-state'

export function MyOffersPanel({ offers, isLoading, refetch, defaultOpen }: { offers: Array<{ offerId: `0x${string}`; buyer: `0x${string}`; nftContract: `0x${string}`; tokenId: bigint; price: bigint; isActive: boolean; expiryTime: bigint }>; isLoading: boolean; refetch: () => void; defaultOpen?: boolean }) {
  const { t } = useTranslations()
  const nowMs = useNow()
  const { colors } = useTheme()
  const [show, setShow] = useState(defaultOpen ?? false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const { cancelOffer, hash, isSuccess } = useCancelOffer()
  const invalidateIndexed = useInvalidateIndexedQueries()
  const txToast = useTxToast()

  // Cancel offer effects
  useEffect(() => { if (hash) txToast.onHash(hash) }, [hash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isSuccess) {
      txToast.onConfirmed(t.myOffers.offerCancelled)
      invalidateIndexed()
      refetch()
    }
  }, [isSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeOffers = offers.filter(o => o.isActive)

  const handleCancel = async (offerId: `0x${string}`) => {
    setCancellingId(offerId)
    txToast.start(t.tx.cancellingOffer)
    try {
      await cancelOffer(offerId)
    } catch (err) {
      txToast.onError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="rounded-sm overflow-hidden" style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--line)' }}>
      <button onClick={() => setShow(!show)} className="w-full p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4" style={{ color: 'var(--ink-4)' }} />
          <span className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{t.myOffers.title}</span>
          <span className="text-[11px] px-1.5 py-1 rounded" style={{ backgroundColor: 'var(--bg-elev-2)', color: activeOffers.length > 0 ? 'var(--gold-text)' : 'var(--ink-4)' }}>{activeOffers.length}</span>
        </div>
        {show ? <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--ink-4)' }} /> : <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--ink-4)' }} />}
      </button>

      {show && (
        <div className="px-2 pb-2">
          {isLoading ? (
            <Loader colors={colors} />
          ) : activeOffers.length === 0 ? (
            <p className="text-xs text-center py-2" style={{ color: 'var(--ink-4)' }}>{t.myOffers.noActive}</p>
          ) : (
            <div className="space-y-1">
              {activeOffers.map((offer) => {
                const now = BigInt(Math.floor(nowMs / 1000))
                const isExpired = isOfferAwaitingRefund(offer, now)
                const isCancelling = cancellingId === offer.offerId
                return (
                  <div key={offer.offerId} className="flex items-center gap-2 p-2 rounded" style={{ backgroundColor: 'var(--bg-elev-2)', opacity: isExpired ? 0.6 : 1 }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium" style={{ color: 'var(--ink)' }}>
                        {offer.nftContract.toLowerCase() === CONTRACT_ADDRESSES.IPAsset.toLowerCase() ? 'IP Asset' : 'License'} #{offer.tokenId.toString()}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>
                        {formatPrice(offer.price)} PAS{isExpired ? ' • Expired' : offer.expiryTime > 0n ? ` • Expires ${formatTimestamp(offer.expiryTime)}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCancel(offer.offerId)}
                      disabled={isCancelling}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--danger) 8%, transparent)', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}
                    >
                      {isCancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                      {isExpired ? t.myOffers.reclaimFunds : t.common.cancel}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
