import { useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { usePreloadedData } from '@/contexts/data-preloader-context'
import { useSearchContext } from '@/contexts/search-context'
import { useInvalidateIndexedQueries } from '@/hooks/useIndexed'
import { StudioSection } from '@/pages/dashboard/sections/StudioSection'
import { CreateLicenseModal } from '@/pages/dashboard/modals/CreateLicenseModal'
import { CreateListingModal } from '@/pages/dashboard/modals/CreateListingModal'
import { ConfigureRevenueSplitModal } from '@/pages/dashboard/modals/ConfigureRevenueSplitModal'
import { UpdateMetadataModal } from '@/pages/dashboard/modals/UpdateMetadataModal'
import { CertificateModal } from '@/pages/dashboard/modals/CertificateModal'
import type { UserIPAsset } from '@/hooks/useContracts'

export default function StudioPage() {
  const { colors } = useTheme()
  const { searchTerm } = useSearchContext()
  const invalidateIndexed = useInvalidateIndexedQueries()
  const {
    address,
    assets,
    licenses,
    heldLicenses,
    allListings,
    disputes,
    offers,
    isLoadingOffers,
    isLoadingAssets,
    isLoadingLicenses,
    refetchAssets,
    refetchLicenses,
    refetchOffers,
    refreshListings,
    refetchListings: refetchUserListings,
    revenueBalance,
  } = usePreloadedData()

  const [showLicenseModal, setShowLicenseModal] = useState(false)
  const [licenseForAsset, setLicenseForAsset] = useState<string | undefined>()
  const [showListingModal, setShowListingModal] = useState(false)
  const [listingForAsset, setListingForAsset] = useState<string | undefined>()
  const [showRevenueSplitModal, setShowRevenueSplitModal] = useState<UserIPAsset | null>(null)
  const [showUpdateMetadataModal, setShowUpdateMetadataModal] = useState<UserIPAsset | null>(null)
  const [showCertificateModal, setShowCertificateModal] = useState<UserIPAsset | null>(null)

  return (
    <>
      <StudioSection
        colors={colors}
        assets={assets}
        pendingAssets={[]}
        licenses={licenses}
        heldLicenses={heldLicenses}
        allListings={allListings}
        disputes={disputes}
        offers={offers}
        isLoadingOffers={isLoadingOffers}
        isLoading={isLoadingAssets || isLoadingLicenses}
        onCreateLicense={(id) => { setLicenseForAsset(id); setShowLicenseModal(true) }}
        onCreateListing={(id) => { setListingForAsset(id); setShowListingModal(true) }}
        onConfigureRevenue={(asset) => setShowRevenueSplitModal(asset)}
        onUpdateMetadata={(asset) => setShowUpdateMetadataModal(asset)}
        onGenerateCertificate={(asset) => setShowCertificateModal(asset)}
        revenueBalance={revenueBalance}
        refetch={() => { refetchAssets(); refetchLicenses(); refetchOffers() }}
        searchTerm={searchTerm}
      />

      {showLicenseModal && address && (
        <CreateLicenseModal
          colors={colors}
          address={address}
          initialIpAssetId={licenseForAsset}
          onClose={() => { setShowLicenseModal(false); setLicenseForAsset(undefined) }}
          onSuccess={() => { refetchLicenses(); invalidateIndexed(); setShowLicenseModal(false); setLicenseForAsset(undefined) }}
        />
      )}
      {showListingModal && address && (
        <CreateListingModal
          colors={colors}
          address={address}
          initialAssetId={listingForAsset}
          onClose={() => { setShowListingModal(false); setListingForAsset(undefined) }}
          onSuccess={() => { refreshListings(); refetchUserListings(); invalidateIndexed(); setShowListingModal(false); setListingForAsset(undefined) }}
        />
      )}
      {showRevenueSplitModal && (
        <ConfigureRevenueSplitModal
          colors={colors}
          asset={showRevenueSplitModal}
          onClose={() => setShowRevenueSplitModal(null)}
          onSuccess={() => { refetchAssets(); invalidateIndexed(); setShowRevenueSplitModal(null) }}
        />
      )}
      {showUpdateMetadataModal && address && (
        <UpdateMetadataModal
          colors={colors}
          asset={showUpdateMetadataModal}
          address={address}
          onClose={() => setShowUpdateMetadataModal(null)}
          onSuccess={() => { refetchAssets(); invalidateIndexed(); setShowUpdateMetadataModal(null) }}
        />
      )}
      {showCertificateModal && (
        <CertificateModal
          colors={colors}
          asset={showCertificateModal}
          ownerAddress={address}
          licenses={licenses.filter(l => l.ipAssetId === showCertificateModal.tokenId)}
          onClose={() => setShowCertificateModal(null)}
        />
      )}
    </>
  )
}
