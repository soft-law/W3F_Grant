import type { ThemeColors } from '@/hooks/useTheme'

const GLYPH_MAP: Record<string, string> = {
  literary:    '§',
  artistic:    '◐',
  musical:     '♪',
  audiovisual: '▶',
  software:    '{}',
  dramatic:    '✦',
}

const LABEL_MAP: Record<string, string> = {
  literary:    'Literary',
  artistic:    'Artistic',
  musical:     'Musical',
  audiovisual: 'Audiovisual',
  software:    'Software',
  dramatic:    'Dramatic',
}

function resolveKey(category: string): string {
  const c = category.toLowerCase()
  if (c.includes('music'))                                    return 'musical'
  if (c.includes('literary') || c.includes('book') || c.includes('text')) return 'literary'
  if (c.includes('audio') || c.includes('video') || c.includes('film'))   return 'audiovisual'
  if (c.includes('software') || c.includes('code'))          return 'software'
  if (c.includes('dramatic') || c.includes('script') || c.includes('drama')) return 'dramatic'
  if (c.includes('artistic') || c.includes('art') || c.includes('visual')) return 'artistic'
  return ''
}

interface TypeTagProps {
  category: string
  size?: 'sm' | 'md'
  /** @deprecated kept for backward compat — unused internally */
  hasLicenses?: boolean
  /** @deprecated kept for backward compat — overrides label when provided */
  type?: 'IP' | 'License'
  /** @deprecated kept for backward compat — unused internally */
  colors?: ThemeColors
}

export function TypeTag({ category, size = 'md', type }: TypeTagProps) {
  const key = resolveKey(category)
  const glyph = GLYPH_MAP[key] ?? '·'
  const label = type ?? LABEL_MAP[key] ?? (category || 'IP')
  const isSm = size === 'sm'

  return (
    <span
      className="type-tag"
      style={isSm ? { fontSize: 9.5, padding: '1px 6px' } : undefined}
    >
      <span style={{ fontStyle: 'normal' }}>{glyph}</span>
      {label}
    </span>
  )
}

/** @alias TypeTag — exported under original name for backward compat */
export const DocumentBadge = TypeTag
