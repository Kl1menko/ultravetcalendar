const CACHE = "ultravet-v3";
const STATIC = [
  "/manifest.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") {
    return;
  }

  // Supabase API — тільки мережа, не кешуємо
  if (e.request.url.includes("supabase.co")) {
    return;
  }

  // HTML/app shell can contain auth-sensitive UI state; always ask the network.
  if (e.request.mode === "navigate") {
    return;
  }

  const url = new URL(e.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isStaticAsset =
    isSameOrigin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname === "/manifest.json");

  if (!isStaticAsset) {
    return;
  }

  // Static assets — network first, cache as offline fallback.
  e.respondWith(
    fetch(e.request).then((res) => {
      if (!res || res.status !== 200) return res;

      const clone = res.clone();
      caches.open(CACHE).then((cache) => cache.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
