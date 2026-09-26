import { Loaded } from './Loaded.tsx'
import { StoreTable } from './StoreTable.tsx'
import type { Country, Store } from './types.ts'
import { useLoad } from './useLoad.ts'

interface StoresViewProps {
  country: Country
}

export function StoresView({ country }: StoresViewProps) {
  const state = useLoad<Store[]>(`/api/stores?country=${country}`)

  return (
    <Loaded state={state}>
      {(stores) => {
        const withItems = stores.filter((store) => store.items.length > 0)
        if (withItems.length === 0) {
          return <p className="status">No prices added yet.</p>
        }
        return withItems.map((store) => <StoreTable key={store.id} store={store} country={country} />)
      }}
    </Loaded>
  )
}
