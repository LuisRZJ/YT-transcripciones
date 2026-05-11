import { refs, rerenderIcons } from "./dom.js";
import { chunkText, formatChunkWithAI, generateMetaWithAI } from "./ai-processing.js";
import { state, STORAGE_KEYS } from "./state.js";

function buildAiErrorMessage(error) {
    const status = typeof error?.status === "number" ? error.status : null;
    const rawMessage = String(error?.message || "").trim();

    if (status === 401 || /unauthorized|api key|auth/i.test(rawMessage)) {
        return "No se pudo autenticar con OpenRouter. Revisa tu API Key en Ajustes.";
    }

    if (status === 402 || /insufficient credits|payment required|quota/i.test(rawMessage)) {
        return "OpenRouter no tiene creditos suficientes para procesar este texto.";
    }

    if (status === 429 || /rate limit|too many requests/i.test(rawMessage)) {
        return "OpenRouter alcanzo el limite de solicitudes. Intenta nuevamente en unos minutos.";
    }

    if ((status && status >= 500) || /gateway|temporarily unavailable|timeout/i.test(rawMessage)) {
        return "OpenRouter esta temporalmente inestable. Vuelve a intentarlo en un momento.";
    }

    if (/json|formato|invalid/i.test(rawMessage)) {
        return "La IA devolvio una respuesta en formato inesperado.";
    }

    return rawMessage || "Ocurrio un error desconocido al procesar con IA.";
}

export async function processAndRender(data) {
    if (refs.jsonOutput) {
        refs.jsonOutput.textContent = JSON.stringify(data, null, 2);
    }

    if (refs.resultsContainer) {
        refs.resultsContainer.classList.remove("hidden");
    }

    if (refs.loadingState) {
        refs.loadingState.classList.add("hidden");
        refs.loadingState.classList.remove("flex");
    }

    let rawText = "";
    const transcriptArray = Array.isArray(data) ? data : (data.transcript || data.data || data.content);

    if (Array.isArray(transcriptArray)) {
        rawText = transcriptArray.map((segment) => segment.text || segment.content || "").join(" ");
    } else if (typeof data === "string") {
        rawText = data;
    } else if (data && data.text) {
        rawText = data.text;
    }

    if (!rawText || rawText.length < 20) {
        showRawFallback(rawText, "Texto demasiado corto o no encontrado.");
        return;
    }

    if (refs.aiResults) {
        refs.aiResults.classList.add("hidden");
    }

    if (refs.aiLoadingState) {
        refs.aiLoadingState.classList.remove("hidden");
        refs.aiLoadingState.classList.add("flex");
    }

    if (refs.actionButtonsGroup) {
        refs.actionButtonsGroup.classList.add("hidden");
    }

    const openRouterKey = localStorage.getItem(STORAGE_KEYS.openrouterApiKey);

    try {
        const chunks = chunkText(rawText, 3500);
        let assembledFormattedText = "";
        let failedChunks = 0;
        let firstChunkErrorReason = "";

        for (let i = 0; i < chunks.length; i++) {
            const percentage = Math.round((i / chunks.length) * 100);
            if (refs.aiProgressText) {
                refs.aiProgressText.textContent = `Estructurando bloque ${i + 1} de ${chunks.length}...`;
            }
            if (refs.aiProgressBar) {
                refs.aiProgressBar.style.width = `${percentage}%`;
            }

            let formattedChunk = "";

            try {
                formattedChunk = await formatChunkWithAI(chunks[i], openRouterKey);
            } catch (chunkError) {
                failedChunks += 1;
                console.warn(`Error al formatear bloque ${i + 1}/${chunks.length}:`, chunkError);
                if (!firstChunkErrorReason) {
                    firstChunkErrorReason = buildAiErrorMessage(chunkError);
                }
                formattedChunk = chunks[i];
            }

            assembledFormattedText += `${formattedChunk}\n\n`;
        }

        if (refs.aiProgressText) {
            refs.aiProgressText.textContent = "Generando título y resumen final...";
        }
        if (refs.aiProgressBar) {
            refs.aiProgressBar.style.width = "90%";
        }

        let metaData;

        try {
            metaData = await generateMetaWithAI(assembledFormattedText, openRouterKey);
        } catch (metaError) {
            console.warn("No se pudo generar titulo/resumen con IA:", metaError);
            metaData = {
                title: "Transcripción procesada",
                summary: `No se pudo generar el resumen automatico. ${buildAiErrorMessage(metaError)}`
            };
        }

        if (failedChunks > 0) {
            const detail = firstChunkErrorReason ? ` Primer error: ${firstChunkErrorReason}` : "";
            const chunkWarning = `${failedChunks} bloque(s) se mantuvieron en version cruda por errores de IA.${detail}`;
            metaData.summary = `${metaData.summary}\n\n${chunkWarning}`;
        }

        if (refs.aiProgressBar) {
            refs.aiProgressBar.style.width = "100%";
        }

        state.finalAiData = {
            title: metaData.title,
            summary: metaData.summary,
            formattedText: assembledFormattedText.trim()
        };

        if (refs.aiTitle) {
            refs.aiTitle.textContent = state.finalAiData.title;
        }

        if (refs.plainTextOutput) {
            refs.plainTextOutput.textContent = state.finalAiData.formattedText;
        }

        if (refs.aiSummary) {
            refs.aiSummary.textContent = state.finalAiData.summary;
        }
    } catch (aiError) {
        console.error("Error en IA Chunking:", aiError);
        const readableMessage = `No se pudo completar el procesado con IA. ${buildAiErrorMessage(aiError)} Mostrando version cruda.`;
        showRawFallback(rawText, readableMessage);
    } finally {
        if (refs.aiLoadingState) {
            refs.aiLoadingState.classList.add("hidden");
            refs.aiLoadingState.classList.remove("flex");
        }

        if (refs.aiResults) {
            refs.aiResults.classList.remove("hidden");
        }

        if (refs.actionButtonsGroup) {
            refs.actionButtonsGroup.classList.remove("hidden");
        }

        if (refs.submitBtn) {
            refs.submitBtn.disabled = false;
        }

        rerenderIcons();
    }
}

export function showRawFallback(text, message) {
    if (refs.aiTitle) {
        refs.aiTitle.textContent = "Transcripción Original";
    }

    if (refs.plainTextOutput) {
        refs.plainTextOutput.textContent = text;
    }

    if (refs.aiSummary) {
        refs.aiSummary.textContent = message;
    }

    state.finalAiData = {
        title: "Transcripción",
        summary: message,
        formattedText: text
    };

    if (refs.aiLoadingState) {
        refs.aiLoadingState.classList.add("hidden");
        refs.aiLoadingState.classList.remove("flex");
    }

    if (refs.aiResults) {
        refs.aiResults.classList.remove("hidden");
    }

    if (refs.actionButtonsGroup) {
        refs.actionButtonsGroup.classList.remove("hidden");
    }

    if (refs.submitBtn) {
        refs.submitBtn.disabled = false;
    }
}
