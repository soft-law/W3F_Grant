import { useEffect } from 'react'
import { CreditCard } from 'lucide-react'
import type { ThemeColors } from '@/hooks/useTheme'
import { useMakeRecurringPayment, useGetTotalPaymentDue } from '@/hooks/useContracts'
import { useInvalidateIndexedQueries } from '@/hooks/useIndexed'
import { toastError } from '@/hooks/useToast'
import { useTxToast } from '@/hooks/useTxToast'
import { CONTRACT_ADDRESSES, formatPrice } from '@/lib/contracts'
import { useTranslations } from '@/lib/i18n'

export function RecurringPaymentButton({ colors, licenseId, onSuccess }: { colors: ThemeColors; licenseId: bigint; onSuccess: () => void }) {
  const { t } = useTranslations()
  const { data: payment, isLoading, error } = useGetTotalPaymentDue(CONTRACT_ADDRESSES.LicenseToken, licenseId)
  const totalDue = payment?.[2]
  const { makeRecurringPayment, hash, isPending, isSuccess } = useMakeRecurringPayment()
  const invalidateIndexed = useInvalidateIndexedQueries()
  const txToast = useTxToast()

  useEffect(() => { if (hash) txToast.onHash(hash) }, [hash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isSuccess) {
      txToast.onConfirmed(t.recurringPayment.paymentSent)
      invalidateIndexed()
      onSuccess()
    }
  }, [isSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  const handle = async () => {
    if (!totalDue) { toastError(t.recurringPayment.fetchFailed); return }
    txToast.start(t.tx.makingPayment)
    try {
      await makeRecurringPayment(CONTRACT_ADDRESSES.LicenseToken, licenseId, totalDue)
    } catch (err) {
      txToast.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  return (
    <button onClick={handle} disabled={isPending || !totalDue} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] transition-colors hover:opacity-80" style={{ color: colors.text.primary, backgroundColor: colors.background.secondary }}>
      <CreditCard className="w-3.5 h-3.5" style={{ color: colors.accent.goldText }} />
      {isPending
        ? t.recurringPayment.paying
        : isLoading
          ? t.recurringPayment.fetchingAmount
          : error
            ? t.recurringPayment.amountUnavailable
            : totalDue && totalDue > 0n
              ? `Pay ${formatPrice(totalDue)} PAS`
              : t.recurringPayment.notInitialized}
    </button>
  )
}
