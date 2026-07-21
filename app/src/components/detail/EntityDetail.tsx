import { useEffect, type ReactNode } from 'react'
import { AlertTriangle, ArrowLeft, Inbox, Loader2 } from 'lucide-react'

export interface DetailTab {
  id: string
  label: string
  count?: number
}

export function EntityDetailShell({
  breadcrumbs,
  header,
  tabs,
  activeTab,
  onTabChange,
  aside,
  children,
  className = '',
}: {
  breadcrumbs?: ReactNode
  header: ReactNode
  tabs?: readonly DetailTab[]
  activeTab?: string
  onTabChange?: (tab: string) => void
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    const id = decodeURIComponent(hash.slice(1))
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return (
    <div className={`entity-detail ${className}`} data-testid="entity-detail-shell">
      {breadcrumbs && <nav aria-label="Breadcrumb" className="entity-detail__breadcrumbs">{breadcrumbs}</nav>}
      <header className="entity-detail__header">{header}</header>
      {tabs && tabs.length > 0 && (
        <div className="entity-detail__tabs" role="tablist" aria-label="Entity sections">
          {tabs.map((tab) => {
            const selected = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                className="entity-detail__tab"
                data-active={selected || undefined}
                onClick={() => onTabChange?.(tab.id)}
              >
                {tab.label}
                {tab.count !== undefined && <span className="entity-detail__tab-count">{tab.count}</span>}
              </button>
            )
          })}
        </div>
      )}
      <div className="entity-detail__layout">
        <section className="entity-detail__content">{children}</section>
        {aside && <aside className="entity-detail__aside" aria-label="Available actions">{aside}</aside>}
      </div>
    </div>
  )
}

export function EntityHeader({
  eyebrow,
  title,
  description,
  media,
  status,
  metadata,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  media?: ReactNode
  status?: ReactNode
  metadata?: ReactNode
}) {
  return (
    <div className="entity-header" data-has-media={media ? true : undefined}>
      {media && <div className="entity-header__media">{media}</div>}
      <div className="entity-header__identity">
        {eyebrow && <div className="doc-title-eyebrow">{eyebrow}</div>}
        <div className="entity-header__title-row">
          <h1 className="entity-header__title">{title}</h1>
          {status && <div className="entity-header__status">{status}</div>}
        </div>
        {description && <div className="entity-header__description">{description}</div>}
        {metadata && <div className="entity-header__metadata">{metadata}</div>}
      </div>
    </div>
  )
}

export function DetailSection({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`entity-section ${className}`}>
      <div className="entity-section__heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="entity-section__body">{children}</div>
    </section>
  )
}

export function DetailActionRail({ title, primary, children }: {
  title?: ReactNode
  primary?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="entity-action-rail card" data-has-primary={primary ? true : undefined}>
      {title && <h2>{title}</h2>}
      {primary && <div className="entity-action-rail__primary">{primary}</div>}
      {children && <div className="entity-action-rail__secondary">{children}</div>}
    </div>
  )
}

export function DetailLoadingState({ label = 'Loading details…' }: { label?: string }) {
  return (
    <div className="entity-state" role="status" aria-live="polite">
      <Loader2 className="entity-state__icon animate-spin" aria-hidden="true" />
      <strong>{label}</strong>
      <div className="entity-state__skeleton" aria-hidden="true">
        <span /><span /><span />
      </div>
    </div>
  )
}

export function DetailErrorState({ title, message, retry, back }: {
  title: string
  message: string
  retry?: ReactNode
  back?: ReactNode
}) {
  return (
    <div className="entity-state" role="alert">
      <AlertTriangle className="entity-state__icon" aria-hidden="true" />
      <strong>{title}</strong>
      <p>{message}</p>
      <div className="entity-state__actions">{retry}{back}</div>
    </div>
  )
}

export function DetailEmptyState({ title, message, action }: {
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <div className="entity-state">
      <Inbox className="entity-state__icon" aria-hidden="true" />
      <strong>{title}</strong>
      <p>{message}</p>
      {action && <div className="entity-state__actions">{action}</div>}
    </div>
  )
}

export function DetailBackLabel({ children }: { children: ReactNode }) {
  return <span className="entity-detail__back"><ArrowLeft aria-hidden="true" />{children}</span>
}
