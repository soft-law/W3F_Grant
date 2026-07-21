import { useEffect, useId, useRef } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { ThemeColors } from '@/hooks/useTheme'

export function Modal({ colors: _colors, title, onClose, children, panelClassName = '', contentClassName = '' }: {
  colors: ThemeColors
  title: string
  onClose: () => void
  children: React.ReactNode
  panelClassName?: string
  contentClassName?: string
}) {
  const titleId = useId()
  // Remember the element that had focus when the modal opened so we can
  // restore focus on close (e.g. the kebab button that opened the modal).
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null

    // Move focus into the panel so screen readers announce the dialog and
    // the next Tab lands on a control inside it (not on the page behind).
    requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      first?.focus()
    })

    return () => {
      document.body.style.overflow = ''
      // Restore focus to whatever opened the modal (typically the trigger button).
      previousFocusRef.current?.focus()
    }
  }, [])

  const dialog = (
    <div className="scrim" onClick={onClose} data-testid="modal-scrim">
      <motion.div
        ref={panelRef}
        className={`modal-panel ${panelClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="modal-header">
          <h3 id={titleId} className="display text-base font-bold" style={{ color: 'var(--ink)' }}>{title}</h3>
          <button onClick={onClose} aria-label="Close dialog" className="btn-icon" style={{ background: 'var(--bg-elev)' }}>
            <X className="w-4 h-4" style={{ color: 'var(--ink-4)' }} />
          </button>
        </div>
        <div className={`modal-body ${contentClassName}`.trim()}>
          {children}
        </div>
      </motion.div>
    </div>
  )

  // Portalling avoids header/footer stacking contexts entirely. A modal is
  // an application-level surface, not a child of the page that opened it.
  return createPortal(dialog, document.body)
}
