const CITATIONS: Record<string, string[]> = {
  literary:    ['Berne Art. 2', 'WIPO CT Art. 4'],
  artistic:    ['Berne Art. 2(1)', 'TRIPS Art. 9'],
  musical:     ['Berne Art. 2', 'WIPO Performances Art. 5'],
  audiovisual: ['Berne Art. 14bis', 'TRIPS Art. 14(4)'],
  software:    ['WIPO CT Art. 4', 'TRIPS Art. 10'],
  dramatic:    ['Berne Art. 2', 'Berne Art. 11'],
}

const FALLBACK = ['Berne Art. 2', 'WIPO CT Art. 4']

export interface LegalCiteProps {
  workType: string
  compact?: boolean
  className?: string
}

export function LegalCite({ workType, compact = false, className }: LegalCiteProps) {
  const cites = CITATIONS[workType.toLowerCase()] || FALLBACK
  const fontSize = compact ? 9 : 10
  const padding = compact ? '3px 8px' : '6px 12px'

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        padding,
        fontSize,
      }}
    >
      <span className="mono" style={{ color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
        § on the strength of
      </span>
      {cites.map((cite, i) => (
        <span key={cite} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <span style={{ color: 'var(--ink-4)' }}>·</span>}
          <span
            className="mono"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--gold) 10%, transparent)',
              color: 'var(--gold-text)',
              padding: '1px 6px',
              fontSize,
              letterSpacing: '0.04em',
            }}
          >
            {cite}
          </span>
        </span>
      ))}
    </div>
  )
}
