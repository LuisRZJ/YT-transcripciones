import { refs, rerenderIcons } from "./dom.js";
import { STORAGE_KEYS, state } from "./state.js";
import { showToast } from "./ui-actions.js";

const VERSION_ENDPOINT = "/api/version";
const VERSION_FILE_ENDPOINT = "/version.json";
const VERSION_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const NETWORK_TIMEOUT_MS = 5000;
const RELOAD_GUARD_KEY = "app_last_forced_reload_at";
const RELOAD_GUARD_WINDOW_MS = 15000;

let swRegistration = null;
let versionCheckTimer = null;
let hasReloadedFromControllerChange = false;

function getStoredVersion() {
    return localStorage.getItem(STORAGE_KEYS.appVersion);
}

function setStoredVersion(version) {
    if (!version) {
        return;
    }
    localStorage.setItem(STORAGE_KEYS.appVersion, version);
    state.appUpdate.lastKnownVersion = version;
}

function markVersionCheckNow() {
    localStorage.setItem(STORAGE_KEYS.appLastVersionCheckAt, String(Date.now()));
}

function setCheckUpdatesButtonState(message, isLoading) {
    if (!refs.btnCheckUpdates || !refs.txtCheckUpdates) {
        return;
    }

    refs.btnCheckUpdates.disabled = isLoading;
    refs.txtCheckUpdates.textContent = message;

    const icon = refs.iconCheckUpdates;
    if (icon) {
        icon.classList.remove("animate-spin");
        icon.setAttribute("data-lucide", isLoading ? "loader-2" : "refresh-cw");
    }

    rerenderIcons();

    const renderedIcon = refs.iconCheckUpdates;
    if (renderedIcon) {
        renderedIcon.classList.remove("animate-spin");
        if (isLoading) {
            renderedIcon.classList.add("animate-spin");
        }
    }
}

function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
            "Cache-Control": "no-cache"
        }
    }).finally(() => {
        clearTimeout(timeoutId);
    });
}

function isLocalHostEnvironment() {
    return window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
}

function getVersionEndpoints() {
    if (isLocalHostEnvironment()) {
        return [VERSION_FILE_ENDPOINT];
    }
    return [VERSION_ENDPOINT, VERSION_FILE_ENDPOINT];
}

async function fetchRemoteVersion() {
    const endpoints = getVersionEndpoints();

    for (const endpoint of endpoints) {
        try {
            const response = await fetchWithTimeout(endpoint, NETWORK_TIMEOUT_MS);
            if (!response.ok) {
                continue;
            }

            const payload = await response.json();
            const version = payload && typeof payload.version === "string"
                ? payload.version.trim()
                : "";

            if (version) {
                return version;
            }
        } catch (error) {
            // Probar siguiente endpoint disponible.
        }
    }

    throw new Error("No se pudo resolver la version remota.");
}

function forceReload() {
    const now = Date.now();
    const lastReloadAt = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || "0");
    if (now - lastReloadAt < RELOAD_GUARD_WINDOW_MS) {
        return;
    }

    sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
    state.appUpdate.hasPendingReload = true;

    const url = new URL(window.location.href);
    url.searchParams.set("appv", String(Date.now()));
    window.location.replace(url.toString());
}

function skipWaitingIfPossible(worker) {
    if (!worker) {
        return false;
    }

    worker.postMessage({ type: "SKIP_WAITING" });
    return true;
}

function watchInstallingWorker(worker) {
    if (!worker) {
        return;
    }

    worker.addEventListener("statechange", () => {
        if (worker.state !== "installed") {
            return;
        }

        if (navigator.serviceWorker.controller) {
            skipWaitingIfPossible(worker);
        }
    });
}

function wireRegistrationLifecycle(registration) {
    registration.addEventListener("updatefound", () => {
        watchInstallingWorker(registration.installing);
    });

    if (registration.waiting) {
        skipWaitingIfPossible(registration.waiting);
    }
}

function wireControllerChange() {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (hasReloadedFromControllerChange) {
            return;
        }

        hasReloadedFromControllerChange = true;
        showToast("Actualizacion aplicada. Recargando...");
        forceReload();
    });
}

async function applyImmediateUpdate() {
    if (!swRegistration) {
        forceReload();
        return;
    }

    try {
        await swRegistration.update();
    } catch (error) {
        // Si update falla, intentamos recargar para obtener assets frescos por network-first.
    }

    if (swRegistration.waiting) {
        skipWaitingIfPossible(swRegistration.waiting);
        setTimeout(() => {
            if (!hasReloadedFromControllerChange) {
                forceReload();
            }
        }, 2500);
        return;
    }

    if (swRegistration.installing) {
        watchInstallingWorker(swRegistration.installing);
        setTimeout(() => {
            if (!hasReloadedFromControllerChange) {
                forceReload();
            }
        }, 3500);
        return;
    }

    forceReload();
}

export async function checkForAppUpdates({ triggeredByUser = false } = {}) {
    if (state.appUpdate.isChecking) {
        if (triggeredByUser) {
            showToast("Ya se esta comprobando actualizaciones...");
        }
        return false;
    }

    state.appUpdate.isChecking = true;
    if (triggeredByUser) {
        setCheckUpdatesButtonState("Buscando...", true);
    }

    try {
        const remoteVersion = await fetchRemoteVersion();
        markVersionCheckNow();

        const localVersion = getStoredVersion();
        if (!localVersion) {
            setStoredVersion(remoteVersion);
            if (triggeredByUser) {
                showToast("Version registrada. La app esta al dia.");
            }
            return false;
        }

        if (remoteVersion === localVersion) {
            if (triggeredByUser) {
                showToast("Ya tienes la version mas reciente.");
            }
            return false;
        }

        setStoredVersion(remoteVersion);
        showToast("Nueva version detectada. Actualizando...");

        await applyImmediateUpdate();
        return true;
    } catch (error) {
        if (triggeredByUser) {
            showToast("No se pudo comprobar actualizaciones en este momento.");
        }
        return false;
    } finally {
        state.appUpdate.isChecking = false;
        if (triggeredByUser) {
            setCheckUpdatesButtonState("Buscar actualizaciones", false);
        }
    }
}

function startVersionPolling() {
    if (versionCheckTimer) {
        clearInterval(versionCheckTimer);
    }

    versionCheckTimer = setInterval(() => {
        checkForAppUpdates({ triggeredByUser: false });
    }, VERSION_CHECK_INTERVAL_MS);
}

export async function initServiceWorkerManager() {
    if (!("serviceWorker" in navigator)) {
        return;
    }

    try {
        swRegistration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/"
        });

        wireRegistrationLifecycle(swRegistration);
        wireControllerChange();
        startVersionPolling();

        window.addEventListener("online", () => {
            checkForAppUpdates({ triggeredByUser: false });
        });

        await checkForAppUpdates({ triggeredByUser: false });
    } catch (error) {
        // No interrumpir UX si el registro SW falla.
    }
}
