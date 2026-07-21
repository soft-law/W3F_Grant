import { useTranslations } from '@/lib/i18n'
import { LegalPage } from './LegalPage'

export default function PrivacyPage() {
  const { t } = useTranslations()
  const l = t.legal
  return (
    <LegalPage
      doc={l.privacy}
      draftTitle={l.draftNoticeTitle}
      draftBody={l.draftNoticeBody}
      backLabel={l.backToApp}
    />
  )
}
