/* Mavi’nin Matematik Macerası — service worker
 *
 * Güncelleme yaparken: CACHE_VERSION değerini artır (ör. v2 → v3).
 * Eski sürümlerin önbellekleri "activate" adımında otomatik silinir.
 *
 * Strateji:
 *  - Kod dosyaları (HTML, CSS, JS, manifest): önce ağ, ağ yoksa önbellek.
 *    Geliştirme sırasında eski dosyaya takılma (stale cache) sorununu azaltır.
 *  - Görseller: önce önbellek (büyük ve nadiren değişen dosyalar).
 */
const CACHE_VERSION = "v1";
const CACHE_NAME = `mavi-matematik-${CACHE_VERSION}`;
const NETWORK_TIMEOUT_MS = 4000;

// Oyunun açılması için şart olan dosyalar: biri eksikse kurulum başarısız sayılır.
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=pwa-1",
  "./level-data.js?v=pwa-1",
  "./game.js?v=pwa-1",
  "./pwa.js?v=pwa-1",
  "./manifest.webmanifest"
];

// Görseller: biri inemese bile oyun yedek çizimlerle çalışır, kurulum durmaz.
const IMAGE_ASSETS = [
  "./assets/img/player.png",
  "./assets/img/player_spritesheet_clean.png",
  "./assets/img/enemy.png",
  "./assets/img/enemy_boss_clean.png",
  "./assets/img/enemy_boss_2_clean.png",
  "./assets/img/enemy_boss_3_clean.png",
  "./assets/img/enemy_boss_4_clean.png",
  "./assets/img/rockets.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon-180.png",
  "./assets/icons/favicon-32.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE_ASSETS.map((url) => new Request(url, { cache: "reload" })));
      await Promise.allSettled(IMAGE_ASSETS.map((url) => cache.add(new Request(url, { cache: "reload" }))));
      // Güncellemede yeni sürüm bekler; kullanıcı "Şimdi Güncelle" deyince devreye girer
      // (ilk kurulumda bekleyecek eski sürüm olmadığı için hemen etkinleşir).
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith("mavi-matematik-") && name !== CACHE_NAME).map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.destination === "image") {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached =
      (await cache.match(request)) ||
      (await cache.match(request, { ignoreSearch: true })) ||
      (request.mode === "navigate" ? await cache.match("./index.html") : undefined);
    if (cached) return cached;
    throw error;
  }
}

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(request).then(
      (response) => {
        clearTimeout(timer);
        resolve(response);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
