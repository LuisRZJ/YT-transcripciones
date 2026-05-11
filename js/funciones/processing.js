import { refs, rerenderIcons } from "./dom.js";
import { chunkText, formatChunkWithAI, generateMetaWithAI } from "./ai-processing.js";
import { state, STORAGE_KEYS } from "./state.js";

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

        for (let i = 0; i < chunks.length; i++) {
            const percentage = Math.round((i / chunks.length) * 100);
            if (refs.aiProgressText) {
                refs.aiProgressText.textContent = `Estructurando bloque ${i + 1} de ${chunks.length}...`;
            }
            if (refs.aiProgressBar) {
                refs.aiProgressBar.style.width = `${percentage}%`;
            }

            const formattedChunk = await formatChunkWithAI(chunks[i], openRouterKey);
            assembledFormattedText += `${formattedChunk}\n\n`;
        }

        if (refs.aiProgressText) {
            refs.aiProgressText.textContent = "Generando título y resumen final...";
        }
        if (refs.aiProgressBar) {
            refs.aiProgressBar.style.width = "90%";
        }

        const metaData = await generateMetaWithAI(assembledFormattedText, openRouterKey);

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
        showRawFallback(rawText, "Ocurrió un error al procesar el texto largo con IA. Mostrando versión cruda.");
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
