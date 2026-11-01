// Service worker: makes the whole book work offline.
// Template: astro.config.mjs fills in VERSION and FILES after each build and writes
// the result to sw.js at the site root. VERSION is a hash of every file, so any
// change to the site produces a new sw.js, which the browser sees as an update.
//
// Update flow: the new worker downloads the whole book into a fresh cache in the
// background (atomically: if one file fails, the old version stays), then takes
// over at once. The page already on screen is untouched; the next page turn
// shows the new version.

const VERSION = "__VERSION__";
const FILES = __FILES__;

// Each book has its own worker and cache. Prefixes must not overlap, since a worker
// deletes every other cache with its prefix.
const PREFIX = "__PREFIX__";
const CACHE = PREFIX + VERSION;
const HOME = new URL("./", self.location).href;
// the site root: a book under it also loads the shared /_astro and /assets files
const ROOT = new URL("__ROOT__", self.location).href;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // "reload" skips the HTTP cache, so we never store a stale copy
    await cache.addAll(FILES.map((f) => new Request(new URL(f, self.location), { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const old = (await caches.keys()).filter((k) => k.startsWith(PREFIX) && k !== CACHE);
    await Promise.all(old.map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || !req.url.startsWith(ROOT)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;

    if (req.mode === "navigate") {
      // "/lezione-1/00-copertina" is stored as "/lezione-1/00-copertina/"
      const url = new URL(req.url);
      if (!url.pathname.endsWith("/")) {
        const page = await cache.match(url.origin + url.pathname + "/");
        if (page) return page;
      }
    }

    try {
      return await fetch(req);
    } catch (err) {
      // Offline and not in the book (e.g. a mistyped address): show the cover
      if (req.mode === "navigate") return (await cache.match(HOME)) ?? Response.error();
      throw err;
    }
  })());
});
