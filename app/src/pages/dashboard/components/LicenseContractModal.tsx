import { useState, useEffect, useCallback } from 'react'
import { X, ExternalLink, FileText, Printer, Loader2, AlertCircle, ChevronDown, ChevronRight, Shield, Users, Scale, RefreshCw } from 'lucide-react'
import type { ThemeColors } from '@/hooks/useTheme'
import { fetchFromIPFS, ipfsToHttp } from '@/lib/ipfs-storage'
import { useTranslations } from '@/lib/i18n'

interface ClauseData {
  clause_number: number | string
  title: string
  body: string
  [key: string]: unknown
}

interface LicenseDocument {
  document_type?: string
  document_version?: string
  generated_at?: number
  generated_date?: string
  platform?: string
  platform_url?: string
  metadata?: {
    license_type?: string
    license_type_label?: string
    cc_type?: string | null
    chain_id?: number
    network?: string
    ip_contract?: string
    license_contract?: string
    arbitrator_contract?: string
    revenue_distributor?: string
  }
  parties?: {
    licensor?: { address?: string; role?: string }
    licensee?: { address?: string; role?: string }
  }
  subject?: {
    ip_asset_id?: string
    ip_title?: string | null
    description?: string
  }
  terms?: {
    license_type?: string
    rights_granted?: Array<{ key: string; label: string }>
    is_exclusive?: boolean
    is_commercial?: boolean
    requires_attribution?: boolean
    territory?: string
    duration_days?: number
    is_perpetual?: boolean
    supply?: number
  }
  governing_law?: {
    framework?: string
    treaties?: string[]
  }
  clauses?: ClauseData[]
  enforcement?: {
    plan_a?: string
    plan_b?: string
  }
  signature?: {
    signer?: string
    sig?: string
    document_hash?: string
    method?: string
    signed_at?: number
    signed_date?: string
  }
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-1.5" style={{ borderBottom: '1px solid var(--line)' }}>
      <span className="text-[11px] w-28 flex-shrink-0" style={{ color: 'var(--ink-4)' }}>{label}</span>
      <span className={`text-[11px] font-medium flex-1 break-all ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  )
}

export function LicenseContractModal({ colors, licenseId, publicMetadataURI, onClose }: {
  colors: ThemeColors
  licenseId: string
  publicMetadataURI: string
  onClose: () => void
}) {
  const { t } = useTranslations()
  const [doc, setDoc] = useState<LicenseDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedClauses, setExpandedClauses] = useState<Set<number | string>>(new Set())

  const ipfsLink = publicMetadataURI ? ipfsToHttp(publicMetadataURI) : null
  const cid = publicMetadataURI?.replace('ipfs://', '').replace('ipfs/', '') || ''

  const fetchDoc = useCallback(async () => {
    if (!cid) {
      setError(t.licenseContract.noMetadata)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetchFromIPFS(cid, 15000)
      const json = await res.json()
      setDoc(json as LicenseDocument)
    } catch {
      setError(t.licenseContract.fetchError)
    } finally {
      setLoading(false)
    }
  }, [cid, t])

  useEffect(() => {
    const timer = window.setTimeout(fetchDoc, 0)
    return () => window.clearTimeout(timer)
  }, [fetchDoc])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const toggleClause = (num: number | string) => {
    setExpandedClauses(prev => {
      const next = new Set(prev)
      if (next.has(num)) next.delete(num)
      else next.add(num)
      return next
    })
  }

  const expandAll = () => {
    if (!doc?.clauses) return
    setExpandedClauses(new Set(doc.clauses.map(c => c.clause_number)))
  }

  const collapseAll = () => {
    setExpandedClauses(new Set())
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }} onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: colors.background.primary, border: `1px solid ${colors.border.primary}`, maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${colors.border.primary}` }}>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" style={{ color: colors.accent.goldText }} />
            <span className="text-sm font-semibold" style={{ color: colors.text.primary }}>
              License #{licenseId} — {t.licenseContract.legalContract}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {doc && (
              <>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[11px] font-medium transition-opacity hover:opacity-80"
                  style={{ backgroundColor: colors.background.secondary, color: colors.text.primary, border: `1px solid ${colors.border.primary}` }}
                >
                  <Printer className="w-3.5 h-3.5" />
                  {t.licenseContract.printPDF}
                </button>
                {ipfsLink && (
                  <a
                    href={ipfsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[11px] font-medium transition-opacity hover:opacity-80"
                    style={{ backgroundColor: `${colors.accent.gold}15`, color: colors.accent.goldText, border: `1px solid ${colors.accent.gold}40` }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t.licenseContract.viewOnIPFS}
                  </a>
                )}
              </>
            )}
            <button onClick={onClose} className="p-1.5 rounded-sm hover:opacity-70 transition-opacity" style={{ backgroundColor: colors.background.tertiary }}>
              <X className="w-4 h-4" style={{ color: colors.text.muted }} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: colors.accent.goldText }} />
              <p className="text-xs" style={{ color: colors.text.muted }}>{t.licenseContract.loadingContract}</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <AlertCircle className="w-6 h-6" style={{ color: colors.status.error }} />
              <p className="text-xs" style={{ color: colors.text.muted }}>{error}</p>
              <button
                onClick={fetchDoc}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[11px] font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: colors.background.secondary, color: colors.text.primary, border: `1px solid ${colors.border.primary}` }}
              >
                <RefreshCw className="w-3 h-3" />
                {t.licenseContract.retry}
              </button>
              {ipfsLink && (
                <a
                  href={ipfsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[11px] transition-opacity hover:opacity-80"
                  style={{ color: colors.accent.goldText }}
                >
                  <ExternalLink className="w-3 h-3" />
                  {t.licenseContract.viewOnIPFS}
                </a>
              )}
            </div>
          )}

          {doc && !loading && (
            <div className="p-5 space-y-5">
              {/* Document Metadata */}
              <section>
                <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: colors.text.muted }}>
                  {t.licenseContract.documentMetadata}
                </p>
                <div className="rounded-sm p-3" style={{ backgroundColor: colors.background.secondary, border: `1px solid ${colors.border.primary}` }}>
                  {doc.metadata?.license_type_label && (
                    <InfoRow label={t.licenseContract.licenseType} value={`${doc.metadata.license_type_label}${doc.metadata.cc_type ? ` (${doc.metadata.cc_type})` : ''}`} />
                  )}
                  {doc.document_version && (
                    <InfoRow label={t.licenseContract.version} value={`v${doc.document_version}`} />
                  )}
                  {doc.generated_date && (
                    <InfoRow label={t.licenseContract.generatedDate} value={new Date(doc.generated_date).toLocaleString()} />
                  )}
                  {doc.metadata?.network && (
                    <InfoRow label={t.licenseContract.network} value={doc.metadata.network} />
                  )}
                  {doc.platform && (
                    <InfoRow label={t.licenseContract.platform} value={doc.platform} />
                  )}
                </div>
              </section>

              {/* Parties */}
              {doc.parties && (
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-3.5 h-3.5" style={{ color: colors.text.muted }} />
                    <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: colors.text.muted }}>
                      {t.licenseContract.parties}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {doc.parties.licensor?.address && (
                      <div className="rounded-sm p-3" style={{ backgroundColor: colors.background.secondary, border: `1px solid ${colors.border.primary}` }}>
                        <p className="text-[10px] mb-1" style={{ color: colors.text.muted }}>{t.licenseContract.licensor}</p>
                        <p className="text-xs font-mono font-medium break-all" style={{ color: colors.text.primary }}>{truncateAddress(doc.parties.licensor.address)}</p>
                        {doc.parties.licensor.role && (
                          <p className="text-[10px] mt-0.5" style={{ color: colors.accent.goldText }}>{doc.parties.licensor.role}</p>
                        )}
                      </div>
                    )}
                    {doc.parties.licensee?.address && (
                      <div className="rounded-sm p-3" style={{ backgroundColor: colors.background.secondary, border: `1px solid ${colors.border.primary}` }}>
                        <p className="text-[10px] mb-1" style={{ color: colors.text.muted }}>{t.licenseContract.licensee}</p>
                        <p className="text-xs font-mono font-medium break-all" style={{ color: colors.text.primary }}>{truncateAddress(doc.parties.licensee.address)}</p>
                        {doc.parties.licensee.role && (
                          <p className="text-[10px] mt-0.5" style={{ color: colors.accent.goldText }}>{doc.parties.licensee.role}</p>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Terms Summary */}
              {doc.terms && (
                <section>
                  <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: colors.text.muted }}>
                    {t.licenseContract.rights}
                  </p>
                  <div className="rounded-sm p-3 space-y-1.5" style={{ backgroundColor: colors.background.secondary, border: `1px solid ${colors.border.primary}` }}>
                    {doc.subject?.ip_title && (
                      <InfoRow label={t.licenseContract.ipAsset} value={`${doc.subject.ip_title} (#${doc.subject.ip_asset_id})`} />
                    )}
                    {!doc.subject?.ip_title && doc.subject?.ip_asset_id && (
                      <InfoRow label={t.licenseContract.ipAsset} value={`#${doc.subject.ip_asset_id}`} />
                    )}
                    <InfoRow label={t.licenseContract.exclusive} value={doc.terms.is_exclusive ? t.licenseContract.yes : t.licenseContract.no} />
                    <InfoRow label={t.licenseContract.commercial} value={doc.terms.is_commercial ? t.licenseContract.yes : t.licenseContract.no} />
                    <InfoRow label={t.licenseContract.attribution} value={doc.terms.requires_attribution ? t.licenseContract.yes : t.licenseContract.no} />
                    {doc.terms.territory && (
                      <InfoRow label={t.licenseContract.territory} value={doc.terms.territory} />
                    )}
                    <InfoRow label={t.licenseContract.duration} value={doc.terms.is_perpetual ? t.licenseContract.perpetual : `${doc.terms.duration_days} days`} />
                    {doc.terms.rights_granted && doc.terms.rights_granted.length > 0 && (
                      <div className="pt-1.5">
                        <p className="text-[10px] mb-1.5" style={{ color: colors.text.muted }}>{t.licenseContract.rights}</p>
                        <div className="flex flex-wrap gap-1">
                          {doc.terms.rights_granted.map((r) => (
                            <span
                              key={r.key}
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                              style={{ backgroundColor: `${colors.accent.gold}15`, color: colors.accent.goldText, border: `1px solid ${colors.accent.gold}30` }}
                            >
                              {r.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Clauses */}
              {doc.clauses && doc.clauses.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Scale className="w-3.5 h-3.5" style={{ color: colors.text.muted }} />
                      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: colors.text.muted }}>
                        {t.licenseContract.clauses} ({doc.clauses.length})
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={expandAll}
                        className="px-2 py-1 rounded text-[10px] transition-opacity hover:opacity-80"
                        style={{ backgroundColor: colors.background.secondary, color: colors.text.muted, border: `1px solid ${colors.border.primary}` }}
                      >
                        +
                      </button>
                      <button
                        onClick={collapseAll}
                        className="px-2 py-1 rounded text-[10px] transition-opacity hover:opacity-80"
                        style={{ backgroundColor: colors.background.secondary, color: colors.text.muted, border: `1px solid ${colors.border.primary}` }}
                      >
                        -
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {doc.clauses.map((clause) => {
                      const isExpanded = expandedClauses.has(clause.clause_number)
                      return (
                        <div
                          key={String(clause.clause_number)}
                          className="rounded-sm overflow-hidden"
                          style={{ border: `1px solid ${colors.border.primary}` }}
                        >
                          <button
                            onClick={() => toggleClause(clause.clause_number)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors"
                            style={{ backgroundColor: isExpanded ? colors.background.secondary : colors.background.primary }}
                          >
                            {isExpanded
                              ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: colors.accent.goldText }} />
                              : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: colors.text.muted }} />
                            }
                            <span className="text-[11px] font-mono flex-shrink-0" style={{ color: colors.accent.goldText }}>
                              {clause.clause_number}.
                            </span>
                            <span className="text-xs font-medium" style={{ color: colors.text.primary }}>
                              {clause.title}
                            </span>
                          </button>
                          {isExpanded && (
                            <div className="px-4 py-3" style={{ backgroundColor: colors.background.primary, borderTop: `1px solid ${colors.border.primary}` }}>
                              <p className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: colors.text.secondary }}>
                                {clause.body}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Governing Law */}
              {doc.governing_law && (
                <section>
                  <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: colors.text.muted }}>
                    {t.licenseContract.governingLaw}
                  </p>
                  <div className="rounded-sm p-3" style={{ backgroundColor: colors.background.secondary, border: `1px solid ${colors.border.primary}` }}>
                    {doc.governing_law.framework && (
                      <p className="text-[11px] font-medium mb-2" style={{ color: colors.text.primary }}>{doc.governing_law.framework}</p>
                    )}
                    {doc.governing_law.treaties && doc.governing_law.treaties.length > 0 && (
                      <div className="space-y-1">
                        {doc.governing_law.treaties.map((treaty, i) => (
                          <p key={i} className="text-[10px] pl-2" style={{ color: colors.text.secondary, borderLeft: `2px solid ${colors.accent.gold}30` }}>
                            {treaty}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Enforcement */}
              {doc.enforcement && (
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-3.5 h-3.5" style={{ color: colors.text.muted }} />
                    <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: colors.text.muted }}>
                      {t.licenseContract.enforcement}
                    </p>
                  </div>
                  <div className="rounded-sm p-3 space-y-2" style={{ backgroundColor: colors.background.secondary, border: `1px solid ${colors.border.primary}` }}>
                    {doc.enforcement.plan_a && (
                      <div>
                        <p className="text-[10px] font-medium mb-0.5" style={{ color: colors.accent.goldText }}>Plan A</p>
                        <p className="text-[10px] leading-relaxed" style={{ color: colors.text.secondary }}>{doc.enforcement.plan_a}</p>
                      </div>
                    )}
                    {doc.enforcement.plan_b && (
                      <div>
                        <p className="text-[10px] font-medium mb-0.5" style={{ color: colors.accent.goldText }}>Plan B</p>
                        <p className="text-[10px] leading-relaxed" style={{ color: colors.text.secondary }}>{doc.enforcement.plan_b}</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Signature */}
              {doc.signature && (
                <section>
                  <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: colors.text.muted }}>
                    {t.licenseContract.signatureInfo}
                  </p>
                  <div className="rounded-sm p-3" style={{ backgroundColor: colors.background.secondary, border: `1px solid ${colors.accent.gold}30` }}>
                    {doc.signature.signer && (
                      <InfoRow label={t.licenseContract.signer} value={doc.signature.signer} mono />
                    )}
                    {doc.signature.method && (
                      <InfoRow label={t.licenseContract.method} value={doc.signature.method} />
                    )}
                    {doc.signature.signed_date && (
                      <InfoRow label={t.licenseContract.signedAt} value={new Date(doc.signature.signed_date).toLocaleString()} />
                    )}
                    {doc.signature.document_hash && (
                      <InfoRow label={t.licenseContract.documentHash} value={doc.signature.document_hash} mono />
                    )}
                    {doc.signature.sig && (
                      <div className="pt-1.5">
                        <p className="text-[10px] mb-1" style={{ color: colors.text.muted }}>{t.licenseContract.signature}</p>
                        <p className="text-[10px] font-mono break-all p-2 rounded-sm" style={{ color: colors.text.secondary, backgroundColor: colors.background.tertiary }}>
                          {doc.signature.sig}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
