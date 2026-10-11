import { useState } from 'react'
import { Arrow } from './Arrow.tsx'
import { isFuelItem } from './fuel.ts'
import { GasTable } from './GasTable.tsx'
import { Loaded } from './Loaded.tsx'
import type { Country, Store } from './types.ts'
import { useLoad } from './useLoad.ts'

interface GasViewProps {
  country: Country
}

// The gas stations of a country, one at a time like the store prices page, each with the fill-ups saved from gas receipts
export function GasView({ country }: GasViewProps) {
  const state = useLoad<Store[]>(`/api/stores?country=${country}`)
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <Loaded state={state}>
      {(stores) => {
        const stations = stores
          .map((store) => ({ ...store, items: store.items.filter(isFuelItem) }))
          .filter((store) => store.items.length > 0)
        if (stations.length === 0) {
          return <p className="status">No gas prices added yet.</p>
        }
        const activeIndexInRange = Math.min(activeIndex, stations.length - 1)
        const activeStation = stations[activeIndexInRange]
        return (
          <>
            <div className="store-jump">
              {stations.map((store, index) => (
                <button
                  key={store.id}
                  type="button"
                  className="nav-link"
                  aria-current={index === activeIndexInRange ? 'true' : undefined}
                  onClick={() => setActiveIndex(index)}
                >
                  {store.name}
                </button>
              ))}
            </div>
            <div className="store-viewport">
              <GasTable key={activeStation.id} store={activeStation} country={country} />
              <div className="store-nav">
                {activeIndexInRange < stations.length - 1 && (
                  <button
                    type="button"
                    className="store-nav-button"
                    aria-label="Next station"
                    onClick={() => setActiveIndex(activeIndexInRange + 1)}
                  >
                    <Arrow direction="right" />
                  </button>
                )}
                {activeIndexInRange > 0 && (
                  <button
                    type="button"
                    className="store-nav-button"
                    aria-label="Previous station"
                    onClick={() => setActiveIndex(activeIndexInRange - 1)}
                  >
                    <Arrow direction="left" />
                  </button>
                )}
              </div>
            </div>
          </>
        )
      }}
    </Loaded>
  )
}
