import { useState, useCallback, useEffect, Suspense } from 'react'
import { Routes, Route, Navigate, useSearchParams, useParams } from 'react-router-dom'
import { useTheme } from '@/hooks/useTheme'
import { useI18nStore, useTranslations } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ToastContainer } from '@/components/Toast'
import { CookieConsent } from '@/components/CookieConsent'
import { DataPreloaderProvider } from '@/contexts/DataPreloader'
import { ResilienceProvider } from '@/contexts/ResilienceProvider'
import { PapiProvider } from '@/contexts/PapiProvider'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { toastSuccess, toastError } from '@/hooks/useToast'
import { lazyWithReload } from '@/lib/lazy-with-reload'
import type { BlackholeIntroProps } from '@/components/BlackholeIntro'

const BlackholeIntro = lazyWithReload<BlackholeIntroProps>('blackhole-intro', () =>
  import('@/components/BlackholeIntro').then(m => ({ default: m.BlackholeIntro }))
)

const ExplorerPage = lazyWithReload('explorer', () => import('@/pages/explorer/ExplorerPage'))
const ListingDetailPage = lazyWithReload('listing-detail', () => import('@/pages/explorer/ListingDetailPage'))
const StudioPage = lazyWithReload('studio', () => import('@/pages/studio/StudioPage'))
const AssetDetailPage = lazyWithReload('asset-detail', () => import('@/pages/studio/AssetDetailPage'))
const LicensesPage = lazyWithReload('licenses', () => import('@/pages/licenses/LicensesPage'))
const LicenseDetailPage = lazyWithReload('license-detail', () => import('@/pages/licenses/LicenseDetailPage'))
const JudicialPage = lazyWithReload('judicial', () => import('@/pages/judicial/JudicialPage'))
const DisputeDetailPage = lazyWithReload('dispute-detail', () => import('@/pages/judicial/DisputeDetailPage'))
const StudioLandingPage = lazyWithReload('studio-landing', () => import('@/pages/studio/StudioLandingPage'))
const NotFoundPage = lazyWithReload('not-found', () => import('@/pages/NotFoundPage'))
const PrivacyPage = lazyWithReload('privacy', () => import('@/pages/legal/PrivacyPage'))
const TermsPage = lazyWithReload('terms', () => import('@/pages/legal/TermsPage'))

function JudicialBaseRedirect() {
  const [searchParams] = useSearchParams()
  const qs = searchParams.toString()
  return <Navigate to={`/judicial${qs ? `?${qs}` : ''}`} replace />
}

function DisputeDetailRedirect() {
  const { disputeId } = useParams<{ disputeId: string }>()
  const [searchParams] = useSearchParams()
  const qs = searchParams.toString()
  return <Navigate to={`/judicial/${disputeId}${qs ? `?${qs}` : ''}`} replace />
}

function AssetDetailRedirect() {
  const { tokenId } = useParams<{ tokenId: string }>()
  const [searchParams] = useSearchParams()
  const nextParams = new URLSearchParams(searchParams)
  if (!nextParams.has('from')) nextParams.set('from', 'studio')
  const qs = nextParams.toString()
  return <Navigate to={`/assets/${encodeURIComponent(tokenId ?? '')}${qs ? `?${qs}` : ''}`} replace />
}

function PaymentResultHandler() {
  const [params, setParams] = useSearchParams()
  const { t } = useTranslations()
  useEffect(() => {
    const payment = params.get('payment')
    const ref = params.get('ref')
    if (payment === 'success') {
      toastSuccess(ref ? t.checkout.paymentConfirmedRef.replace('{ref}', ref) : t.checkout.paymentConfirmed)
      params.delete('payment'); params.delete('ref'); params.delete('session_id')
      setParams(params, { replace: true })
    } else if (payment === 'cancelled') {
      toastError(t.checkout.paymentCancelled)
      params.delete('payment')
      setParams(params, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function App() {
  useTheme()
  const { detectLanguage } = useI18nStore()
  const { isReady } = useAuth()

  const [showIntro, setShowIntro] = useState(() => {
    try { if (sessionStorage.getItem('sl_intro')) return false } catch {}
    const p = window.location.pathname
    return p !== '/explorer' && p !== '/'
  })

  useEffect(() => {
    detectLanguage()
  }, [detectLanguage])

  const handleIntroComplete = useCallback(() => {
    setShowIntro(false)
    try { sessionStorage.setItem('sl_intro', '1') } catch {}
  }, [])

  return (
    <PapiProvider>
      <ResilienceProvider>
        <DataPreloaderProvider>
        <div className="min-h-screen">
          <PaymentResultHandler />
          {showIntro && (
            <Suspense fallback={null}>
              <BlackholeIntro onComplete={handleIntroComplete} isReady={isReady} />
            </Suspense>
          )}

          <ErrorBoundary>
            <Suspense fallback={null}>
              <Routes>
                {/* Legal pages — outside the dashboard shell so they are
                    reachable without a connected wallet and without the
                    dashboard chrome. They render their own document frame. */}
                <Route path="privacy" element={<PrivacyPage />} />
                <Route path="terms" element={<TermsPage />} />

                <Route element={<DashboardLayout />}>
                  <Route index element={<StudioLandingPage />} />
                  <Route path="explorer" element={<ExplorerPage />} />
                  <Route path="explorer/listing/:listingId" element={<ListingDetailPage />} />
                  <Route path="studio/:tokenId" element={<AssetDetailRedirect />} />
                  <Route path="studio" element={<StudioPage />} />
                  <Route path="assets/:tokenId" element={<AssetDetailPage />} />
                  <Route path="licenses" element={<LicensesPage />} />
                  <Route path="licenses/:licenseId" element={<LicenseDetailPage />} />
                  <Route path="held" element={<Navigate to="/licenses?view=held" replace />} />
                  <Route path="judicial" element={<JudicialPage />} />
                  <Route path="judicial/:disputeId" element={<DisputeDetailPage />} />
                  <Route path="disputes" element={<JudicialBaseRedirect />} />
                  <Route path="disputes/:disputeId" element={<DisputeDetailRedirect />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </Suspense>
          </ErrorBoundary>
          <ToastContainer />
          <CookieConsent />
        </div>
      </DataPreloaderProvider>
      </ResilienceProvider>
    </PapiProvider>
  )
}
