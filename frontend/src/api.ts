import type { NewItem, ReceiptResult } from './types.ts'

// A validation error's entries as one line: the field (the last part of its location, none for a rule on the whole
// body) and the reason, like "price_cents: Input should be less than or equal to 100000000"
function validationMessage(detail: unknown[]): string | null {
  const messages = detail.flatMap((entry) => {
    const { loc, msg } = (entry ?? {}) as { loc?: unknown; msg?: unknown }
    if (typeof msg !== 'string') return []
    const field = Array.isArray(loc) ? loc[loc.length - 1] : undefined
    return [typeof field === 'string' && field !== 'body' ? `${field}: ${msg}` : msg]
  })
  return messages.length > 0 ? messages.join(', ') : null
}

// The server's own message when it sent one (the receipt and item endpoints do, and validation errors send a list),
// otherwise just the status
async function failure(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { detail?: unknown } | null
  const detail = body?.detail
  const message = typeof detail === 'string' ? detail : Array.isArray(detail) ? validationMessage(detail) : null
  return new Error(message ?? `The server answered ${response.status}`)
}

// Sends the receipt image as the raw request body, the server reads it with the local model (this is slow).
export async function uploadReceipt(file: File): Promise<ReceiptResult> {
  const response = await fetch('/api/receipt', { method: 'POST', headers: { 'Content-Type': file.type }, body: file })
  if (!response.ok) throw await failure(response)
  return (await response.json()) as ReceiptResult
}

export async function addItem(item: NewItem): Promise<void> {
  const response = await fetch('/api/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  })
  if (!response.ok) throw await failure(response)
}

export async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`The server answered ${response.status}`)
  }
  return (await response.json()) as T
}
