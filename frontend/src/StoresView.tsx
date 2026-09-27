import { Loaded } from './Loaded.tsx'
import { StoreTable, storeHeadingId } from './StoreTable.tsx'
import type { Country, Store } from './types.ts'
import { useLoad } from './useLoad.ts'

function jumpToStore(storeId: number) {
  document.getElementById(storeHeadingId(storeId))?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
}

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
        return (
          <>
            <div className="store-jump">
              {withItems.map((store) => (
                <button
                  key={store.id}
                  type="button"
                  className="nav-link"
                  onClick={() => jumpToStore(store.id)}
                >
                  {store.name}
                </button>
              ))}
            </div>
            <div className="stores-row">
              {withItems.map((store) => (
                <StoreTable key={store.id} store={store} country={country} />
              ))}
            </div>
          </>
        )
      }}
    </Loaded>
  )
}
