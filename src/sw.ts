/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope

// Android share sheet -> POST /share-target (see share_target in vite.config.ts).
// Store the shared items in a cache and redirect into the app, which uploads them.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'POST' || url.pathname !== '/share-target') return

  event.respondWith(
    (async () => {
      const form = await event.request.formData()
      await caches.delete('share-target')
      const cache = await caches.open('share-target')

      const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
      const meta = {
        title: String(form.get('title') ?? ''),
        text: String(form.get('text') ?? ''),
        url: String(form.get('url') ?? ''),
        files: files.map((f, i) => ({ key: `/shared/${i}`, name: f.name, type: f.type })),
      }
      await Promise.all(
        files.map((f, i) =>
          cache.put(`/shared/${i}`, new Response(f, { headers: { 'content-type': f.type } })),
        ),
      )
      await cache.put(
        '/shared/meta',
        new Response(JSON.stringify(meta), { headers: { 'content-type': 'application/json' } }),
      )
      return Response.redirect('/?shared=1', 303)
    })(),
  )
})

self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))
