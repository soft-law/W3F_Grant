import { useLocation } from 'react-router-dom'

const SECTION_MAP = [
  { prefix: '/studio', section: 'ip' },
  { prefix: '/licenses', section: 'licenses' },
  { prefix: '/judicial', section: 'judicial' },
] as const

export type ActiveSection = 'explorer' | 'ip' | 'licenses' | 'judicial'

export function useActiveSection(): ActiveSection {
  const { pathname, search } = useLocation()
  if (pathname.startsWith('/assets/')) {
    const context = new URLSearchParams(search).get('from')
    if (context === 'studio') return 'ip'
    if (context === 'licenses') return 'licenses'
    if (context === 'judicial') return 'judicial'
    return 'explorer'
  }
  for (const { prefix, section } of SECTION_MAP) {
    if (pathname.startsWith(prefix)) return section
  }
  return 'explorer'
}
