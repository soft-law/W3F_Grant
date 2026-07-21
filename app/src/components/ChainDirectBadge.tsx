import { useTranslations } from '@/lib/i18n'

/**
 * Badge shown when entity data comes from direct PAPI reads rather than
 * the indexer. Communicates that off-chain metadata, history, and revenue
 * data may be incomplete.
 */
export function ChainDirectBadge() {
  const { t } = useTranslations()
  return (
    <span
      className="chip"
      style={{
        fontSize: 10,
        padding: '2px 8px',
        backgroundColor: 'color-mix(in srgb, var(--gold) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--gold) 30%, transparent)',
        color: 'var(--gold-text)',
      }}
      title={t.degradedMode.partialLabel}
    >
      {t.degradedMode.partialLabel}
    </span>
  )
}
