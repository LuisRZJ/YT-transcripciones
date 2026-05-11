import { callOpenRouter } from "./api-client.js";
import { DEFAULT_OPENROUTER_MODEL_ID, STORAGE_KEYS } from "./state.js";

function getSelectedModelId() {
    const savedModelId = localStorage.getItem(STORAGE_KEYS.openrouterModelId);
    if (savedModelId && savedModelId.trim()) {
        return savedModelId.trim();
    }
    return DEFAULT_OPENROUTER_MODEL_ID;
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

export async function formatChunkWithAI(chunk, openRouterKey) {
    const modelId = getSelectedModelId();

    const prompt = `Tienes un bloque de una transcripción. Tu ÚNICA TAREA es devolver el mismo texto exacto, pero añadiendo saltos de línea dobles (\\n\\n) donde lógicamente termine un párrafo o idea. 
REGLAS ESTRICTAS:
- NO resumas.
- NO cambies ni omitas ninguna palabra original.
- NO corrijas la gramática.
- Simplemente devuelve el texto puro formateado con saltos de párrafo para que sea más fácil de leer, sin ningún comentario adicional ni saludos.

Texto:
${chunk}`;

    const payload = {
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

    const result = await callOpenRouter(payload, openRouterKey);
    return result.choices[0].message.content.trim();
}

export async function generateMetaWithAI(fullText, openRouterKey) {
    const modelId = getSelectedModelId();
    const textContext = fullText.substring(0, 8000);

    const prompt = `Lee el siguiente texto (que puede ser el inicio de una transcripción más larga).
Genera:
1. Un título descriptivo.
2. Un resumen breve y estructurado (puede ser un párrafo corto o viñetas) destacando los puntos principales.

IMPORTANTE: Devuelve ÚNICAMENTE un objeto JSON válido con la siguiente estructura, sin formato markdown ni texto adicional:
{
  "title": "tu título aquí",
  "summary": "tu resumen aquí"
}

Texto:
${textContext}`;

    const payload = {
        model: modelId,
        messages: [
            {
                role: "user",
                content: prompt
            }
        ]
    };

    const result = await callOpenRouter(payload, openRouterKey);
    let jsonString = result.choices[0].message.content.trim();

    jsonString = jsonString.replace(/```json/gi, "").replace(/```/g, "").trim();
    return JSON.parse(jsonString);
}
