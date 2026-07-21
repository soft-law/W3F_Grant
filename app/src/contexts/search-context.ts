import { createContext, useContext } from 'react'

interface SearchContextValue {
  searchTerm: string
}

export const SearchContext = createContext<SearchContextValue>({ searchTerm: '' })

export function useSearchContext(): SearchContextValue {
  return useContext(SearchContext)
}
