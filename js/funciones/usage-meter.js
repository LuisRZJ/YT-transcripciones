import { GOOGLE_AI_STUDIO_PRICING } from "./state.js";

/**
 * Normaliza el objeto usage de OpenRouter al formato estándar del medidor.
 * @param {object} result - Respuesta JSON de OpenRouter
 * @param {number} elapsedMs - Tiempo transcurrido de la llamada en milisegundos
 * @returns {object} Métricas normalizadas
 */
export function normalizeOpenRouterUsage(result, elapsedMs = 0) {
    const u = result?.usage || {};
    const input = Number(u.prompt_tokens) || 0;
    const output = Number(u.completion_tokens) || 0;
    const total = Number(u.total_tokens) || (input + output);
    const cost = typeof u.cost === "number" ? u.cost : null;

    return {
        provider: "openrouter",
        inputTokens: input,
        outputTokens: output,
        totalTokens: total,
        costUsd: cost,
        costEstimated: false,
        elapsedMs: Math.max(0, Number(elapsedMs) || 0)
    };
}

/**
 * Normaliza el objeto usageMetadata de Google AI Studio (Gemini) al formato estándar.
 * Calcula el costo estimado usando la tarifa por millón de tokens configurada.
 * @param {object} result - Respuesta JSON de Gemini generateContent
 * @param {number} elapsedMs - Tiempo transcurrido de la llamada en milisegundos
 * @returns {object} Métricas normalizadas
 */
export function normalizeGoogleUsage(result, elapsedMs = 0) {
    const u = result?.usageMetadata || {};
    const input = Number(u.promptTokenCount) || 0;
    // candidatesTokenCount + thoughtsTokenCount (tokens de razonamiento/pensamiento si los hay)
    const output = (Number(u.candidatesTokenCount) || 0) + (Number(u.thoughtsTokenCount) || 0);
    const total = Number(u.totalTokenCount) || (input + output);

    const pricing = GOOGLE_AI_STUDIO_PRICING || { inputPerM: 0.30, outputPerM: 2.50 };
    const cost = (input * pricing.inputPerM + output * pricing.outputPerM) / 1_000_000;

    return {
        provider: "google",
        inputTokens: input,
        outputTokens: output,
        totalTokens: total,
        costUsd: cost,
        costEstimated: true,
        elapsedMs: Math.max(0, Number(elapsedMs) || 0)
    };
}

/**
 * Crea un acumulador reactivo de métricas de uso de IA para la transcripción en curso.
 */
export function createUsageTracker() {
    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let totalCostUsd = 0;
    let hasEstimatedCost = false;
    let totalElapsedMs = 0;
    let callCount = 0;
    let lastTokensPerSec = 0;
    let activeCallStartTime = null;

    return {
        startCall() {
            activeCallStartTime = typeof performance !== "undefined" ? performance.now() : Date.now();
        },
        add(usage) {
            if (!usage) {
                activeCallStartTime = null;
                return;
            }
            callCount++;
            inputTokens += usage.inputTokens || 0;
            outputTokens += usage.outputTokens || 0;
            totalTokens += usage.totalTokens || 0;

            if (typeof usage.costUsd === "number") {
                totalCostUsd += usage.costUsd;
            }
            if (usage.costEstimated) {
                hasEstimatedCost = true;
            }

            const elapsed = usage.elapsedMs || 0;
            totalElapsedMs += elapsed;

            if (elapsed > 0 && usage.outputTokens > 0) {
                lastTokensPerSec = (usage.outputTokens / (elapsed / 1000));
            } else {
                lastTokensPerSec = 0;
            }
            activeCallStartTime = null;
        },
        get isInFlight() {
            return activeCallStartTime !== null;
        },
        snapshot() {
            const avgTokensPerSec = totalElapsedMs > 0 && outputTokens > 0
                ? (outputTokens / (totalElapsedMs / 1000))
                : 0;

            return {
                totalTokens,
                inputTokens,
                outputTokens,
                costUsd: totalCostUsd,
                costEstimated: hasEstimatedCost,
                totalElapsedMs,
                callCount,
                lastTokensPerSec,
                avgTokensPerSec,
                isInFlight: activeCallStartTime !== null
            };
        }
    };
}

/**
 * Formateador de conteo de tokens.
 * @param {number} n
 * @returns {string} Ej: 850, 12.4K
 */
export function formatTokens(n) {
    const val = Number(n) || 0;
    if (val >= 10000) {
        return `${(val / 1000).toFixed(1)}K`;
    }
    return val.toLocaleString("en-US");
}

/**
 * Formateador de velocidad (tokens por segundo).
 * @param {number} tps
 * @returns {string} Ej: 42.5 tok/s, —
 */
export function formatSpeed(tps) {
    const val = Number(tps) || 0;
    if (val <= 0) {
        return "—";
    }
    return `${val.toFixed(1)} tok/s`;
}

/**
 * Formateador de costo en dólares (USD).
 * @param {number|null} usd
 * @param {boolean} estimated
 * @returns {string} Ej: ~$0.0042, $0.0021, <$0.0001
 */
export function formatCost(usd, estimated = false) {
    if (typeof usd !== "number" || isNaN(usd)) {
        return "—";
    }
    const prefix = estimated ? "~$" : "$";
    if (usd === 0) {
        return `${prefix}0.0000`;
    }
    if (usd < 0.0001) {
        return `${prefix}<0.0001`;
    }
    return `${prefix}${usd.toFixed(4)}`;
}
