export interface OnChainProofProps {
  blockNumber: bigint
  txHash: string
  chainId?: number
  timestamp?: number
  className?: string
}

const labelStyle: React.CSSProperties = {
  color: 'var(--ink-4)',
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
}

const valueStyle: React.CSSProperties = {
  color: 'var(--gold-text)',
  fontSize: 10,
  fontWeight: 500,
}

export function OnChainProof({
  blockNumber,
  txHash,
  chainId = ACTIVE_CHAIN_ID,
  timestamp,
  className,
}: OnChainProofProps) {
  const shortHash = `${txHash.slice(0, 6)}...${txHash.slice(-4)}`
  const dateStr = timestamp
    ? new Date(timestamp * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null

  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 4,
        padding: '8px 12px',
        backgroundColor: 'color-mix(in srgb, var(--gold) 6%, transparent)',
        borderTop: '1px solid color-mix(in srgb, var(--gold) 20%, transparent)',
      }}
    >
      <div className="mono" style={labelStyle}>WITNESSED BY</div>
      <div className="mono" style={labelStyle}>BLOCK</div>
      <div className="mono" style={valueStyle}>Polkadot Hub</div>
      <div className="mono" style={valueStyle}>{blockNumber.toLocaleString()}</div>

      <div className="mono" style={labelStyle}>TX</div>
      <div className="mono" style={labelStyle}>CHAIN</div>
      <div className="mono" style={valueStyle}>{shortHash}</div>
      <div className="mono" style={valueStyle}>{chainId}</div>

      {dateStr && (
        <>
          <div className="mono" style={labelStyle}>DATE</div>
          <div />
          <div className="mono" style={valueStyle}>{dateStr}</div>
          <div />
        </>
      )}
    </div>
  )
}
import { ACTIVE_CHAIN_ID } from '@/lib/wagmi-config'
