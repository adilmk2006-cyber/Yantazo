/* MINDVAULT service worker (generated at build time from build/sw-template.js).
   Every file of the build is precached on install, so the whole game —
   including the lazily loaded mystery screens — works offline after one
   visit. Pages are fetched network-first so a new release is picked up as
   soon as the player is online; other files are served cache-first. */
const CACHE = 'mindvault-__VERSION__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mindvault-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Built files are content-hashed, so a cached copy is valid whatever the
// request headers. Ignoring Vary matters: servers often send "Vary: Origin",
// and module scripts carry an Origin header that precache requests do not.
const MATCH = { ignoreVary: true };

function cacheCopy(req, res) {
  if (res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => cacheCopy(req, res))
        .catch(() => caches.match(req, MATCH).then((hit) => hit || caches.match('./index.html', MATCH))),
    );
    return;
  }
  event.respondWith(caches.match(req, MATCH).then((hit) => hit || fetch(req).then((res) => cacheCopy(req, res))));
});
