import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Scale, ArrowLeft, Printer } from 'lucide-react'
import { useI18nStore, useTranslations } from '@/lib/i18n'

interface LegalPageContent {
  title: string
  lastUpdated: string
  responsibleParty: string
  intro: readonly string[]
  sections: ReadonlyArray<{
    heading: string
    paragraphs: readonly string[]
    bullets?: readonly string[]
  }>
  contact: { heading: string; body: readonly string[] }
}

interface LegalPageProps {
  doc: LegalPageContent
  draftTitle: string
  draftBody: string
  backLabel: string
}

// Shared public legal-document shell with document typography and print controls.
export function LegalPage({ doc, draftTitle, draftBody, backLabel }: LegalPageProps) {
  const { t } = useTranslations()
  const { language } = useI18nStore()
  // Spanish is the authoritative text. Surface the draft banner only on EN.
  const isDraft = language === 'en'

  useEffect(() => {
    document.title = `${doc.title} · Soft.Law`
    return () => { document.title = 'Soft.Law' }
  }, [doc.title])

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
        {/* Top bar — back link + print */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[11px] font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--ink-4)' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {backLabel}
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-sm"
            style={{
              backgroundColor: 'var(--bg-elev-2)',
              color: 'var(--ink-4)',
              border: '1px solid var(--line)',
            }}
          >
            <Printer className="w-3 h-3" /> {t.disputes.print}
          </button>
        </div>

        {/* Draft notice — shown only on EN until translation is finalized */}
        {isDraft && (
          <div
            className="mb-6 p-4 rounded-sm"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--warn) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--warn) 35%, transparent)',
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--warn)' }}>
              {draftTitle}
            </p>
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              {draftBody}
            </p>
          </div>
        )}

        {/* Document */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="px-5 sm:px-8 py-7 sm:py-9 space-y-6">
            {/* Header */}
            <div className="text-center space-y-1 pb-4" style={{ borderBottom: '1px solid var(--line)' }}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Scale className="w-4 h-4" style={{ color: 'var(--gold-text)' }} />
                <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--ink-4)' }}>
                  Soft.Law Platform
                </p>
              </div>
              <h1
                className="display"
                style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}
              >
                {doc.title}
              </h1>
              <p className="text-[10px] mono" style={{ color: 'var(--ink-4)' }}>{doc.lastUpdated}</p>
              <p className="text-[10px] mono" style={{ color: 'var(--ink-4)' }}>{doc.responsibleParty}</p>
            </div>

            {/* Intro */}
            <div
              className="px-4 py-3 rounded-sm"
              style={{ backgroundColor: 'var(--bg-elev-2)', borderLeft: '3px solid var(--gold)' }}
            >
              {doc.intro.map((p, i) => (
                <p
                  key={i}
                  className="text-[12px] leading-relaxed italic"
                  style={{ color: 'var(--ink-2)' }}
                >
                  {p}
                </p>
              ))}
            </div>

            {/* Sections */}
            {doc.sections.map((s, idx) => (
              <div key={idx} className="space-y-2">
                <p
                  className="text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: 'var(--gold-text)' }}
                >
                  {s.heading}
                </p>
                {s.paragraphs.map((p, j) => (
                  <p
                    key={j}
                    className="text-[12px] leading-relaxed"
                    style={{ color: 'var(--ink-2)' }}
                  >
                    {p}
                  </p>
                ))}
                {s.bullets && s.bullets.length > 0 && (
                  <ul className="space-y-1 pl-4">
                    {s.bullets.map((b, k) => (
                      <li
                        key={k}
                        className="text-[12px] leading-relaxed list-disc"
                        style={{ color: 'var(--ink-2)' }}
                      >
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
                {idx < doc.sections.length - 1 && (
                  <div className="pt-2" style={{ borderBottom: '1px solid var(--line-2)' }} />
                )}
              </div>
            ))}

            {/* Contact */}
            <div
              className="space-y-1 pt-2"
              style={{ borderTop: '1px solid var(--line)' }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-wide pt-4"
                style={{ color: 'var(--gold-text)' }}
              >
                {doc.contact.heading}
              </p>
              {doc.contact.body.map((p, i) => (
                <p
                  key={i}
                  className="text-[12px] leading-relaxed"
                  style={{ color: 'var(--ink-2)' }}
                >
                  {p}
                </p>
              ))}
            </div>

            {/* Footer */}
            <div className="text-center pt-3 space-y-0.5" style={{ borderTop: '1px solid var(--line)' }}>
              <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>
                {doc.lastUpdated}
              </p>
              <p className="text-[10px] font-semibold mt-1" style={{ color: 'var(--gold-text)' }}>
                soft.law — Decentralized IP Registry &amp; Licensing
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
