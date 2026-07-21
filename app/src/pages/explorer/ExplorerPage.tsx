import { useTheme } from '@/hooks/useTheme'
import { usePreloadedData } from '@/contexts/data-preloader-context'
import { useSearchContext } from '@/contexts/search-context'
import { ExplorerSection } from '@/pages/dashboard/sections/ExplorerSection'

export default function ExplorerPage() {
  const { colors } = useTheme()
  const { searchTerm } = useSearchContext()
  const {
    address,
    allListings,
    transactions,
    isLoadingTx,
  } = usePreloadedData()

  return (
    <ExplorerSection
      colors={colors}
      listings={allListings}
      address={address}
      searchTerm={searchTerm}
      transactions={transactions}
      isLoadingTx={isLoadingTx}
    />
  )
}
