const CACHE = "ultravet-v5";
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

// ─── Web Push ────────────────────────────────────────────────────────────────
// Edge Function шле payload виду:
//   { title, body, url?, tag? }
// Якщо payload не JSON — показуємо як простий текст.

self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { title: "UltraVet", body: e.data ? e.data.text() : "" };
  }

  const title = data.title || "UltraVet";
  const options = {
    body: data.body || "",
    // iOS Safari не показує SVG в нотифікаціях — лише PNG.
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    lang: "uk",
    // tag групує сповіщення (нова відповідь у тому ж треді замінює попередню);
    // renotify — щоб повторна нотифікація з тим самим tag усе одно сповістила.
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    requireInteraction: true,
    data: { url: data.url || "/alerts" },
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "/alerts";

  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Якщо застосунок уже відкрито — фокусуємо й переходимо.
        for (const client of clients) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) client.navigate(target);
            return;
          }
        }
        // Інакше відкриваємо нове вікно.
        if (self.clients.openWindow) return self.clients.openWindow(target);
      })
  );
});
