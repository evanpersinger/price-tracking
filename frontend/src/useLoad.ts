import { useEffect, useState } from 'react'
import { fetchJson } from './api.ts'

export type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T }

export function useLoad<T>(url: string): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    fetchJson<T>(url, controller.signal)
      .then((data) => setState({ status: 'ready', data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Something went wrong' })
      })
    return () => controller.abort()
  }, [url])

  return state
}
