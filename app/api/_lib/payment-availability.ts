const PAS_REWARDS: Record<string, bigint> = {
  'blockchain-single': 5n,
  'blockchain-pack3': 25n,
  'blockchain-subscription': 20n,
}

const PAS_WEI = 10n ** 18n

export class PaymentFulfillmentUnavailableError extends Error {
  constructor() {
    super('PAS delivery is temporarily unavailable. No payment was created or charged.')
    this.name = 'PaymentFulfillmentUnavailableError'
  }
}

interface AvailabilityOptions {
  serviceId: string
  baseUrl?: string
  fetchImpl?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
  timeoutMs?: number
}

/** Refuse checkout unless the separate on-chain fulfillment service is ready. */
export async function assertPaymentFulfillmentAvailable({
  serviceId,
  baseUrl = process.env.PAYMENTS_BACKEND_URL
    ?? process.env.VITE_INDEXER_URL
    ?? 'https://api.soft.law',
  fetchImpl = fetch,
  timeoutMs = 5_000,
}: AvailabilityOptions): Promise<void> {
  const reward = PAS_REWARDS[serviceId]
  if (reward === undefined) throw new PaymentFulfillmentUnavailableError()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(
      `${baseUrl.replace(/\/$/, '')}/api/payments/health`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      },
    )
    if (!response.ok) throw new PaymentFulfillmentUnavailableError()

    const health = await response.json() as {
      status?: unknown
      funderAddress?: unknown
      balanceWei?: unknown
    }
    if (
      health.status !== 'ok'
      || typeof health.funderAddress !== 'string'
      || !/^0x[0-9a-fA-F]{40}$/.test(health.funderAddress)
      || typeof health.balanceWei !== 'string'
      || !/^\d+$/.test(health.balanceWei)
      || BigInt(health.balanceWei) < reward * PAS_WEI
    ) {
      throw new PaymentFulfillmentUnavailableError()
    }
  } catch (error) {
    if (error instanceof PaymentFulfillmentUnavailableError) throw error
    throw new PaymentFulfillmentUnavailableError()
  } finally {
    clearTimeout(timeout)
  }
}
