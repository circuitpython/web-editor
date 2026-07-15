const CACHE_VERSION = "circuitpython-web-editor-v1";
const APP_SHELL = [
    "/",
    "/index.html",
    "/manifest.webmanifest",
    "/assets/index.css",
    "/assets/checkmark.svg",
    "/assets/js/device.js",
    "/assets/js/index.js",
    "/assets/fonts/fa-brands-400.woff2",
    "/assets/fonts/fa-regular-400.woff2",
    "/assets/fonts/fa-solid-900.woff2",
    "/assets/fonts/fa-v4compatibility.woff2",
    "/assets/images/favicon.ico",
    "/assets/images/loading-blinka.gif",
    "/assets/images/loading-blinka.webp",
    "/assets/images/logo.png",
    "/assets/images/logo@2x.png",
    "/assets/images/logo@3x.png",
    "/assets/images/pwa-icon-180.png",
    "/assets/images/pwa-icon-192.png",
    "/assets/images/pwa-icon-512.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys
                .filter((key) => key !== CACHE_VERSION)
                .map((key) => caches.delete(key)),
        )),
    );
});

async function networkFirst(request) {
    const cache = await caches.open(CACHE_VERSION);
    try {
        const response = await fetch(request);
        cache.put(request, response.clone());
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }
        throw error;
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    if (cached) {
        return cached;
    }

    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
}

self.addEventListener("fetch", (event) => {
    const requestUrl = new URL(event.request.url);
    if (event.request.method !== "GET" || requestUrl.origin !== self.location.origin) {
        return;
    }

    if (event.request.mode === "navigate") {
        event.respondWith(networkFirst(event.request));
        return;
    }

    event.respondWith(cacheFirst(event.request));
});
