import { refs } from "./dom.js";
import { state } from "./state.js";

export function switchTab(tab) {
    state.currentTab = tab;

    if (!refs.tabText || !refs.tabJson || !refs.contentText || !refs.contentJson) {
        return;
    }

    if (tab === "text") {
        refs.tabText.className = "flex-1 py-3 px-4 text-sm font-semibold border-b-2 border-blue-700 text-blue-700 transition-colors flex items-center justify-center gap-2";
        refs.tabJson.className = "flex-1 py-3 px-4 text-sm font-semibold border-b-2 border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2";
        refs.contentText.classList.remove("hidden");
        refs.contentText.classList.add("block");
        refs.contentJson.classList.remove("block");
        refs.contentJson.classList.add("hidden");
        return;
    }

    refs.tabJson.className = "flex-1 py-3 px-4 text-sm font-semibold border-b-2 border-blue-700 text-blue-700 transition-colors flex items-center justify-center gap-2";
    refs.tabText.className = "flex-1 py-3 px-4 text-sm font-semibold border-b-2 border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2";
    refs.contentJson.classList.remove("hidden");
    refs.contentJson.classList.add("block");
    refs.contentText.classList.remove("block");
    refs.contentText.classList.add("hidden");
}

export function copyContent() {
    if (!state.currentData) {
        return;
    }

    const textToCopy = state.currentTab === "text"
        ? state.finalAiData.formattedText
        : (refs.jsonOutput ? refs.jsonOutput.textContent : "");

    const textarea = document.createElement("textarea");
    textarea.value = textToCopy;
    document.body.appendChild(textarea);
    textarea.select();

    try {
        document.execCommand("copy");
        showToast("¡Copiado al portapapeles!");
    } catch (err) {
        console.error("Error", err);
    } finally {
        document.body.removeChild(textarea);
    }
}

export function downloadContent() {
    if (!state.currentData) {
        return;
    }

    let contentToDownload = "";
    let fileName = "";
    let mimeType = "text/plain";

    const safeTitle = (state.finalAiData.title || "transcripcion")
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();

    if (state.currentTab === "text") {
        contentToDownload = `${state.finalAiData.title}\n\n${state.finalAiData.formattedText}\n\n--- RESUMEN ---\n${state.finalAiData.summary}`;
        fileName = `${safeTitle}.txt`;
    } else {
        contentToDownload = refs.jsonOutput ? refs.jsonOutput.textContent : "";
        fileName = `${safeTitle}.json`;
        mimeType = "application/json";
    }

    const blob = new Blob([contentToDownload], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast("¡Archivo descargado!");
}

export function showToast(message) {
    if (!refs.toast) {
        return;
    }

    const span = refs.toast.querySelector("span");
    if (span) {
        span.textContent = message;
    }

    refs.toast.classList.remove("translate-y-20", "opacity-0");
    setTimeout(() => {
        refs.toast.classList.add("translate-y-20", "opacity-0");
    }, 3000);
}

export function executeForceFetch() {
    state.forceNextFetch = true;
    if (refs.submitBtn) {
        refs.submitBtn.click();
    }
}

/**
 * Convierte un texto en Markdown a HTML seguro de forma bonita.
 * Utiliza marked.js si está cargado globalmente o un parser ligero de respaldo.
 * @param {string} markdownText 
 * @returns {string} HTML renderizado
 */
export function renderMarkdown(markdownText) {
    if (!markdownText || typeof markdownText !== "string") {
        return "";
    }

    const raw = markdownText.trim();

    if (window.marked && typeof window.marked.parse === "function") {
        try {
            return window.marked.parse(raw, { gfm: true, breaks: true });
        } catch (err) {
            console.warn("Error en marked.parse, usando parser fallback:", err);
        }
    }

    let html = raw
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/__(.*?)__/g, "<strong>$1</strong>");
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

    const lines = html.split("\n");
    let inList = false;
    const processed = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (/^[-*]\s+/.test(trimmed)) {
            const content = trimmed.replace(/^[-*]\s+/, "");
            if (!inList) {
                processed.push('<ul class="list-disc pl-5 my-2 space-y-1">');
                inList = true;
            }
            processed.push(`<li>${content}</li>`);
        } else {
            if (inList) {
                processed.push("</ul>");
                inList = false;
            }
            if (trimmed.length > 0) {
                processed.push(`<p class="mb-2">${trimmed}</p>`);
            }
        }
    }

    if (inList) {
        processed.push("</ul>");
    }

    return processed.join("\n");
}

/**
 * Renderiza el Markdown en un elemento contenedor DOM.
 * @param {HTMLElement} element 
 * @param {string} markdownText 
 */
export function renderSummaryContent(element, markdownText) {
    if (!element) {
        return;
    }
    element.innerHTML = renderMarkdown(markdownText);
}

/**
 * Elimina marcas de formato Markdown para obtener texto plano en previews.
 * @param {string} markdownText 
 * @returns {string} Texto plano
 */
export function stripMarkdown(markdownText) {
    if (!markdownText || typeof markdownText !== "string") {
        return "";
    }

    return markdownText
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/^[-*]\s+/gm, "")
        .replace(/#/g, "")
        .trim();
}

