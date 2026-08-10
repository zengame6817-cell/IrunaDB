"use strict";
const CACHE_NAME = "irunadb-v2-9-9";
const APP_SHELL = [
  "./", "./index.html", "./css/style.css",
  "./js/config.js", "./js/utils.js", "./js/api.js",
  "./js/ui.js", "./js/modal.js", "./js/app.js", "./js/theme.js",
  "./data/skills.js", "./data/skill-quests.js", "./js/skill-quests.js", "./js/missions.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // 公開DBは常に最新版。
  if (url.pathname.endsWith("/data/db.json")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }

  // HTML/JS/CSS/skills.js はブラウザHTTPキャッシュを使わず最新版優先。
  const isAppAsset =
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css");

  if (isAppAsset) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() =>
          caches.match(event.request, { ignoreSearch: true })
            .then(hit => hit || caches.match("./index.html"))
        )
    );
    return;
  }

  event.respondWith(fetch(event.request));
});
