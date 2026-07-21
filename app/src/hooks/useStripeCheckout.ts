import { useState } from 'react'

export type StripeServiceId =
  | 'blockchain-single'
  | 'blockchain-pack3'
  | 'blockchain-subscription'

interface CheckoutParams {
  serviceId: StripeServiceId
  customerEmail: string
  customerName?: string
  orderRef: string
  workTitle?: string
  workCategory?: string
  walletAddress?: string
}

export function useStripeCheckout() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const checkout = async (params: CheckoutParams) => {
    if (isLoading) return
    if (!emailRegex.test(params.customerEmail)) {
      setError('Please enter a valid email address')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId:     params.serviceId,
          customerEmail: params.customerEmail,
          customerName:  params.customerName ?? '',
          orderRef:      params.orderRef,
          workTitle:     params.workTitle ?? '',
          workCategory:  params.workCategory ?? '',
          walletAddress: params.walletAddress ?? '',
          origin:        window.location.origin,
        }),
      })
      const data = await parseJSON(res)
      if (!res.ok) throw new Error(data?.error ?? `Server error (${res.status})`)
      if (!data?.url) throw new Error('No payment URL received. Please try again.')
      window.location.href = data.url
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return { checkout, isLoading, error }
}

// Safe JSON parser — returns null if response is empty or non-JSON (e.g. HTML 404)
async function parseJSON(res: Response): Promise<Record<string, string> | null> {
  const text = await res.text()
  if (!text.trim()) return null
  try { return JSON.parse(text) } catch { return null }
}
