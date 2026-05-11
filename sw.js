const NETWORK_TIMEOUT_MS = 5000;
const PRECACHE_CACHE_NAME = "yt-transcripciones-precache-v1";
const RUNTIME_CACHE_NAME = "yt-transcripciones-runtime-v1";

const PRECACHE_URLS = [
    "/",
    "/index.html",
    "/css/estilos.css",
    "/js/app.js",
    "/js/funciones/dom.js",
    "/js/funciones/state.js",
    "/js/funciones/youtube.js",
    "/js/funciones/api-client.js",
    "/js/funciones/processing.js",
    "/js/funciones/ui-actions.js",
    "/js/funciones/settings.js",
    "/js/funciones/history.js",
    "/js/funciones/cloud-sync.js",
    "/js/funciones/ai-processing.js",
    "/js/funciones/sw-manager.js",
    "/manifest.webmanifest",
    "/version.json",
    "/icons/icon-192.svg",
    "/icons/icon-512.svg",
    "/icons/apple-touch-icon.svg"
];

self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(PRECACHE_CACHE_NAME);
        await Promise.allSettled(
            PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: "reload" })))
        );
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const cacheKeys = await caches.keys();
        const oldKeys = cacheKeys.filter((key) => (
            key.startsWith("yt-transcripciones-") &&
            key !== PRECACHE_CACHE_NAME &&
            key !== RUNTIME_CACHE_NAME
        ));

        await Promise.all(oldKeys.map((key) => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener("message", (event) => {
    if (!event.data || typeof event.data !== "object") {
        return;
    }

    if (event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

function requestHasSensitiveHeaders(request) {
    return request.headers.has("authorization") || request.headers.has("x-api-key");
}

function shouldCacheResponse(request, response) {
    if (!response) {
        return false;
    }

    if (requestHasSensitiveHeaders(request)) {
        return false;
    }

    const requestUrl = new URL(request.url);
    if (requestUrl.pathname === "/api/version" || requestUrl.pathname === "/version.json") {
        return false;
    }

    return response.status === 200 || response.type === "opaque";
}

async function fetchWithTimeout(request, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(request, {
            signal: controller.signal,
            cache: "no-store"
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

function buildOfflineFallbackResponse(request) {
    if (request.mode === "navigate") {
        return new Response(
            "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><title>Sin conexion</title></head><body><h1>Sin conexion</h1><p>No hay red disponible y este recurso no esta en cache.</p></body></html>",
            {
                status: 503,
                headers: {
                    "Content-Type": "text/html; charset=utf-8"
                }
            }
        );
    }

    if (request.destination === "style") {
        return new Response("/* offline */", {
            status: 503,
            headers: {
                "Content-Type": "text/css"
            }
        });
    }

    if (request.destination === "script") {
        return new Response("// offline", {
            status: 503,
            headers: {
                "Content-Type": "application/javascript"
            }
        });
    }

    return new Response(JSON.stringify({ error: "offline" }), {
        status: 503,
        headers: {
            "Content-Type": "application/json"
        }
    });
}

async function networkFirst(request) {
    const runtimeCache = await caches.open(RUNTIME_CACHE_NAME);

    try {
        const networkResponse = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
        if (shouldCacheResponse(request, networkResponse)) {
            runtimeCache.put(request, networkResponse.clone()).catch(() => {
                // No-op: un fallo de cache no debe bloquear respuesta de red.
            });
        }
        return networkResponse;
    } catch (error) {
        const runtimeMatch = await runtimeCache.match(request);
        if (runtimeMatch) {
            return runtimeMatch;
        }

        const precacheMatch = await caches.match(request);
        if (precacheMatch) {
            return precacheMatch;
        }

        if (request.mode === "navigate") {
            const indexFallback = await caches.match("/index.html");
            if (indexFallback) {
                return indexFallback;
            }
        }

        return buildOfflineFallbackResponse(request);
    }
}

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") {
        return;
    }

    const requestUrl = new URL(request.url);
    if (requestUrl.protocol !== "http:" && requestUrl.protocol !== "https:") {
        return;
    }

    event.respondWith(networkFirst(request));
});
