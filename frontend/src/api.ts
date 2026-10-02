import type { ReceiptResult } from './types.ts'

// Sends the receipt image as the raw request body, the server reads it with the local model (this is slow).
export async function uploadReceipt(file: File): Promise<ReceiptResult> {
  const response = await fetch('/api/receipt', { method: 'POST', headers: { 'Content-Type': file.type }, body: file })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: unknown } | null
    throw new Error(typeof body?.detail === 'string' ? body.detail : `The server answered ${response.status}`)
  }
  return (await response.json()) as ReceiptResult
}

export async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`The server answered ${response.status}`)
  }
  return (await response.json()) as T
}
