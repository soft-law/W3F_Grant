import { useEffect } from 'react'
import { useStore } from '@/lib/store'
import { THEME_COLORS } from '@/lib/constants/colors'

export type ThemeColors = (typeof THEME_COLORS)['dark'] | (typeof THEME_COLORS)['light']

export function useTheme() {
  const { theme, density, iptypeMode } = useStore()
  const colors = THEME_COLORS[theme]

  useEffect(() => {
    const html = document.documentElement
    html.classList.remove('dark', 'light')
    html.classList.add(theme)
    html.dataset.theme = theme
    html.dataset.density = density
    html.dataset.iptypeMode = iptypeMode
    html.style.backgroundColor = colors.background.primary

    const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]')
    const themeColorMeta = document.querySelector('meta[name="theme-color"]')
    if (colorSchemeMeta) colorSchemeMeta.setAttribute('content', theme)
    if (themeColorMeta) themeColorMeta.setAttribute('content', colors.background.primary)

    const s = html.style
    s.setProperty('--privy-color-background',   colors.background.primary)
    s.setProperty('--privy-color-background-2', colors.background.secondary)
    s.setProperty('--privy-color-background-3', colors.background.tertiary)
    s.setProperty('--privy-color-foreground',   colors.text.primary)
    s.setProperty('--privy-color-foreground-2', colors.text.secondary)
    s.setProperty('--privy-color-foreground-3', colors.text.tertiary)
    s.setProperty('--privy-color-foreground-4', colors.text.muted)
    s.setProperty('--privy-color-accent',         colors.accent.gold)
    s.setProperty('--privy-color-accent-light',   colors.accent.goldLight)
    s.setProperty('--privy-color-accent-dark',    colors.accent.goldDark)
    s.setProperty('--privy-color-accent-darkest', colors.accent.goldDark)
    s.setProperty('--privy-color-success', colors.status.success)
    s.setProperty('--privy-color-error',   colors.status.error)
    s.setProperty('--privy-border-radius-sm',   '0px')
    s.setProperty('--privy-border-radius-md',   '2px')
    s.setProperty('--privy-border-radius-lg',   '2px')
    s.setProperty('--privy-border-radius-full', '0px')
  }, [theme, density, iptypeMode, colors])

  return { theme, colors }
}
