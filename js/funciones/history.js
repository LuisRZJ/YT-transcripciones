import { refs, rerenderIcons } from "./dom.js";
import { state, STORAGE_KEYS } from "./state.js";
import { extractVideoId } from "./youtube.js";
import { showToast, switchTab } from "./ui-actions.js";

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function getHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.history);
        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        return [];
    }
}

export function saveHistory(historyArray) {
    try {
        localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(historyArray));
    } catch (err) {
        showToast("Error: No hay suficiente espacio en el navegador para guardar.");
        throw err;
    }
}

export function openHistoryModal() {
    if (!refs.historyModal) {
        return;
    }

    renderHistoryList();

    refs.historyModal.classList.remove("hidden");
    setTimeout(() => {
        refs.historyModal.classList.remove("opacity-0");
        const panel = refs.historyModal.querySelector("div");
        if (panel) {
            panel.classList.remove("scale-95");
        }
    }, 10);
}

export function closeHistoryModal() {
    if (!refs.historyModal) {
        return;
    }

    refs.historyModal.classList.add("opacity-0");
    const panel = refs.historyModal.querySelector("div");
    if (panel) {
        panel.classList.add("scale-95");
    }

    setTimeout(() => {
        refs.historyModal.classList.add("hidden");
    }, 300);
}

export function saveTranscript() {
    if (!state.currentData || !state.finalAiData.formattedText) {
        showToast("No hay una transcripción generada para guardar.");
        return;
    }

    const currentUrl = refs.youtubeUrlInput ? refs.youtubeUrlInput.value.trim() : "";
    const videoId = extractVideoId(currentUrl) || "unknown";

    const history = getHistory();
    const newItem = {
        id: Date.now(),
        date: new Date().toLocaleString(),
        title: state.finalAiData.title || "Sin Título",
        summary: state.finalAiData.summary || "",
        formattedText: state.finalAiData.formattedText,
        jsonData: state.currentData,
        videoId,
        synced: false
    };

    if (videoId !== "unknown") {
        const existingIndex = history.findIndex((item) => item.videoId === videoId);
        if (existingIndex !== -1) {
            history.splice(existingIndex, 1);
        }
    } else {
        const exists = history.find((item) => (
            item.formattedText.length === newItem.formattedText.length &&
            item.title === newItem.title
        ));

        if (exists) {
            showToast("Esta transcripción ya está guardada en tu historial.");
            return;
        }
    }

    history.unshift(newItem);

    try {
        saveHistory(history);
        showToast("¡Transcripción guardada en el historial!");
    } catch (e) {
        // Error gestionado en saveHistory.
    }
}

export function renderHistoryList() {
    if (!refs.historyListContainer || !refs.historyItemCount) {
        return;
    }

    const history = getHistory();
    refs.historyItemCount.textContent = `${history.length} transcripciones guardadas`;

    if (history.length === 0) {
        refs.historyListContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center text-slate-500 py-10 h-full">
                <i data-lucide="inbox" class="w-12 h-12 mb-3 text-slate-300"></i>
                <p class="font-medium">No hay transcripciones guardadas.</p>
                <p class="text-sm mt-1">Usa el icono de guardado en la esquina al extraer una.</p>
            </div>`;
        rerenderIcons();
        return;
    }

    refs.historyListContainer.innerHTML = history.map((item) => {
        const safeTitle = escapeHtml(item.title || "Sin Título");
        const safeSummary = escapeHtml(item.summary || "Sin resumen.");
        const safeDate = escapeHtml(item.date || "");

        return `
            <div class="bg-white border text-left border-slate-300 rounded-lg p-5 shadow-sm hover:shadow transition-shadow flex flex-col md:flex-row gap-5 justify-between items-start md:items-center overflow-hidden">
                <div class="flex-1 min-w-0" style="max-width: 100%;">
                    <div class="marquee-container mb-1.5" title="${safeTitle}">
                        <div class="marquee-content font-bold text-slate-800 text-lg">
                            <span class="pr-12">${safeTitle}</span><span class="pr-12">${safeTitle}</span>
                        </div>
                    </div>
                    <p class="text-xs text-slate-500 flex items-center gap-1.5 font-medium mb-3">
                        <i data-lucide="clock" class="w-3.5 h-3.5"></i> Capturada: ${safeDate}
                    </p>
                    <p class="text-sm text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2 rounded border border-slate-100">${safeSummary}</p>
                </div>
                <div class="flex flex-wrap md:flex-col gap-2 shrink-0 self-stretch md:self-auto justify-end md:justify-start pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 mt-2 md:mt-0 md:w-36">
                    <button type="button" data-action="history-load" data-id="${item.id}" class="flex-1 md:flex-none px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-sm rounded transition-colors flex items-center justify-center gap-1.5" title="Cargar y ver">
                        <i data-lucide="external-link" class="w-4 h-4"></i> Cargar
                    </button>
                    <button type="button" data-action="history-download" data-id="${item.id}" class="flex-1 md:flex-none px-3 py-2 bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 font-semibold text-sm rounded transition-colors flex items-center justify-center gap-1.5" title="Descargar como .txt">
                        <i data-lucide="download" class="w-4 h-4"></i> Descargar
                    </button>
                    <button type="button" data-action="history-delete" data-id="${item.id}" class="flex-none px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 font-semibold text-sm rounded transition-colors flex items-center justify-center gap-1.5" title="Eliminar del historial">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;
    }).join("");

    rerenderIcons();
}

export function loadFromHistory(id) {
    const itemId = Number(id);
    const history = getHistory();
    const item = history.find((entry) => entry.id === itemId);

    if (!item) {
        return;
    }

    state.currentData = item.jsonData;
    state.finalAiData = {
        title: item.title,
        summary: item.summary,
        formattedText: item.formattedText
    };

    switchTab("text");

    if (refs.jsonOutput) {
        refs.jsonOutput.textContent = JSON.stringify(state.currentData, null, 2);
    }

    if (refs.aiTitle) {
        refs.aiTitle.textContent = state.finalAiData.title;
    }

    if (refs.plainTextOutput) {
        refs.plainTextOutput.textContent = state.finalAiData.formattedText;
    }

    if (refs.aiSummary) {
        refs.aiSummary.textContent = state.finalAiData.summary;
    }

    if (refs.errorState) {
        refs.errorState.classList.add("hidden");
    }

    if (item.videoId && item.videoId !== "unknown" && refs.youtubeUrlInput) {
        refs.youtubeUrlInput.value = `https://youtu.be/${item.videoId}`;
    }

    if (refs.loadingState) {
        refs.loadingState.classList.add("hidden");
        refs.loadingState.classList.remove("flex");
    }

    if (refs.aiLoadingState) {
        refs.aiLoadingState.classList.add("hidden");
        refs.aiLoadingState.classList.remove("flex");
    }

    if (refs.aiResults) {
        refs.aiResults.classList.remove("hidden");
    }

    if (refs.resultsContainer) {
        refs.resultsContainer.classList.remove("hidden");
    }

    if (refs.actionButtonsGroup) {
        refs.actionButtonsGroup.classList.remove("hidden");
    }

    closeHistoryModal();
    showToast("Transcripción cargada desde el historial.");

    setTimeout(() => {
        if (refs.resultsContainer) {
            refs.resultsContainer.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, 100);
}

export function deleteFromHistory(id) {
    const itemId = Number(id);
    if (!Number.isFinite(itemId)) {
        return;
    }

    if (!confirm("¿Seguro que deseas eliminar el registro de esta transcripción?")) {
        return;
    }

    const history = getHistory();
    const newHistory = history.filter((entry) => entry.id !== itemId);
    saveHistory(newHistory);
    renderHistoryList();
    showToast("Transcripción eliminada.");
}

export function downloadFromHistory(id) {
    const itemId = Number(id);
    const history = getHistory();
    const item = history.find((entry) => entry.id === itemId);

    if (!item) {
        return;
    }

    const safeTitle = (item.title || "transcripcion").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const content = `${item.title}\n\nFecha guardado: ${item.date}\n\n${item.formattedText}\n\n--- RESUMEN ---\n${item.summary}`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeTitle}_history.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast("¡Archivo de historial descargado!");
}
