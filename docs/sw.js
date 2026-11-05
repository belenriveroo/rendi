// RENDÍ · modo app. Siempre pide lo último a la red; la copia guardada solo se usa sin conexión.
const CACHE = "rendi-v2";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then((res) => {
    const copia = res.clone();
    caches.open(CACHE).then((c) => c.put(r, copia));
    return res;
  }).catch(() => caches.match(r)));
});
