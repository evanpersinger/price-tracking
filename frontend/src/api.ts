import type { NewItem, ReceiptResult } from './types.ts'

// The server's own message when it sent one (the receipt and item endpoints do), otherwise just the status
async function failure(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { detail?: unknown } | null
  return new Error(typeof body?.detail === 'string' ? body.detail : `The server answered ${response.status}`)
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
