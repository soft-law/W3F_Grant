// Creates Stripe checkout sessions after confirming that PAS fulfillment is available.

import Stripe from 'stripe'
import type { IncomingMessage, ServerResponse } from 'http'
import { setCors, ALLOWED_ORIGINS } from './_lib/cors-helper.js'
import {
  assertPaymentFulfillmentAvailable,
  PaymentFulfillmentUnavailableError,
} from './_lib/payment-availability.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

const PRICES: Record<string, { amount: number; name: string; mode: 'payment' | 'subscription' }> = {
  'blockchain-single':       { amount: 500,  name: '1 IP Registration — Softlaw',               mode: 'payment' },
  'blockchain-pack3':        { amount: 2000, name: '5 IP Registrations — Softlaw',               mode: 'payment' },
  'blockchain-subscription': { amount: 1500, name: 'Pro Subscription — Softlaw',                 mode: 'subscription' },
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (setCors(req, res)) return
  if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return }

  try {
    const body = await readBody(req)
    const {
      serviceId, customerEmail, customerName,
      orderRef, workTitle, workCategory, walletAddress, origin,
    } = body

    const price = PRICES[serviceId]
    if (!price) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'Unknown service' }))
      return
    }

    // Checkout and fulfillment are separate services. Never create a payable
    // Stripe session unless the PAS sender is online and sufficiently funded.
    await assertPaymentFulfillmentAvailable({ serviceId })

    // Reuse Stripe customers by email when available.
    const existing = await stripe.customers.list({ email: customerEmail, limit: 1 })
    const customer = existing.data[0] ?? await stripe.customers.create(
      { email: customerEmail, name: customerName || undefined,
        metadata: { wallet_address: walletAddress || '' } },
      { idempotencyKey: `customer-${customerEmail}` },
    )

    const commonMetadata: Record<string, string> = {
      order_ref:     orderRef,
      service_id:    serviceId,
      work_title:    workTitle    || '',
      work_category: workCategory || '',
      customer_name: customerName || '',
      wallet_address: walletAddress || '',
    }

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = {
      quantity: 1,
      price_data: {
        currency: 'usd',
        product_data: { name: price.name, description: workTitle || undefined },
        unit_amount: price.amount,
        ...(price.mode === 'subscription' ? { recurring: { interval: 'month' } } : {}),
      },
    }

    const session = await stripe.checkout.sessions.create(
      {
        customer: customer.id,
        mode: price.mode,
        currency: 'usd',
        locale: 'auto',
        line_items: [lineItem],
        metadata: commonMetadata,
        ...(price.mode === 'payment' ? {
          payment_intent_data: { metadata: commonMetadata, setup_future_usage: 'on_session' },
        } : {}),
        success_url: `${ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]}/?payment=success&ref=${encodeURIComponent(orderRef)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]}/?payment=cancelled`,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 120,
      },
      { idempotencyKey: `checkout-${orderRef}` },
    )

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ url: session.url, sessionId: session.id }))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.statusCode = err instanceof PaymentFulfillmentUnavailableError ? 503 : 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: message }))
  }
}

function readBody(req: IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => { try { resolve(JSON.parse(data)) } catch { reject(new Error('Invalid JSON')) } })
    req.on('error', reject)
  })
}
