export function PivotTab({ active, onClick, label, sub, icon: Icon, alert, alertLabel }: {
  active: boolean
  onClick: () => void
  label: string
  sub: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  alert?: number
  alertLabel?: string
}) {
  return (
    <button onClick={onClick} className="flex items-center gap-3" style={{
      flex: 1, padding: '14px 16px', textAlign: 'left', cursor: 'pointer',
      background: active ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : 'transparent',
      borderLeft: active ? '2px solid var(--gold)' : '2px solid transparent',
      color: active ? 'var(--ink)' : 'var(--ink-2)',
    }}>
      <Icon style={{ width: 18, height: 18, color: active ? 'var(--gold-text)' : 'var(--ink-3)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
          {!!alert && alert > 0 && alertLabel && (
            <span className="mono" style={{
              padding: '1px 6px', fontSize: 10, background: 'var(--danger)',
              color: 'white', fontWeight: 700, letterSpacing: '0.06em',
            }}>{alert} {alertLabel}</span>
          )}
        </div>
        <div className="allcaps mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  )
}
