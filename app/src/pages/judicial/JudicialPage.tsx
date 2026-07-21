import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTheme } from '@/hooks/useTheme'
import { usePreloadedData } from '@/contexts/data-preloader-context'
import { useSearchContext } from '@/contexts/search-context'
import { useInvalidateIndexedQueries } from '@/hooks/useIndexed'
import { useHasRole, ARBITRATOR_ROLE } from '@/hooks/useContracts'
import { JudicialSection } from '@/pages/dashboard/sections/JudicialSection'
import { SubmitDisputeModal } from '@/pages/dashboard/modals/SubmitDisputeModal'

export default function JudicialPage() {
  const { colors } = useTheme()
  const { searchTerm } = useSearchContext()
  const invalidateIndexed = useInvalidateIndexedQueries()
  const {
    address,
    disputes,
    isLoadingDisputes,
  } = usePreloadedData()

  const { data: isArbitratorData } = useHasRole('GovernanceArbitrator', ARBITRATOR_ROLE, address)
  const isArbitrator = !!isArbitratorData

  const [searchParams, setSearchParams] = useSearchParams()
  const licenseIdParam = searchParams.get('licenseId')
  const initialLicenseId = licenseIdParam && /^\d+$/.test(licenseIdParam) ? BigInt(licenseIdParam) : undefined

  const [manuallyOpened, setManuallyOpened] = useState(false)
  const showDisputeModal = manuallyOpened || initialLicenseId !== undefined

  const clearLicenseParam = () => {
    if (!searchParams.has('licenseId')) return
    const next = new URLSearchParams(searchParams)
    next.delete('licenseId')
    setSearchParams(next, { replace: true })
  }

  const handleClose = () => {
    clearLicenseParam()
    setManuallyOpened(false)
  }

  const handleSuccess = () => {
    invalidateIndexed()
    clearLicenseParam()
    setManuallyOpened(false)
  }

  return (
    <>
      <JudicialSection
        colors={colors}
        disputes={disputes}
        isLoading={isLoadingDisputes}
        onSubmitDispute={() => setManuallyOpened(true)}
        isArbitrator={isArbitrator}
        searchTerm={searchTerm}
      />

      {showDisputeModal && (
        <SubmitDisputeModal
          colors={colors}
          onClose={handleClose}
          onSuccess={handleSuccess}
          initialLicenseId={initialLicenseId}
        />
      )}
    </>
  )
}
