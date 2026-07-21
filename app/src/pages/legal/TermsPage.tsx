import { useTranslations } from '@/lib/i18n'
import { LegalPage } from './LegalPage'

export default function TermsPage() {
  const { t } = useTranslations()
  const l = t.legal
  return (
    <LegalPage
      doc={l.terms}
      draftTitle={l.draftNoticeTitle}
      draftBody={l.draftNoticeBody}
      backLabel={l.backToApp}
    />
  )
}
