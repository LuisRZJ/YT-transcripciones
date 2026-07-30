import { RAPIDAPI_DOWNLOADER_HOST } from "./state.js";

const RAPIDAPI_BASE = `https://${RAPIDAPI_DOWNLOADER_HOST}/api/v1`;
const POLL_INTERVAL_MS = 2000;   // Intervalo de polling: 2 segundos
const POLL_TIMEOUT_MS = 120000;  // Timeout máximo: 2 minutos

function buildHeaders(rapidApiKey) {
    return {
        "Content-Type": "application/json",
        "x-rapidapi-host": RAPIDAPI_DOWNLOADER_HOST,
        "x-rapidapi-key": rapidApiKey
    };
}

function validateRapidApiKey(key) {
    const trimmed = String(key ?? "").trim();
    if (!trimmed || trimmed.length < 10) {
        const err = new Error("RapidAPI: Clave no configurada. Ve a Ajustes para añadirla.");
        err.status = 401;
        throw err;
    }
    return trimmed;
}

/**
 * Paso 1: Inicia el job de descarga de audio en RapidAPI.
 * @returns {Promise<{progressId: string, duration: number}>}
 */
async function startAudioDownloadJob(videoId, format, quality, rapidApiKey) {
    const params = new URLSearchParams({
        id: videoId,
        format,
        audioQuality: quality,
        addInfo: "true",
        allowExtendedDuration: "false"
    });

    let res;
    try {
        res = await fetch(`${RAPIDAPI_BASE}/download?${params}`, {
            method: "GET",
            headers: buildHeaders(rapidApiKey)
        });
    } catch (netErr) {
        throw new Error(`RapidAPI: Error de red al iniciar descarga. ${netErr.message || ""}`);
    }

    if (res.status === 401 || res.status === 403) {
        const err = new Error("RapidAPI: Clave inválida o sin acceso. Verifica tu API Key en Ajustes.");
        err.status = res.status;
        throw err;
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`RapidAPI: Error HTTP ${res.status} al iniciar descarga. ${body.message || ""}`);
    }

    const data = await res.json();

    if (!data.success || !data.progressId) {
        throw new Error("RapidAPI: Respuesta inesperada. No se recibió un progressId válido.");
    }

    return { progressId: data.progressId, duration: data.duration ?? 0 };
}

/**
 * Paso 2: Hace polling hasta obtener el enlace final de descarga.
 * @param {function(number):void} onProgress - Callback con porcentaje 0-100
 * @returns {Promise<{url: string, title: string, duration: number}>}
 */
async function pollAudioDownloadProgress(progressId, rapidApiKey, onProgress) {
    const startTime = Date.now();

    while (true) {
        if (Date.now() - startTime > POLL_TIMEOUT_MS) {
            throw new Error("RapidAPI: El servidor tardó demasiado en procesar el audio. Intenta de nuevo.");
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

        let res;
        try {
            res = await fetch(`${RAPIDAPI_BASE}/progress?id=${encodeURIComponent(progressId)}`, {
                method: "GET",
                headers: buildHeaders(rapidApiKey)
            });
        } catch {
            // Error de red puntual en polling: reintentar en el siguiente ciclo
            continue;
        }

        if (!res.ok) {
            continue;
        }

        let data;
        try {
            data = await res.json();
        } catch {
            continue;
        }

        // Notificar progreso parcial
        if (typeof data.progress === "number" && typeof onProgress === "function") {
            onProgress(Math.min(Math.round(data.progress), 99));
        }

        // Respuesta final con enlace de descarga
        if (data.success && data.url) {
            if (typeof onProgress === "function") {
                onProgress(100);
            }

            const title = data.title
                || data.info?.title
                || data.videoTitle
                || "audio_youtube";

            return {
                url: data.url,
                title,
                duration: data.duration ?? 0
            };
        }
    }
}

/**
 * Dispara la descarga del archivo en el navegador del usuario.
 * El archivo se descarga a su dispositivo directamente.
 */
export function triggerBrowserDownload(url, filename) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Función principal: orquesta el flujo completo start → poll → devuelve datos.
 * La descarga real al dispositivo se activa desde app.js con triggerBrowserDownload.
 *
 * @param {string} videoId
 * @param {{format: string, quality: string, rapidApiKey: string}} options
 * @param {function(number):void} onProgress
 * @returns {Promise<{url: string, title: string, duration: number}>}
 */
export async function fetchAudioDownload(videoId, { format, quality, rapidApiKey }, onProgress) {
    const validKey = validateRapidApiKey(rapidApiKey);

    if (typeof onProgress === "function") {
        onProgress(0);
    }

    const { progressId } = await startAudioDownloadJob(videoId, format, quality, validKey);
    const result = await pollAudioDownloadProgress(progressId, validKey, onProgress);

    return result;
}

/**
 * Formatea segundos a mm:ss o hh:mm:ss
 */
export function formatDuration(seconds) {
    if (!seconds || seconds <= 0) {
        return "—";
    }

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
        return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    return `${m}:${String(s).padStart(2, "0")}`;
}
