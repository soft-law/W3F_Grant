import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Tag, Briefcase, FileText, Image, Music, Film, Code, Drama, Edit3, PieChart, Award, Key, Activity, ExternalLink, Lock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ThemeColors } from '@/hooks/useTheme'
import type { UserIPAsset, UserLicense } from '@/hooks/useContracts'
import { formatTimestamp } from '@/lib/contracts'
import { useTranslations } from '@/lib/i18n'
import { PrivateContentDownload } from './PrivateContentDownload'
import { useNow } from '@/hooks/useNow'
import { DynamicIcon } from '@/components/DynamicIcon'

const WORK_TYPE_ICON_MAP: Record<string, LucideIcon> = {
  literary: FileText,
  artistic: Image,
  musical: Music,
  audiovisual: Film,
  software: Code,
  dramatic: Drama,
  // Stored category aliases
  copyright: FileText,
  artwork: Image,
  music: Music,
  video: Film,
}

function MetaRow({ icon, label, value, valueColor }: { icon: LucideIcon; label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-start gap-3 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
      <div className="flex items-center gap-2 w-28 flex-shrink-0">
        <DynamicIcon icon={icon} className="w-3.5 h-3.5" style={{ color: 'var(--ink-4)' }} />
        <span className="text-xs" style={{ color: 'var(--ink-4)' }}>{label}</span>
      </div>
      <span className="text-xs font-medium flex-1 break-all" style={{ color: valueColor ?? 'var(--ink)' }}>{value}</span>
    </div>
  )
}

export function IPAssetDetailModal({ asset, licenses, colors, onClose, onUpdateMetadata, onConfigureRevenue, onGenerateCertificate }: { asset: UserIPAsset; licenses: UserLicense[]; colors: ThemeColors; onClose: () => void; onUpdateMetadata: () => void; onConfigureRevenue: () => void; onGenerateCertificate: () => void }) {
  const { t } = useTranslations()
  const nowMs = useNow()

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const categoryIcon = WORK_TYPE_ICON_MAP[asset.category] ?? Briefcase
  const categoryLabel = (t.registry.categories as Record<string, string>)[asset.category] ?? asset.category

  return (
    <div className="scrim" onClick={onClose}>
      <motion.div
        className="modal-panel flex flex-col"
        onClick={(e) => e.stopPropagation()}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      >

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 sticky top-0 z-10" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
          <div className="flex items-center gap-2">
            <DynamicIcon icon={categoryIcon} className="w-4 h-4" style={{ color: 'var(--gold-text)' }} />
            <span className="text-xs font-semibold capitalize" style={{ color: 'var(--ink)' }}>{categoryLabel}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: asset.hasActiveDispute ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)', color: asset.hasActiveDispute ? '#f59e0b' : '#22c55e' }}>
              {asset.hasActiveDispute ? t.ipAssetDetail.dispute : t.ipAssetDetail.active}
            </span>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ background: 'var(--bg-elev)' }}>
            <X className="w-4 h-4" style={{ color: 'var(--ink-4)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left column: image + quick actions */}
          <div className="w-56 flex-shrink-0 p-4 flex flex-col gap-3" style={{ borderRight: `1px solid ${colors.border.primary}` }}>
            <div className="w-full aspect-square rounded-sm overflow-hidden flex items-center justify-center" style={{ backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.primary}` }}>
              {(() => {
                const cat = (asset.category || '').toLowerCase()
                const isAudiovisual = (cat.includes('audio') && cat.includes('visual')) || cat.includes('video') || cat.includes('film')
                const isMusical = cat === 'musical' || cat.includes('music')
                if (isAudiovisual && asset.animationUrl) {
                  return <video src={asset.animationUrl} poster={asset.imageUrl || undefined} controls preload="metadata" playsInline className="w-full h-full object-cover" />
                }
                if (isMusical && asset.animationUrl) {
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-4" style={{ background: `linear-gradient(135deg, ${colors.accent.gold}10, ${colors.background.tertiary})` }}>
                      <Music className="w-14 h-14" style={{ color: colors.accent.goldText }} />
                      <audio src={asset.animationUrl} controls className="w-full" />
                    </div>
                  )
                }
                if (asset.imageUrl) {
                  return <img src={asset.imageUrl} alt="" className="w-full h-full object-cover" />
                }
                return <DynamicIcon icon={categoryIcon} className="w-14 h-14" style={{ color: colors.text.muted }} />
              })()}
            </div>

            {/* Stats */}
            <div className="rounded-sm p-3 space-y-2" style={{ backgroundColor: colors.background.secondary, border: `1px solid ${colors.border.primary}` }}>
              <div className="flex justify-between items-center">
                <span className="text-[10px]" style={{ color: colors.text.muted }}>{t.common.tokenId}</span>
                <span className="text-[11px] font-bold" style={{ color: colors.text.primary }}>#{asset.tokenId.toString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px]" style={{ color: colors.text.muted }}>{t.ipAssetDetail.licenses}</span>
                <span className="text-[11px] font-bold" style={{ color: colors.accent.goldText }}>{licenses.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px]" style={{ color: colors.text.muted }}>{t.ipAssetDetail.activeLic}</span>
                <span className="text-[11px] font-bold" style={{ color: colors.accent.goldText }}>{asset.activeLicenseCount.toString()}</span>
              </div>
            </div>

            {/* Quick actions */}
            <button onClick={onUpdateMetadata} className="w-full flex items-center justify-center gap-2 py-2 rounded-sm text-xs font-medium transition-all hover:opacity-80" style={{ backgroundColor: colors.background.secondary, color: colors.text.primary, border: `1px solid ${colors.border.primary}` }}>
              <Edit3 className="w-3.5 h-3.5" style={{ color: colors.accent.goldText }} /> {t.ipAssetDetail.updateMetadata}
            </button>
            <button onClick={onConfigureRevenue} className="w-full flex items-center justify-center gap-2 py-2 rounded-sm text-xs font-medium transition-all hover:opacity-80" style={{ backgroundColor: colors.background.secondary, color: colors.text.primary, border: `1px solid ${colors.border.primary}` }}>
              <PieChart className="w-3.5 h-3.5" style={{ color: colors.accent.goldText }} /> {t.ipAssetDetail.revenueSplit}
            </button>
            <button onClick={onGenerateCertificate} className="w-full flex items-center justify-center gap-2 py-2 rounded-sm text-xs font-medium transition-all hover:opacity-80" style={{ backgroundColor: `${colors.accent.gold}15`, color: colors.accent.goldText, border: `1px solid ${colors.accent.gold}40` }}>
              <Award className="w-3.5 h-3.5" /> {t.ipAssetDetail.certificate}
            </button>
          </div>

          {/* Right column: all metadata + licenses */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-5">
              {/* Title */}
              <h2 className="text-xl font-bold leading-tight mb-1" style={{ color: colors.text.primary }}>{asset.title}</h2>
              {asset.creator && <p className="text-xs mb-3" style={{ color: colors.text.muted }}>{t.common.by} {asset.creator}</p>}

              {/* Description */}
              {asset.description && (
                <div className="mb-4 p-3 rounded-sm" style={{ backgroundColor: colors.background.secondary, border: `1px solid ${colors.border.primary}` }}>
                  <p className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: colors.text.muted }}>{t.common.description}</p>
                  <p className="text-sm leading-relaxed" style={{ color: colors.text.secondary }}>{asset.description}</p>
                </div>
              )}

              {/* Private content (owner-only) */}
              {asset.privateContentCid && (
                <div className="mb-4">
                  <p className="text-[10px] uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: colors.text.muted }}>
                    <Lock className="w-3 h-3" /> {t.privateContent.downloadTitle}
                  </p>
                  <PrivateContentDownload
                    subject={{ kind: 'asset', id: Number(asset.tokenId) }}
                    cid={asset.privateContentCid}
                  />
                </div>
              )}

              {/* Token info */}
              <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: colors.text.muted }}>{t.common.tokenInfo}</p>
              <MetaRow icon={Tag} label={t.common.tokenId} value={`#${asset.tokenId.toString()}`} />
              <MetaRow icon={Briefcase} label={t.registry.form.categoryLabel} value={categoryLabel} />
              <MetaRow icon={Activity} label={t.ipAssetDetail.status} value={asset.hasActiveDispute ? t.ipAssetDetail.disputeActive : t.ipAssetDetail.active} valueColor={asset.hasActiveDispute ? '#f59e0b' : '#22c55e'} />
              {asset.metadataURI && (
                <MetaRow icon={ExternalLink} label={t.common.metadataUri} value={asset.metadataURI.length > 50 ? `${asset.metadataURI.slice(0, 50)}…` : asset.metadataURI} />
              )}

              {/* Licenses */}
              {licenses.length > 0 && (
                <div className="mt-5">
                  <p className="text-[10px] uppercase tracking-wider font-semibold mb-3" style={{ color: colors.text.muted }}>
                    {t.common.licenses} ({licenses.length})
                  </p>
                  <div className="space-y-3">
                    {licenses.map((lic) => {
                      const now = BigInt(Math.floor(nowMs / 1000))
                      const daysLeft = lic.expiryTime === 0n ? null : Number(lic.expiryTime - now) / 86400
                      const payDays = lic.paymentInterval > 0n ? Number(lic.paymentInterval) / 86400 : null

                      return (
                        <div key={lic.licenseId.toString()} className="rounded-sm overflow-hidden" style={{ border: `1px solid ${colors.border.primary}` }}>
                          {/* License header */}
                          <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: colors.background.secondary }}>
                            <div className="flex items-center gap-2">
                              <Key className="w-4 h-4" style={{ color: colors.accent.goldText }} />
                              <div>
                                <p className="text-xs font-semibold" style={{ color: colors.text.primary }}>{lic.title || `${t.modals.license} #${lic.licenseId.toString()}`}</p>
                                <p className="text-[10px]" style={{ color: colors.text.muted }}>ID #{lic.licenseId.toString()}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: lic.isExclusive ? 'rgba(139,92,246,0.15)' : colors.background.tertiary, color: lic.isExclusive ? '#8b5cf6' : colors.text.muted }}>
                                {lic.isExclusive ? t.common.exclusive : t.common.nonExclusive}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: lic.isActive ? 'rgba(34,197,94,0.15)' : lic.isRevoked ? 'rgba(239,68,68,0.15)' : 'rgba(156,163,175,0.15)', color: lic.isActive ? '#22c55e' : lic.isRevoked ? '#ef4444' : colors.text.muted }}>
                                {lic.isActive ? t.common.active : lic.isRevoked ? t.common.revoked : t.common.expired}
                              </span>
                            </div>
                          </div>

                          {/* License details grid */}
                          <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2" style={{ backgroundColor: colors.background.primary }}>
                            <div>
                              <p className="text-[10px]" style={{ color: colors.text.muted }}>{t.common.supply}</p>
                              <p className="text-xs font-medium" style={{ color: colors.text.primary }}>{lic.supply.toString()} {t.common.tokens}</p>
                            </div>
                            <div>
                              <p className="text-[10px]" style={{ color: colors.text.muted }}>{t.common.balance}</p>
                              <p className="text-xs font-medium" style={{ color: colors.text.primary }}>{lic.balance.toString()} / {lic.supply.toString()}</p>
                            </div>
                            <div>
                              <p className="text-[10px]" style={{ color: colors.text.muted }}>{t.common.expiry}</p>
                              <p className="text-xs font-medium" style={{ color: lic.expiryTime !== 0n && lic.expiryTime < now ? '#ef4444' : colors.text.primary }}>
                                {lic.expiryTime === 0n ? t.common.perpetual : daysLeft !== null && daysLeft > 0 ? `${Math.floor(daysLeft)}${t.common.daysLeft}` : `${t.common.expired} ${formatTimestamp(lic.expiryTime)}`}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px]" style={{ color: colors.text.muted }}>{t.common.payment}</p>
                              <p className="text-xs font-medium" style={{ color: colors.text.primary }}>
                                {lic.paymentInterval === 0n ? t.common.oneTime : payDays !== null ? (payDays >= 1 ? t.common.everyDays.replace('{n}', String(Math.floor(payDays))) : t.common.everyHours.replace('{n}', String(Math.floor(Number(lic.paymentInterval) / 3600)))) : '—'}
                              </p>
                            </div>
                            {lic.expiryTime !== 0n && (
                              <div className="col-span-2">
                                <p className="text-[10px]" style={{ color: colors.text.muted }}>{t.common.expiryDate}</p>
                                <p className="text-xs font-medium" style={{ color: colors.text.primary }}>{formatTimestamp(lic.expiryTime)}</p>
                              </div>
                            )}
                            {lic.terms && (
                              <div className="col-span-2 mt-1">
                                <p className="text-[10px] mb-1" style={{ color: colors.text.muted }}>{t.common.terms}</p>
                                <p className="text-xs leading-relaxed p-2 rounded-sm" style={{ color: colors.text.secondary, backgroundColor: colors.background.secondary }}>{lic.terms}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {licenses.length === 0 && (
                <div className="mt-5 py-6 text-center rounded-sm" style={{ border: `1px dashed ${colors.border.primary}` }}>
                  <Key className="w-6 h-6 mx-auto mb-2" style={{ color: colors.text.muted }} />
                  <p className="text-xs" style={{ color: colors.text.muted }}>{t.ipAssetDetail.noLicenses}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
