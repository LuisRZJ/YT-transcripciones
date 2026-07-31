import { RAPIDAPI_DOWNLOADER_HOST } from "./state.js";

const RAPIDAPI_BASE = `https://${RAPIDAPI_DOWNLOADER_HOST}/api/v1`;
const POLL_INTERVAL_MS = 3000;   // Intervalo de polling: 3 segundos (evita rate limits)
const POLL_TIMEOUT_MS = 300000;  // Timeout máximo: 5 minutos (para videos largos)

function buildHeaders(rapidApiKey) {
    return {
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
    const progressId = data.progressId || data.id || data.jobId;

    if (!progressId) {
        throw new Error("RapidAPI: Respuesta inesperada. No se recibió un ID de proceso (progressId).");
    }

    const initialTitle = data.title || data.info?.title || data.videoTitle || null;
    const initialDuration = Number(data.duration || data.info?.duration || data.videoDuration || 0);

    return { progressId, initialTitle, initialDuration };
}

/**
 * Paso 2: Hace polling hasta obtener el enlace final de descarga.
 * @param {string} progressId
 * @param {string} rapidApiKey
 * @param {function(number):void} onProgress - Callback con porcentaje 0-100
 * @param {{initialTitle?: string, initialDuration?: number}} meta
 * @returns {Promise<{url: string, title: string, duration: number}>}
 */
async function pollAudioDownloadProgress(progressId, rapidApiKey, onProgress, meta = {}) {
    const startTime = Date.now();

    while (true) {
        if (Date.now() - startTime > POLL_TIMEOUT_MS) {
            throw new Error("RapidAPI: El servidor tardó más de 5 minutos en convertir el video. Intenta de nuevo.");
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

        // Extraer progreso si viene como 0-100 o 0-1000
        if (typeof data.progress === "number" && typeof onProgress === "function") {
            const pct = data.progress > 100 ? data.progress / 10 : data.progress;
            onProgress(Math.min(Math.round(pct), 99));
        }

        // Buscar URL final en múltiples posibles propiedades de respuesta RapidAPI
        const downloadUrl = data.url || data.downloadUrl || data.link || data.download_url || data.result;

        if (downloadUrl || data.status === "completed" || data.status === "done" || (data.success && downloadUrl)) {
            if (typeof onProgress === "function") {
                onProgress(100);
            }

            const title = data.title
                || data.info?.title
                || data.videoTitle
                || data.filename
                || meta.initialTitle
                || null;

            const duration = Number(
                data.duration || data.info?.duration || data.videoDuration || meta.initialDuration || 0
            );

            return {
                url: downloadUrl,
                title,
                duration
            };
        }

        // Si el estado es explícitamente fallido
        if (data.status === "error" || data.status === "failed" || data.error) {
            throw new Error(`RapidAPI: Error al convertir el audio. ${data.error || data.message || ""}`);
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

    const { progressId, initialTitle, initialDuration } = await startAudioDownloadJob(videoId, format, quality, validKey);
    const result = await pollAudioDownloadProgress(progressId, validKey, onProgress, { initialTitle, initialDuration });

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
