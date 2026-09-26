import type { ReactNode } from 'react'
import type { LoadState } from './useLoad.ts'

interface LoadedProps<T> {
  state: LoadState<T>
  children: (data: T) => ReactNode
}

// Shows the loading and error states, and hands the data to its child once it has arrived
export function Loaded<T>({ state, children }: LoadedProps<T>) {
  if (state.status === 'loading') {
    return <p className="status" role="status">Loading prices</p>
  }

  if (state.status === 'error') {
    return (
      <div className="status" role="alert">
        <p>Could not load prices. Make sure the backend is running, then try again.</p>
        <button type="button" className="retry" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    )
  }

  return <>{children(state.data)}</>
}
