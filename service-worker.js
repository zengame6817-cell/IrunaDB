"use strict";
const CACHE_NAME = "irunadb-v2-25-1";
const APP_SHELL = [
  "./", "./index.html", "./css/style.css", "./js/config.js", "./js/utils.js",
  "./js/api.js", "./js/ui.js", "./js/modal.js", "./js/app.js", "./js/theme.js",
  "./data/skills.js"
];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))); self.skipWaiting(); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))); self.clients.claim(); });
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // 公開DBは更新を最優先し、Service Workerへ固定保存しません。
  if (url.pathname.endsWith("/data/db.json")) { event.respondWith(fetch(event.request, { cache: "no-store" })); return; }
  event.respondWith(fetch(event.request).then(response => { const copy=response.clone(); caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)); return response; }).catch(()=>caches.match(event.request).then(hit=>hit||caches.match("./index.html"))));
});
