// ============================================
// Service worker Копійки: офлайн-режим.
// Стратегія: спочатку віддаємо з кешу (швидко і без інтернету),
// а у фоні завантажуємо свіжу версію файлу на наступний раз.
// ============================================

// Коли змінюєш файли застосунку — збільш версію, і старий кеш видалиться
const CACHE_VERSION = "kopiyka-v1.1.1";

// Усі файли застосунку (шляхи відносні, бо сайт живе в /kopiyka/)
const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

// Встановлення: кладемо всі файли в кеш.
// cache: "reload" — беремо файли прямо з сервера, а не з кешу браузера
// (GitHub Pages просить браузер тримати файли 10 хвилин, і без цього нова версія
// могла б "встановитись" зі старими файлами).
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(APP_FILES.map((url) => new Request(url, { cache: "reload" }))))
  );
  self.skipWaiting(); // нова версія вмикається одразу
});

// Активація: видаляємо кеші старих версій
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Кожен запит: спершу кеш, у фоні — оновлення з мережі
self.addEventListener("fetch", (event) => {
  const request = event.request;
  // Чіпаємо тільки звичайні GET-запити до нашого ж сайту
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  // Свіжа версія з мережі (якщо інтернету немає — просто null).
  // cache: "no-cache" — браузер щоразу перепитує сервер, чи файл не змінився.
  const fromNetwork = fetch(request, { cache: "no-cache" })
    .then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(() => null);

  // Даємо фоновому оновленню завершитись
  event.waitUntil(fromNetwork);

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fromNetwork.then((response) => {
        if (response) return response;
        // Немає ні кешу, ні інтернету: для сторінок віддаємо головну
        if (request.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      });
    })
  );
});
