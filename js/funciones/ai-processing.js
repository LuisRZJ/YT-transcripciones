import { callOpenRouter, callGoogleAiStudio } from "./api-client.js";
import { DEFAULT_OPENROUTER_MODEL_ID, DEFAULT_AI_PROVIDER, GOOGLE_AI_STUDIO_MODEL, STORAGE_KEYS } from "./state.js";

function getChoiceContent(result, contextLabel) {
    const content = result?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
        throw new Error(`OpenRouter no devolvio contenido valido para ${contextLabel}.`);
    }
    return content.trim();
}

function parseMetaJson(rawResponse) {
    const sanitized = (rawResponse || "")
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    try {
        return JSON.parse(sanitized);
    } catch {
        const jsonBlock = sanitized.match(/\{[\s\S]*\}/);
        if (jsonBlock) {
            return JSON.parse(jsonBlock[0]);
        }
        throw new Error("La IA devolvio metadatos en formato no JSON.");
    }
}

function getSelectedModelId() {
    const savedModelId = localStorage.getItem(STORAGE_KEYS.openrouterModelId);
    if (savedModelId && savedModelId.trim()) {
        return savedModelId.trim();
    }
    return DEFAULT_OPENROUTER_MODEL_ID;
}

function getAiProviderPreference() {
    const saved = localStorage.getItem(STORAGE_KEYS.aiProviderPreference);
    if (saved === "openrouter" || saved === "google") {
        return saved;
    }
    return DEFAULT_AI_PROVIDER;
}

function isFatalProviderError(error) {
    const status = typeof error?.status === "number" ? error.status : null;
    if (status === 401 || status === 402 || status === 403) {
        return true;
    }
    const msg = String(error?.message || "");
    return /unauthorized|api key|insufficient credits|payment required|missing authentication/i.test(msg);
}

/**
 * Llama al proveedor primario con fallback automático al secundario.
 * Si el error del primario es fatal (401/402/403), no hace fallback.
 * @returns {Promise<string>} El texto devuelto por el proveedor que respondió
 */
async function callAiWithFallback({ prompt, openRouterPayload, openRouterKey, googleKey }) {
    const preference = getAiProviderPreference();
    const primary = preference;
    const fallback = preference === "openrouter" ? "google" : "openrouter";

    async function callProvider(provider) {
        if (provider === "openrouter") {
            const result = await callOpenRouter(openRouterPayload, openRouterKey);
            return getChoiceContent(result, "el procesamiento");
        } else {
            return callGoogleAiStudio(prompt, googleKey, GOOGLE_AI_STUDIO_MODEL);
        }
    }

    try {
        return await callProvider(primary);
    } catch (primaryError) {
        // Si el error es fatal (credenciales inválidas), no intentamos el fallback
        if (isFatalProviderError(primaryError)) {
            throw primaryError;
        }

        // Error no fatal: intentar con el proveedor de respaldo
        console.warn(`Proveedor primario (${primary}) falló, intentando fallback (${fallback}):`, primaryError.message);
        try {
            return await callProvider(fallback);
        } catch (fallbackError) {
            // Ambos fallaron: lanzar el error del primario (más descriptivo)
            throw primaryError;
        }
    }
}

export function chunkText(text, maxChars = 4000) {
    const words = text.split(" ");
    const chunks = [];
    let currentChunk = "";

    for (const word of words) {
        if ((currentChunk.length + word.length + 1) > maxChars) {
            chunks.push(currentChunk.trim());
            currentChunk = `${word} `;
        } else {
            currentChunk += `${word} `;
        }
    }

    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

export async function formatChunkWithAI(chunk, openRouterKey, googleKey) {
    const modelId = getSelectedModelId();

    const prompt = `Tienes un bloque de una transcripción. Tu ÚNICA TAREA es devolver el mismo texto exacto, pero añadiendo saltos de línea dobles (\\n\\n) donde lógicamente termine un párrafo o idea. 
REGLAS ESTRICTAS:
- NO resumas.
- NO cambies ni omitas ninguna palabra original.
- NO corrijas la gramática.
- Simplemente devuelve el texto puro formateado con saltos de párrafo para que sea más fácil de leer, sin ningún comentario adicional ni saludos.

Texto:
${chunk}`;

    const openRouterPayload = {
        model: modelId,
        messages: [
            {
                role: "system",
                content: "Eres un experto formateando transcripciones. Devuelve unicamente lo que se pide, sin markdown extra."
            },
            {
                role: "user",
                content: prompt
            }
        ]
    };

    return callAiWithFallback({ prompt, openRouterPayload, openRouterKey, googleKey });
}

export async function generateMetaWithAI(fullText, openRouterKey, googleKey) {
    const modelId = getSelectedModelId();
    const textContext = fullText.substring(0, 8000);

    const prompt = `Lee el siguiente texto (que puede ser el inicio de una transcripción más larga).
Genera:
1. Un título descriptivo en texto plano.
2. Un resumen estructurado y fácil de leer utilizando formato Markdown (usa viñetas con '- ', negritas '**concepto**' y saltos de línea dobles entre puntos).

IMPORTANTE: Devuelve ÚNICAMENTE un objeto JSON válido con la siguiente estructura, sin formato extra fuera del JSON:
{
  "title": "tu título aquí",
  "summary": "tu resumen aquí en formato Markdown"
}

Texto:
${textContext}`;

    const openRouterPayload = {
        model: modelId,
        messages: [
            {
                role: "user",
                content: prompt
            }
        ]
    };

    const rawMeta = await callAiWithFallback({ prompt, openRouterPayload, openRouterKey, googleKey });
    return parseMetaJson(rawMeta);
}
