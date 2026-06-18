/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `4stem-cache-${version}`;

// The app shell: SvelteKit's built JS/CSS plus everything in `static/`
// (manifest, icons, favicon). Song media is cached at runtime instead, on
// first play, so the precache stays small.
const SHELL_ASSETS = [...build, ...files];

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => sw.skipWaiting())
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) {
          await caches.delete(key);
        }
      }
      await sw.clients.claim();
    })()
  );
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== sw.location.origin) {
    return;
  }

  event.respondWith(respond(request, url));
});

async function respond(request: Request, url: URL): Promise<Response> {
  const cache = await caches.open(CACHE);

  // Precached shell assets: cache-first (they are content-hashed/immutable).
  if (SHELL_ASSETS.includes(url.pathname)) {
    const cached = await cache.match(url.pathname);
    if (cached) {
      return cached;
    }
  }

  // Song stems, peaks, and metadata: cache-first so a song that has been
  // played once is available offline, while new songs are fetched and stored.
  if (url.pathname.startsWith('/songs/')) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }

  // Everything else (navigations, etc.): network-first, fall back to cache
  // when offline.
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}
