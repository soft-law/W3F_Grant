import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: 16,
      textAlign: 'center',
      padding: 24,
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        backgroundColor: 'color-mix(in srgb, var(--gold) 12%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Compass style={{ width: 32, height: 32, color: 'var(--gold-text)' }} />
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)' }}>Page not found</h1>
      <p style={{ fontSize: 13, color: 'var(--ink-3)', maxWidth: 320 }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/explorer" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
        Go to Explorer
      </Link>
    </div>
  )
}
