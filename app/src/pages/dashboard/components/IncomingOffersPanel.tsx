import { useState, useEffect } from 'react'
import { Loader2, Check } from 'lucide-react'
import { useAcceptOffer } from '@/hooks/useContracts'
import { useInvalidateIndexedQueries, useIndexedOffersForToken } from '@/hooks/useIndexed'
import { useTxToast } from '@/hooks/useTxToast'
import { shortenAddress, formatPrice, formatTimestamp } from '@/lib/contracts'
import { useTranslations } from '@/lib/i18n'
import { useNow } from '@/hooks/useNow'
import { isOfferAcceptable } from '@/lib/marketplace-state'
import { toastError } from '@/hooks/useToast'

export function IncomingOffersPanel({ nftContract, tokenId, canAccept = false }: {
  nftContract: `0x${string}`
  tokenId: bigint
  canAccept?: boolean
}) {
  const { t } = useTranslations()
  const nowMs = useNow()
  const { offers, isLoading, refetch } = useIndexedOffersForToken(nftContract, tokenId)
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

  if (isLoading) return (
    <div className="flex items-center gap-2 py-2" style={{ color: 'var(--ink-4)' }}>
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      <span className="text-[11px]">{t.incomingOffers.scanning}</span>
    </div>
  )

  if (visibleOffers.length === 0) return (
    <p className="text-[11px] py-1" style={{ color: 'var(--ink-4)' }}>{t.incomingOffers.noOffers}</p>
  )

  return (
    <div className="space-y-1.5">
      {visibleOffers.map((offer) => (
        <div key={offer.offerId} className="flex items-center gap-2 p-2 rounded-sm" style={{ backgroundColor: 'var(--bg-elev-2)', border: '1px solid var(--line)' }}>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium" style={{ color: 'var(--ink)' }}>{shortenAddress(offer.buyer)}</p>
            <p className="text-[10px]" style={{ color: 'var(--gold-text)' }}>{formatPrice(offer.price)} PAS</p>
            {offer.expiryTime > 0n && (
              <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>{t.incomingOffers.expires} {formatTimestamp(offer.expiryTime)}</p>
            )}
          </div>
          {canAccept && (
            <button
              onClick={() => handleAccept(offer.offerId)}
              disabled={acceptingId === offer.offerId}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium"
              style={{ background: 'linear-gradient(135deg, var(--gold), var(--gold-deep))', color: '#111' }}
            >
              {acceptingId === offer.offerId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              {t.incomingOffers.accept}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
