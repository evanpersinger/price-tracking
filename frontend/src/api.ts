export async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`The server answered ${response.status}`)
  }
  return (await response.json()) as T
}
