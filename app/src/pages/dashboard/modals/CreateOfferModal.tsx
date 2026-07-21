import { useState, useEffect, useRef } from 'react'
import type { ThemeColors } from '@/hooks/useTheme'
import { Button } from '@/components/Button'
import { useTxToast } from '@/hooks/useTxToast'
import { useCreateOffer } from '@/hooks/useContracts'
import { CONTRACT_ADDRESSES, formatPrice, parsePrice } from '@/lib/contracts'
import type { ListingItem } from '@/hooks/useIndexed'
import { useTranslations } from '@/lib/i18n'
import { Modal } from '../components/Modal'

export function CreateOfferModal({ colors, listing, onClose, onSuccess }: {
  colors: ThemeColors
  listing: ListingItem
  onClose: () => void
  onSuccess: () => void
}) {
  const { t } = useTranslations()
  const txToast = useTxToast()
  const { createOffer, hash: offerHash, isPending, isConfirming, isSuccess, error } = useCreateOffer()
  const [price, setPrice] = useState('')
  const offerDoneRef = useRef(false)

  // Tx submitted — wallet signed
  useEffect(() => {
    if (offerHash) txToast.onHash(offerHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerHash])

  // Tx confirmed
  useEffect(() => {
    if (!isSuccess || offerDoneRef.current) return
    offerDoneRef.current = true
    txToast.onConfirmed(t.modals.offerSubmitted)
    setTimeout(() => onSuccess(), 8000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess])

  useEffect(() => {
    if (error) txToast.onError(error instanceof Error ? error : new Error(String(error)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    offerDoneRef.current = false
    txToast.start(t.modals.makeOffer)
    try {
      const contract = listing.isERC721 ? CONTRACT_ADDRESSES.IPAsset : CONTRACT_ADDRESSES.LicenseToken
      const expiryTime = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60)
      await createOffer(contract, listing.tokenId, expiryTime, parsePrice(price))
    } catch (err) {
      txToast.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  return (
    <Modal colors={colors} title={t.modals.makeOffer} onClose={onClose}>
      <div className="mb-4 p-3 rounded-sm" style={{ backgroundColor: colors.background.tertiary }}>
        <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{listing.title}</p>
        <p className="text-sm" style={{ color: colors.text.muted }}>{t.modals.listedAt} {formatPrice(listing.price)} PAS</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t.modals.yourOffer} className="input" required />
        <p className="text-sm" style={{ color: colors.text.muted }}>{t.modals.offerExpiry}</p>
        {error && <p className="text-sm text-red-500">{error.message}</p>}
        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" isLoading={isPending || isConfirming} disabled={!price}>{t.modals.submitOffer}</Button>
          <Button type="button" variant="outline" onClick={onClose}>{t.common.cancel}</Button>
        </div>
      </form>
    </Modal>
  )
}
