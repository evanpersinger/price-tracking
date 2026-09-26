import { useEffect, useState } from 'react'
import { fetchStores } from './api.ts'
import type { Country, Store } from './types.ts'

export type StoresState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; stores: Store[] }

export function useStores(country: Country): StoresState {
  const [state, setState] = useState<StoresState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    fetchStores(country, controller.signal)
      .then((stores) => setState({ status: 'ready', stores }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Something went wrong' })
      })
    return () => controller.abort()
  }, [country])

  return state
}
