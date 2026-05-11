const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const INVALID_OPENROUTER_KEY_VALUES = new Set([
    "null",
    "undefined",
    "none",
    "bearer",
    "token",
    "your_openrouter_api_key",
    "tu_openrouter_key"
]);

export function normalizeOpenRouterKey(rawKey) {
    const value = String(rawKey ?? "")
        .trim()
        .replace(/^["']+|["']+$/g, "");

    if (!value) {
        return "";
    }

    return value.replace(/^bearer\s+/i, "").trim();
}

function createAuthValidationError(message) {
    const error = new Error(message);
    error.status = 401;
    return error;
}

function validateOpenRouterKey(rawKey) {
    const normalizedKey = normalizeOpenRouterKey(rawKey);

    if (!normalizedKey) {
        throw createAuthValidationError("OpenRouter: API Key no configurada.");
    }

    if (INVALID_OPENROUTER_KEY_VALUES.has(normalizedKey.toLowerCase()) || normalizedKey.length < 12) {
        throw createAuthValidationError("OpenRouter: API Key invalida o incompleta. Pega solo la clave (sin 'Bearer').");
    }

    return normalizedKey;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
    return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function extractErrorMessageFromBody(rawBody) {
    if (!rawBody || !rawBody.trim()) {
        return "";
    }

    try {
        const parsed = JSON.parse(rawBody);
        return parsed?.error?.message || parsed?.message || "";
    } catch {
        return rawBody.trim().slice(0, 220);
    }
}

async function createHttpError(response) {
    const rawBody = await response.text().catch(() => "");
    const detail = extractErrorMessageFromBody(rawBody);
    const message = detail
        ? `HTTP ${response.status}: ${detail}`
        : `HTTP ${response.status}: ${response.statusText || "Error desconocido"}`;

    const httpError = new Error(message);
    httpError.status = response.status;
    return httpError;
}

export async function fetchWithRetry(url, options, retries = 5) {
    const delays = [1000, 2000, 4000, 8000, 16000];

    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            if (!res.ok) {
                throw await createHttpError(res);
            }
            return res;
        } catch (err) {
            const status = typeof err?.status === "number" ? err.status : null;
            const shouldRetry = i < retries - 1 && (status === null || isRetryableStatus(status));

            if (!shouldRetry) {
                throw err;
            }

            const delay = delays[Math.min(i, delays.length - 1)];
            await sleep(delay);
        }
    }

    throw new Error("No se pudo completar la solicitud");
}

export async function fetchSupadataTranscript(videoUrl, apiKey) {
    const response = await fetch(
        `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(videoUrl)}`,
        {
            method: "GET",
            headers: {
                "x-api-key": apiKey,
                Accept: "application/json"
            }
        }
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error HTTP: ${response.status}`);
    }

    return response.json();
}

export async function callOpenRouter(payload, openRouterKey) {
    const normalizedOpenRouterKey = validateOpenRouterKey(openRouterKey);

    let response;
    try {
        response = await fetchWithRetry(OPENROUTER_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${normalizedOpenRouterKey}`,
                "HTTP-Referer": window.location.href,
                "X-Title": "Extractor YT"
            },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        const apiError = new Error(`OpenRouter: ${error?.message || "No se pudo completar la solicitud."}`);
        apiError.status = error?.status;
        throw apiError;
    }

    const result = await response.json().catch(() => {
        throw new Error("OpenRouter: Respuesta invalida (no JSON).");
    });

    if (result.error) {
        const apiError = new Error(`OpenRouter: ${result.error.message || "Error en OpenRouter API"}`);
        apiError.status = result.error.status_code || response.status;
        throw apiError;
    }

    if (!Array.isArray(result.choices) || result.choices.length === 0) {
        throw new Error("OpenRouter: La respuesta no incluyo contenido procesable.");
    }

    return result;
}
