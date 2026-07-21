const TYPE_ABBREV: Record<string, string> = {
  literary: 'LIT',
  artistic: 'ART',
  musical: 'MUS',
  audiovisual: 'AV',
  software: 'SW',
  dramatic: 'DRAM',
}

export interface FolioStripProps {
  tokenId: bigint
  workType: string
  jurisdiction?: string
  className?: string
}

export function FolioStrip({ tokenId, workType, jurisdiction = 'INT', className }: FolioStripProps) {
  const year = new Date().getFullYear()
  const folio = `SL-${year}-${tokenId.toString().padStart(4, '0')}`
  const kind = TYPE_ABBREV[workType.toLowerCase()] || 'IP'
  const hex = `0x${tokenId.toString(16).padStart(4, '0').toUpperCase()}`

  return (
    <div
      className={`mono ${className || ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderBottom: '1px solid var(--line)',
        backgroundColor: 'var(--bg-elev)',
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        width: '100%',
      }}
    >
      <span style={{ color: 'var(--gold-text)', fontWeight: 600, fontSize: 11 }}>{folio}</span>
      <span style={{ color: 'var(--line)' }}>│</span>
      <span style={{ color: 'var(--ink-3)' }}>{kind}</span>
      <span style={{ color: 'var(--line)' }}>│</span>
      <span style={{ color: 'var(--ink-3)' }}>{jurisdiction}</span>
      <span style={{ color: 'var(--line)' }}>│</span>
      <span style={{ color: 'var(--ink-3)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>···</span>
      <span style={{ color: 'var(--line)' }}>│</span>
      <span style={{ color: 'var(--ink-4)', marginLeft: 'auto' }}>{hex}</span>
    </div>
  )
}
