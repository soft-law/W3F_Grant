import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface MenuItem {
  icon: LucideIcon
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  divider?: boolean
}

export function ContextMenu({ items, trigger, compact }: { items: MenuItem[]; trigger?: ReactNode; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const toggle = useCallback(() => {
    if (open) { setOpen(false); return }
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const estimatedMenuHeight = items.length * 34 + 2
      // Prefer right-aligned dropdown; fall back to left-aligned if near right edge
      const left = Math.min(rect.right - 200, window.innerWidth - 212)
      // Open upward near the viewport floor so every action stays reachable.
      const top = rect.bottom + 4 + estimatedMenuHeight > window.innerHeight
        ? Math.max(4, rect.top - estimatedMenuHeight - 4)
        : rect.bottom + 4
      setPos({ top, left: Math.max(4, left) })
    }
    setOpen(true)
  }, [items.length, open])

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    // Close the fixed portal when its trigger moves.
    const onViewportChange = () => close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onViewportChange, true)
    window.addEventListener('resize', onViewportChange)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onViewportChange, true)
      window.removeEventListener('resize', onViewportChange)
    }
  }, [open, close])

  const btnStyle = compact
    ? { padding: '2px 4px', backgroundColor: 'transparent', border: 'none' }
    : { minWidth: 44, minHeight: 44, backgroundColor: 'var(--bg-elev-2)', border: '1px solid var(--line)' }

  // Derived menus can legitimately have no valid actions. Do not render a
  // blank overflow trigger that appears broken when opened.
  if (items.length === 0) return null

  return (
    <>
      <button
        ref={btnRef}
        onClick={(event) => {
          event.stopPropagation()
          toggle()
        }}
        aria-label="Open menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center justify-center rounded-sm hover:opacity-80 transition-opacity duration-150"
        style={btnStyle}
      >
        {trigger ?? <MoreHorizontal style={{ width: 16, height: 16, color: 'var(--ink-4)' }} />}
      </button>
      {open && pos && createPortal(
        <>
          <div
            className="fixed inset-0"
            style={{ zIndex: 50 }}
            onClick={(event) => {
              event.stopPropagation()
              close()
            }}
          />
          <div
            role="menu"
            className="fixed rounded-sm shadow-lg"
            style={{ zIndex: 51, top: pos.top, left: pos.left, minWidth: 200, backgroundColor: 'var(--bg-elev-2)', border: '1px solid var(--line)' }}
            // React portal events still bubble through the card's React tree.
            // Keep menu actions from also opening the underlying asset route.
            onClick={(event) => event.stopPropagation()}
          >
            {items.map((item, i) => {
              const Icon = item.icon
              const itemColor = item.danger ? 'var(--danger)' : item.disabled ? 'var(--ink-4)' : 'var(--ink)'
              return (
                <button
                  key={i}
                  role="menuitem"
                  aria-disabled={item.disabled || undefined}
                  onClick={() => { if (!item.disabled) { item.onClick(); close() } }}
                  className="w-full flex items-center gap-2 text-xs transition-colors"
                  style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    color: itemColor,
                    borderTop: item.divider ? '1px solid var(--line)' : undefined,
                    opacity: item.disabled ? 0.4 : 1,
                    cursor: item.disabled ? 'default' : 'pointer',
                    background: 'transparent',
                  }}
                  onMouseEnter={e => { if (!item.disabled) (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--gold) 12%, transparent)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
                  {item.label}
                </button>
              )
            })}
          </div>
        </>
      , document.body)}
    </>
  )
}
