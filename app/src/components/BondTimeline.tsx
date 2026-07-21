import { useQuery } from '@tanstack/react-query'
import { Coins, ArrowDownLeft, ArrowUpRight, ExternalLink } from 'lucide-react'
import { formatEther } from 'viem'
import { fetchIndexer } from '@/lib/indexer'
import { explorerUrlForEvent, shortenAddress } from '@/lib/contracts'
import { useTranslations } from '@/lib/i18n'

type BondEventType = 'deposit' | 'release' | 'withdraw'

interface BondEventRow {
  type: BondEventType
  who: string | null
  amount: string | null
  blockNumber: number
  txHash: string
  timestamp: number | null
}

const TYPE_ICON: Record<BondEventType, typeof Coins> = {
  deposit: ArrowDownLeft,
  release: ArrowUpRight,
  withdraw: ArrowUpRight,
}

const TYPE_ACCENT: Record<BondEventType, string> = {
  deposit: 'var(--gold)',
  release: 'var(--ok)',
  withdraw: 'var(--ink-3)',
}

function formatAmount(amount: string | null): string {
  if (!amount) return '—'
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

export function BondTimeline({ disputeId }: { disputeId: bigint }) {
  const { t } = useTranslations()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dispute-bond-events', disputeId.toString()],
    queryFn: () =>
      fetchIndexer<{ data: BondEventRow[] }>(`/api/disputes/${disputeId.toString()}/bond-events`)
        .then((r) => r.data),
    staleTime: 15_000,
  })

  const rows = data ?? []
  const typeLabel: Record<BondEventType, string> = {
    deposit: t.bondTimeline.deposit,
    release: t.bondTimeline.release,
    withdraw: t.bondTimeline.withdraw,
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        className="flex items-center gap-2"
        style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', background: 'var(--bg-elev-2)' }}
      >
        <Coins className="w-3.5 h-3.5" style={{ color: 'var(--gold-text)' }} />
        <span className="allcaps mono text-[10px]" style={{ color: 'var(--ink-3)' }}>
          {t.bondTimeline.title}
        </span>
      </div>

      {isLoading ? (
        <div style={{ padding: 18, textAlign: 'center' }}>
          <div
            className="animate-spin w-4 h-4 rounded-full border-2 border-current border-t-transparent mx-auto"
            style={{ color: 'var(--gold-text)' }}
          />
        </div>
      ) : isError ? (
        // Fetch failure is not "no movements" — say the record is unavailable
        // so a quiet ledger is never mistaken for a confirmed-empty one.
        <div style={{ padding: '18px 14px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 12 }}>
          {t.bondTimeline.error}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '18px 14px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 12 }}>
          {t.bondTimeline.empty}
        </div>
      ) : (
        rows.map((row, i) => {
          const Icon = TYPE_ICON[row.type]
          const accent = TYPE_ACCENT[row.type]
          return (
            <a
              key={`${row.txHash}-${i}`}
              href={explorerUrlForEvent(row.txHash, row.blockNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 transition-colors"
              style={{
                padding: '10px 14px',
                borderBottom: i === rows.length - 1 ? undefined : '1px solid var(--line-2)',
              }}
            >
              <div
                className="w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5 rounded-full"
                style={{ backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`, color: accent }}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap" style={{ fontSize: 12 }}>
                  <span className="font-semibold" style={{ color: 'var(--ink)' }}>{typeLabel[row.type]}</span>
                  <span className="mono tnum font-semibold" style={{ color: accent }}>
                    {formatAmount(row.amount)}
                  </span>
                  {row.who && (
                    <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 11 }}>
                      {shortenAddress(row.who)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
                  <span className="tnum">#{row.blockNumber}</span>
                  {row.timestamp && (
                    <>
                      <span>·</span>
                      <span>{formatBlockTime(row.timestamp)}</span>
                    </>
                  )}
                  <ExternalLink
                    className="w-2.5 h-2.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--gold-text)' }}
                  />
                </div>
              </div>
            </a>
          )
        })
      )}
    </div>
  )
}
