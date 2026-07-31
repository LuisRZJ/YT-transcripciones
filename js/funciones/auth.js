import { STORAGE_KEYS, SESSION_DURATION_MS } from "./state.js";
import { refs, rerenderIcons } from "./dom.js";
import { showToast } from "./ui-actions.js";
import { scheduleHeaderOffsetSync } from "../app.js";

/**
 * Comprueba si existe una sesión válida que no haya superado los 7 días.
 * @returns {boolean}
 */
export function isSessionValid() {
    const secret = localStorage.getItem(STORAGE_KEYS.vercelSyncSecret);
    const expiryRaw = localStorage.getItem(STORAGE_KEYS.sessionExpiry);

    if (!secret || !expiryRaw) {
        return false;
    }

    const expiryTime = Number(expiryRaw);
    if (isNaN(expiryTime) || Date.now() >= expiryTime) {
        return false;
    }

    return true;
}

/**
 * Valida el Vercel Sync Secret contra el endpoint de la nube.
 * @param {string} secret 
 * @returns {Promise<boolean>}
 */
export async function verifyCloudSecret(secret) {
    const cleanSecret = String(secret ?? "").trim();
    if (!cleanSecret) {
        throw new Error("Por favor ingresa la contraseña.");
    }

    try {
        const res = await fetch("/api/pull", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${cleanSecret}`
            }
        });

        if (res.status === 401 || res.status === 403) {
            throw new Error("Contraseña incorrecta. Revisa tu Vercel Sync Secret.");
        }

        if (res.ok) {
            return true;
        }

        // Si responde 404 (ej. servidor de desarrollo local estático como python -m http.server)
        if (res.status === 404) {
            if (cleanSecret.length < 3) {
                throw new Error("La contraseña ingresada es demasiado corta.");
            }
            return true;
        }
    } catch (err) {
        if (err.message && err.message.includes("Contraseña")) {
            throw err;
        }
        // Si hay error de red estricto en local, se permite si tiene al menos 3 caracteres
        if (cleanSecret.length >= 3) {
            return true;
        }
        throw new Error("No se pudo conectar para verificar la contraseña. Intenta nuevamente.");
    }

    return true;
}

/**
 * Inicia sesión guardando el secret y la fecha de expiración a 7 días.
 * @param {string} secret 
 */
export async function loginWithSecret(secret) {
    const cleanSecret = String(secret ?? "").trim();
    await verifyCloudSecret(cleanSecret);

    const expiryTime = Date.now() + SESSION_DURATION_MS;
    localStorage.setItem(STORAGE_KEYS.vercelSyncSecret, cleanSecret);
    localStorage.setItem(STORAGE_KEYS.sessionExpiry, String(expiryTime));

    showMainApp();
    return { success: true };
}

/**
 * Cierra la sesión activa y regresa a la pantalla de login.
 */
export function logout() {
    localStorage.removeItem(STORAGE_KEYS.sessionExpiry);
    localStorage.removeItem(STORAGE_KEYS.vercelSyncSecret);

    showLoginView();
    showToast("Sesión cerrada correctamente.");
}

/**
 * Muestra la vista principal de la app y oculta la vista de login.
 */
export function showMainApp() {
    if (refs.loginView) {
        refs.loginView.classList.add("hidden");
    }

    if (refs.appHeader) {
        refs.appHeader.classList.remove("hidden");
    }

    if (refs.appContent) {
        refs.appContent.classList.remove("hidden");
    }

    rerenderIcons();
    scheduleHeaderOffsetSync();
}

/**
 * Muestra la pantalla de inicio de sesión y oculta la app principal.
 */
export function showLoginView() {
    if (refs.appHeader) {
        refs.appHeader.classList.add("hidden");
    }

    if (refs.appContent) {
        refs.appContent.classList.add("hidden");
    }

    if (refs.loginView) {
        refs.loginView.classList.remove("hidden");
    }

    // Resetear formulario de login si existe
    if (refs.loginSecretInput) {
        refs.loginSecretInput.value = "";
    }

    if (refs.loginErrorMsg) {
        refs.loginErrorMsg.classList.add("hidden");
        refs.loginErrorMsg.textContent = "";
    }

    rerenderIcons();
}
