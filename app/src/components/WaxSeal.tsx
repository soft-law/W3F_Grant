import { useId } from 'react'

export interface WaxSealProps {
  size?: number
  glyph?: string
  label?: string
  year?: number
  className?: string
}

export function WaxSeal({
  size = 64,
  glyph = '§',
  label = 'RECORDED · SOFT.LAW',
  year = new Date().getFullYear(),
  className,
}: WaxSealProps) {
  const rawId = useId()
  const uid = rawId.replace(/:/g, '')
  const bloomId = `bloom-${uid}`
  const pathId = `seal-path-${uid}`

  const cx = size / 2
  const cy = size / 2
  const rOuter = size / 2 - 3
  const rInner = size / 2 - 9
  const rText = size / 2 - 6
  const glyphFontSize = size * 0.34
  const yearFontSize = size * 0.12

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <radialGradient id={bloomId} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
        </radialGradient>
        <path
          id={pathId}
          d={`M ${cx},${cy - rText} a ${rText},${rText} 0 1,1 -0.01,0`}
        />
      </defs>
      <circle cx={cx} cy={cy} r={rOuter + 1} fill={`url(#${bloomId})`} />
      <circle
        cx={cx}
        cy={cy}
        r={rOuter}
        fill="none"
        stroke="var(--gold)"
        strokeWidth="1"
        strokeDasharray="3 2"
      />
      <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="var(--gold)" strokeWidth="1" />
      <text
        style={{
          fill: 'var(--gold)',
          fontFamily: 'var(--font-mono)',
          fontSize: 7,
          letterSpacing: '1px',
        }}
      >
        <textPath href={`#${pathId}`} startOffset="0%">
          {label}
        </textPath>
      </text>
      <text
        x={cx}
        y={cy + glyphFontSize * 0.35}
        textAnchor="middle"
        style={{
          fill: 'var(--gold)',
          fontFamily: 'var(--font-mono)',
          fontSize: glyphFontSize,
          fontWeight: 700,
        }}
      >
        {glyph}
      </text>
      <text
        x={cx}
        y={cy + size * 0.34}
        textAnchor="middle"
        style={{
          fill: 'var(--ink-3)',
          fontFamily: 'var(--font-mono)',
          fontSize: yearFontSize,
        }}
      >
        {year}
      </text>
    </svg>
  )
}
