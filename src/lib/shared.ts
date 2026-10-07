// Picks up items shared into the app from the Android share sheet.
// src/sw.ts saves them in this cache, then redirects to /?shared=1.

const CACHE = 'share-target'

type SharedMeta = {
  title?: string
  text?: string
  url?: string
  files: { key: string; name: string; type: string }[]
}

export type SharedItems = { text: string; files: File[] }

export function hasPendingShare(): boolean {
  return new URLSearchParams(location.search).has('shared')
}

export async function takeSharedItems(): Promise<SharedItems | null> {
  if (!('caches' in window)) return null
  const cache = await caches.open(CACHE)
  const metaRes = await cache.match('/shared/meta')
  if (!metaRes) return null
  const meta = (await metaRes.json()) as SharedMeta

  const files: File[] = []
  for (const f of meta.files) {
    const res = await cache.match(f.key)
    if (res) files.push(new File([await res.blob()], f.name, { type: f.type }))
  }

  // Android often puts the link in `text` and repeats it in `url`; don't duplicate.
  const parts = [meta.title, meta.text, meta.url].filter((p): p is string => Boolean(p?.trim()))
  const text = parts.filter((p, i) => !parts.slice(0, i).some((q) => q.includes(p))).join('\n')

  await caches.delete(CACHE)
  return { text, files }
}

export function clearShareFlag(): void {
  const url = new URL(location.href)
  url.searchParams.delete('shared')
  history.replaceState(null, '', url.pathname + url.search + url.hash)
}
