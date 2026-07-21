import { ArrowUpRight, Banknote } from 'lucide-react'
import { formatEther } from 'viem'
import { useIndexedWithdrawals } from '@/hooks/useIndexed'
import { explorerUrlForEvent } from '@/lib/contracts'
import { useTranslations } from '@/lib/i18n'

function formatAmount(amount: string): string {
  try {
    return `${Number(formatEther(BigInt(amount))).toFixed(4)} PAS`
  } catch {
    return amount
  }
}

function formatBlockTime(ts: number | null): string {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleString()
}

/** Account-scoped withdrawal history; renders nothing when empty. */
export function WithdrawalHistory({
  recipient,
  source,
}: {
  recipient?: string
  source: 'revenue' | 'bond'
}) {
  const { t } = useTranslations()
  const wh = t.withdrawalHistory
  const { withdrawals, isLoading, isError } = useIndexedWithdrawals(recipient, source)

  if (!recipient || isLoading) return null
  if (isError) {
    return (
      <p className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
        {wh.error}
      </p>
    )
  }
  if (withdrawals.length === 0) return null

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        className="flex items-center gap-2"
        style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', background: 'var(--bg-elev-2)' }}
      >
        <Banknote className="w-3.5 h-3.5" style={{ color: 'var(--gold-text)' }} />
        <span className="allcaps mono text-[10px]" style={{ color: 'var(--ink-3)' }}>
          {source === 'bond' ? wh.bondTitle : wh.revenueTitle}
        </span>
        <span className="mono text-[10px]" style={{ color: 'var(--ink-4)', marginLeft: 'auto' }}>
          {wh.accountScopedNote}
        </span>
      </div>

      {withdrawals.map((row, i) => (
        <a
          key={`${row.txHash}-${row.blockNumber}-${i}`}
          href={row.txHash ? explorerUrlForEvent(row.txHash, row.blockNumber) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 transition-colors"
          style={{
            padding: '8px 14px',
            borderBottom: i === withdrawals.length - 1 ? undefined : '1px solid var(--line-2)',
            cursor: row.txHash ? 'pointer' : 'default',
          }}
        >
          <div
            className="w-6 h-6 flex items-center justify-center flex-shrink-0 rounded-full"
            style={{ backgroundColor: 'color-mix(in srgb, var(--ok) 14%, transparent)', color: 'var(--ok)' }}
          >
            <ArrowUpRight className="w-3 h-3" />
          </div>
          <span className="mono tnum font-semibold" style={{ fontSize: 12, color: 'var(--ink)' }}>
            {formatAmount(row.amount)}
          </span>
          <span className="mono tnum" style={{ fontSize: 10, color: 'var(--ink-4)', marginLeft: 'auto' }}>
            #{row.blockNumber}
            {row.blockTimestamp ? ` · ${formatBlockTime(row.blockTimestamp)}` : ''}
          </span>
        </a>
      ))}
    </div>
  )
}
