import { useState, useEffect } from 'react'
import { Loader2, Check } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useAcceptOffer } from '@/hooks/useContracts'
import { useInvalidateIndexedQueries } from '@/hooks/useIndexed'
import { useTxToast } from '@/hooks/useTxToast'
import { shortenAddress, formatPrice, formatTimestamp } from '@/lib/contracts'
import { useTranslations } from '@/lib/i18n'
import { Loader } from './Loader'
import { useNow } from '@/hooks/useNow'
import { isOfferAcceptable } from '@/lib/marketplace-state'
import { toastError } from '@/hooks/useToast'

// Aggregated offers received for the connected owner's works.
export function ReceivedOffersPanel({ offers, isLoading, refetch, assets }: {
  offers: Array<{ offerId: `0x${string}`; buyer: `0x${string}`; nftContract: `0x${string}`; tokenId: bigint; price: bigint; isActive: boolean; expiryTime: bigint }>
  isLoading: boolean
  refetch: () => void
  assets: Array<{ tokenId: bigint; title: string }>
}) {
  const { t } = useTranslations()
  const nowMs = useNow()
  const { colors } = useTheme()
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const { acceptOffer, hash, isSuccess } = useAcceptOffer()
  const invalidateIndexed = useInvalidateIndexedQueries()
  const txToast = useTxToast()

  // Accept offer effects
  useEffect(() => { if (hash) txToast.onHash(hash) }, [hash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isSuccess) {
      txToast.onConfirmed(t.incomingOffers.offerAccepted)
      invalidateIndexed()
      refetch()
    }
  }, [isSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  const now = BigInt(Math.floor(nowMs / 1000))
  const visibleOffers = offers.filter(o => isOfferAcceptable(o, now))

  const titleFor = (tokenId: bigint) =>
    assets.find(a => a.tokenId === tokenId)?.title || `#${tokenId.toString()}`

  const handleAccept = async (offerId: `0x${string}`) => {
    const offer = offers.find(item => item.offerId === offerId)
    if (!offer || !isOfferAcceptable(offer, now)) {
      toastError(t.incomingOffers.offerExpired)
      invalidateIndexed()
      refetch()
      return
    }
    setAcceptingId(offerId)
    txToast.start(t.tx.acceptingOffer)
    try {
      await acceptOffer(offerId)
    } catch (err) {
      txToast.onError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setAcceptingId(null)
    }
  }

  return (
    <div className="rounded-sm overflow-hidden p-2" style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--line)' }}>
      {isLoading ? (
        <Loader colors={colors} />
      ) : visibleOffers.length === 0 ? (
        <p className="text-xs text-center py-2" style={{ color: 'var(--ink-4)' }}>{t.ipSection.offers.noReceived}</p>
      ) : (
        <div className="space-y-1.5">
          {visibleOffers.map((offer) => (
            <div key={offer.offerId} className="flex items-center gap-2 p-2 rounded-sm" style={{ backgroundColor: 'var(--bg-elev-2)', border: '1px solid var(--line)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--ink)' }}>{titleFor(offer.tokenId)}</p>
                <p className="text-[10px] mono" style={{ color: 'var(--ink-4)' }}>{shortenAddress(offer.buyer)}</p>
                <p className="text-[10px]" style={{ color: 'var(--gold-text)' }}>{formatPrice(offer.price)} PAS</p>
                {offer.expiryTime > 0n && (
                  <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>{t.incomingOffers.expires} {formatTimestamp(offer.expiryTime)}</p>
                )}
              </div>
              <button
                onClick={() => handleAccept(offer.offerId)}
                disabled={acceptingId === offer.offerId}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium"
                style={{ background: 'linear-gradient(135deg, var(--gold), var(--gold-deep))', color: 'var(--bg)' }}
              >
                {acceptingId === offer.offerId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                {t.incomingOffers.accept}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
