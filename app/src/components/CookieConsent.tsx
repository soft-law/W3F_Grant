import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cookie } from 'lucide-react'
import { useTranslations } from '@/lib/i18n'

const COOKIE_CONSENT_KEY = 'softlaw-cookie-consent-v1'

// Show the notice when consent state cannot be read; never assume consent.
export function CookieConsent() {
  const { t } = useTranslations()
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    let stored: string | null = null
    try {
      stored = window.localStorage.getItem(COOKIE_CONSENT_KEY)
    } catch {
      // Storage unavailable — fall through; treat as not consented.
    }
    return !stored
  })

  function dismiss(choice: 'accepted' | 'dismissed') {
    try { window.localStorage.setItem(COOKIE_CONSENT_KEY, choice) } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label={t.cookieConsent.ariaLabel}
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 100,
        maxWidth: 760,
        margin: '0 auto',
        backgroundColor: 'var(--bg-elev)',
        border: '1px solid var(--line)',
        borderRadius: 4,
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <Cookie className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--gold-text)' }} />
      <p className="text-[11px] leading-relaxed flex-1" style={{ color: 'var(--ink-2)' }}>
        {t.cookieConsent.body}{' '}
        <Link to="/privacy" style={{ color: 'var(--gold-text)', textDecoration: 'underline' }}>
          {t.cookieConsent.privacyLink}
        </Link>
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => dismiss('dismissed')}
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11 }}
        >
          {t.cookieConsent.dismiss}
        </button>
        <button
          onClick={() => dismiss('accepted')}
          className="btn btn-primary btn-sm"
          style={{ fontSize: 11 }}
        >
          {t.cookieConsent.accept}
        </button>
      </div>
    </div>
  )
}
