import { byId, refs, rerenderIcons } from "./dom.js";
import { state, STORAGE_KEYS } from "./state.js";
import { extractVideoId } from "./youtube.js";
import { renderSummaryContent, showToast, stripMarkdown, switchTab } from "./ui-actions.js";
import { renderVideoMetaPreview } from "./processing.js";
import { renderDashboard } from "./dashboard.js";
import {
    COLOR_PALETTE,
    getColorConfig,
    getFolders,
    getCategories,
    createFolder,
    updateFolder,
    deleteFolder,
    createCategory,
    updateCategory,
    deleteCategory,
    assignTranscriptOrganization,
    countTranscriptsInFolder,
    countTranscriptsWithoutFolder,
    countTranscriptsInCategory
} from "./taxonomy.js";

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// ─── Estado de Filtros de la Biblioteca ────────────────────────────────────

let activeFolderFilter = "all"; // "all" | "root" | folderId
let activeCategoryFilter = null; // null | categoryId
let activeSearchQuery = "";

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
    }, 10);
    rerenderIcons();
}

export function closeHistoryModal() {
    if (!refs.historyModal) {
        return;
    }

    refs.historyModal.classList.add("opacity-0");
    setTimeout(() => {
        refs.historyModal.classList.add("hidden");
    }, 200);
}

export function saveTranscript() {
    if (!state.currentData || !state.finalAiData.formattedText) {
        showToast("No hay una transcripción generada para guardar.");
        return;
    }

    const currentUrl = refs.youtubeUrlInput ? refs.youtubeUrlInput.value.trim() : "";
    const videoId = extractVideoId(currentUrl) || "unknown";

    const history = getHistory();
    let prevFolderId = null;
    let prevCategories = [];
    let prevThumbnailUrl = null;
    let prevAuthorName = null;

    if (videoId !== "unknown") {
        const existingIndex = history.findIndex((item) => item.videoId === videoId);
        if (existingIndex !== -1) {
            prevFolderId = history[existingIndex].folderId || null;
            prevCategories = Array.isArray(history[existingIndex].categories) ? history[existingIndex].categories : [];
            prevThumbnailUrl = history[existingIndex].thumbnailUrl || null;
            prevAuthorName = history[existingIndex].authorName || null;
            history.splice(existingIndex, 1);
        }
    } else {
        const exists = history.find((item) => (
            item.formattedText.length === state.finalAiData.formattedText.length &&
            item.title === state.finalAiData.title
        ));

        if (exists) {
            showToast("Esta transcripción ya está guardada en tu historial.");
            return;
        }
    }

    const hasValidVideo = videoId !== "unknown";
    const defaultThumb = hasValidVideo ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
    const resolvedThumbnail = state.currentMetadata?.thumbnailUrl || prevThumbnailUrl || defaultThumb;
    const resolvedAuthor = state.currentMetadata?.authorName || prevAuthorName || null;

    const newItem = {
        id: Date.now(),
        date: new Date().toLocaleString(),
        title: state.finalAiData.title || "Sin Título",
        summary: state.finalAiData.summary || "",
        formattedText: state.finalAiData.formattedText,
        jsonData: state.currentData,
        videoId,
        thumbnailUrl: resolvedThumbnail,
        authorName: resolvedAuthor,
        synced: false,
        folderId: prevFolderId,
        categories: prevCategories
    };

    history.unshift(newItem);

    try {
        saveHistory(history);
        renderDashboard();
        showToast("¡Transcripción guardada en el historial!");
    } catch (e) {
        // Error gestionado en saveHistory.
    }
}

// ─── Renderizado de Carpetas y Categorías en el Panel Lateral ────────────────

function renderFoldersNav(allHistory) {
    const navContainer = byId("foldersNavContainer");
    const countAll = byId("countFolderAll");
    const countRoot = byId("countFolderRoot");
    const btnAll = byId("btnFilterFolderAll");
    const btnRoot = byId("btnFilterFolderRoot");

    if (countAll) {
        countAll.textContent = allHistory.length;
    }
    if (countRoot) {
        countRoot.textContent = countTranscriptsWithoutFolder();
    }

    if (btnAll) {
        const isAll = activeFolderFilter === "all";
        btnAll.className = `w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between transition-colors ${
            isAll ? "bg-blue-50 text-blue-700 font-bold shadow-xs" : "text-slate-600 hover:bg-slate-50"
        }`;
    }

    if (btnRoot) {
        const isRoot = activeFolderFilter === "root";
        btnRoot.className = `w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between transition-colors ${
            isRoot ? "bg-blue-50 text-blue-700 font-bold shadow-xs" : "text-slate-600 hover:bg-slate-50"
        }`;
    }

    if (!navContainer) {
        return;
    }

    const folders = getFolders();
    if (folders.length === 0) {
        navContainer.innerHTML = `<p class="text-xs text-slate-400 py-2 px-1 text-center italic">Sin carpetas creadas</p>`;
        return;
    }

    navContainer.innerHTML = folders.map((folder) => {
        const isActive = activeFolderFilter === folder.id;
        const colorCfg = getColorConfig(folder.color);
        const count = countTranscriptsInFolder(folder.id);
        const safeName = escapeHtml(folder.name);

        return `
            <div class="group flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isActive ? "bg-blue-50 text-blue-800 font-bold" : "text-slate-700 hover:bg-slate-50"
            }">
                <button type="button" data-action="filter-folder" data-folder-id="${folder.id}" class="flex-1 flex items-center gap-2 truncate text-left">
                    <span class="w-2.5 h-2.5 rounded-full ${colorCfg.badgeBg} shrink-0"></span>
                    <span class="truncate">${safeName}</span>
                </button>
                <div class="flex items-center gap-1 shrink-0">
                    <span class="text-xs px-2 py-0.2 rounded-full ${isActive ? "bg-blue-200/80 text-blue-900" : "bg-slate-100 text-slate-500"}">${count}</span>
                    <button type="button" data-action="open-edit-folder-modal" data-id="${folder.id}" class="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-700 rounded transition-opacity" title="Editar carpeta">
                        <i data-lucide="pencil" class="w-3 h-3"></i>
                    </button>
                    <button type="button" data-action="delete-folder-prompt" data-id="${folder.id}" class="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 rounded transition-opacity" title="Eliminar carpeta">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

function renderCategoriesNav() {
    const navContainer = byId("categoriesNavContainer");
    if (!navContainer) {
        return;
    }

    const categories = getCategories();
    if (categories.length === 0) {
        navContainer.innerHTML = `<p class="text-xs text-slate-400 py-2 px-1 text-center italic w-full">Sin categorías creadas</p>`;
        return;
    }

    navContainer.innerHTML = categories.map((cat) => {
        const isActive = activeCategoryFilter === cat.id;
        const colorCfg = getColorConfig(cat.color);
        const count = countTranscriptsInCategory(cat.id);
        const safeName = escapeHtml(cat.name);

        return `
            <div class="group inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${colorCfg.bg} ${colorCfg.text} ${
                isActive ? `ring-2 ring-offset-1 ring-blue-600 ${colorCfg.border}` : `${colorCfg.border} hover:shadow-xs`
            }">
                <button type="button" data-action="filter-category" data-category-id="${cat.id}" class="flex items-center gap-1">
                    <span>${safeName}</span>
                    <span class="opacity-75 font-normal">(${count})</span>
                </button>
                <button type="button" data-action="open-edit-category-modal" data-id="${cat.id}" class="opacity-0 group-hover:opacity-100 hover:text-slate-900 transition-opacity ml-0.5" title="Editar categoría">
                    <i data-lucide="pencil" class="w-2.5 h-2.5"></i>
                </button>
                <button type="button" data-action="delete-category" data-id="${cat.id}" class="opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity" title="Eliminar categoría">
                    <i data-lucide="x" class="w-2.5 h-2.5"></i>
                </button>
            </div>
        `;
    }).join("");
}

function renderActiveFiltersBar(filteredCount, totalCount) {
    const bar = byId("activeFiltersBar");
    if (!bar) {
        return;
    }

    const chips = [];
    const folders = getFolders();
    const categories = getCategories();

    if (activeFolderFilter === "root") {
        chips.push(`
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-medium">
                📁 Sin carpeta
                <button type="button" data-action="clear-folder-filter" class="hover:text-red-600"><i data-lucide="x" class="w-3 h-3"></i></button>
            </span>
        `);
    } else if (activeFolderFilter !== "all") {
        const f = folders.find((item) => item.id === activeFolderFilter);
        const fName = f ? escapeHtml(f.name) : "Carpeta";
        chips.push(`
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
                📁 ${fName}
                <button type="button" data-action="clear-folder-filter" class="hover:text-red-600"><i data-lucide="x" class="w-3 h-3"></i></button>
            </span>
        `);
    }

    if (activeCategoryFilter) {
        const c = categories.find((item) => item.id === activeCategoryFilter);
        const cName = c ? escapeHtml(c.name) : "Categoría";
        chips.push(`
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-medium">
                🏷️ ${cName}
                <button type="button" data-action="clear-category-filter" class="hover:text-red-600"><i data-lucide="x" class="w-3 h-3"></i></button>
            </span>
        `);
    }

    if (activeSearchQuery) {
        chips.push(`
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium truncate max-w-xs">
                🔍 "${escapeHtml(activeSearchQuery)}"
                <button type="button" data-action="clear-search-filter" class="hover:text-red-600"><i data-lucide="x" class="w-3 h-3"></i></button>
            </span>
        `);
    }

    if (chips.length > 1) {
        chips.push(`
            <button type="button" data-action="clear-all-filters" class="text-blue-600 hover:text-blue-800 font-semibold underline text-xs">
                Limpiar filtros
            </button>
        `);
    }

    bar.innerHTML = chips.join("");
}

// ─── Renderizado Principal de la Lista de Transcripciones ───────────────────

export function renderHistoryList() {
    const listContainer = byId("historyListContainer");
    const countLabel = byId("historyItemCount");
    if (!listContainer || !countLabel) {
        return;
    }

    const allHistory = getHistory();
    const folders = getFolders();
    const categories = getCategories();
    const foldersMap = Object.fromEntries(folders.map((f) => [f.id, f]));
    const categoriesMap = Object.fromEntries(categories.map((c) => [c.id, c]));

    // Renderizar panel de navegación lateral
    renderFoldersNav(allHistory);
    renderCategoriesNav();

    // Aplicar filtros
    let filtered = allHistory;

    // 1. Filtro de Carpeta
    if (activeFolderFilter === "root") {
        filtered = filtered.filter((item) => !item.folderId);
    } else if (activeFolderFilter !== "all") {
        filtered = filtered.filter((item) => item.folderId === activeFolderFilter);
    }

    // 2. Filtro de Categoría
    if (activeCategoryFilter) {
        filtered = filtered.filter((item) => Array.isArray(item.categories) && item.categories.includes(activeCategoryFilter));
    }

    // 3. Filtro de Búsqueda de Texto
    if (activeSearchQuery) {
        const q = activeSearchQuery.toLowerCase();
        filtered = filtered.filter((item) => {
            const title = (item.title || "").toLowerCase();
            const summary = (item.summary || "").toLowerCase();
            const text = (item.formattedText || "").toLowerCase();
            return title.includes(q) || summary.includes(q) || text.includes(q);
        });
    }

    countLabel.textContent = `${filtered.length} de ${allHistory.length} transcripciones`;
    renderActiveFiltersBar(filtered.length, allHistory.length);

    if (filtered.length === 0) {
        const hasFilters = activeFolderFilter !== "all" || activeCategoryFilter || activeSearchQuery;
        listContainer.innerHTML = `
            <div class="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 space-y-3">
                <i data-lucide="inbox" class="w-12 h-12 text-slate-300 mx-auto"></i>
                <p class="font-semibold text-slate-700">
                    ${hasFilters ? "No se encontraron transcripciones con estos filtros." : "No hay transcripciones guardadas."}
                </p>
                ${hasFilters ? `
                    <button type="button" data-action="clear-all-filters" class="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs rounded-lg transition-colors">
                        Restablecer filtros
                    </button>
                ` : `
                    <p class="text-xs text-slate-400">Guarda una transcripción al procesar un video para verla aquí.</p>
                `}
            </div>
        `;
        rerenderIcons();
        return;
    }

    listContainer.innerHTML = filtered.map((item) => {
        const safeTitle = escapeHtml(item.title || "Sin Título");
        const cleanSummary = stripMarkdown(item.summary || "Sin resumen.");
        const safeSummary = escapeHtml(cleanSummary);
        const safeDate = escapeHtml(item.date || "");

        // Carpeta asignada
        let folderBadge = "";
        if (item.folderId && foldersMap[item.folderId]) {
            const f = foldersMap[item.folderId];
            const colorCfg = getColorConfig(f.color);
            folderBadge = `
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${colorCfg.bg} ${colorCfg.text} border ${colorCfg.border}">
                    <i data-lucide="folder" class="w-3 h-3"></i> ${escapeHtml(f.name)}
                </span>
            `;
        }

        // Categorías asignadas
        let categoryBadges = "";
        if (Array.isArray(item.categories) && item.categories.length > 0) {
            categoryBadges = item.categories.map((catId) => {
                const c = categoriesMap[catId];
                if (!c) return "";
                const colorCfg = getColorConfig(c.color);
                return `
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${colorCfg.bg} ${colorCfg.text} border ${colorCfg.border}">
                        <i data-lucide="tag" class="w-2.5 h-2.5"></i> ${escapeHtml(c.name)}
                    </span>
                `;
            }).join("");
        }

        // Miniatura y metadatos de YouTube
        const hasValidVideo = item.videoId && item.videoId !== "unknown";
        const cdnThumb = hasValidVideo ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : null;
        const resolvedThumbnail = item.thumbnailUrl || cdnThumb;

        let thumbnailHtml = "";
        if (resolvedThumbnail) {
            thumbnailHtml = `
                <div class="relative w-full sm:w-48 md:w-44 aspect-video rounded-lg overflow-hidden shrink-0 bg-slate-900 border border-slate-200 shadow-2xs group">
                    <img src="${resolvedThumbnail}" alt="${safeTitle}" loading="lazy" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg';" />
                    ${hasValidVideo ? `
                        <a href="https://www.youtube.com/watch?v=${item.videoId}" target="_blank" rel="noopener noreferrer" class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1" title="Ver en YouTube">
                            <i data-lucide="youtube" class="w-4 h-4 text-red-500"></i> YouTube
                        </a>
                        <div class="absolute bottom-1 right-1 bg-black/70 backdrop-blur-2xs text-white text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 pointer-events-none group-hover:hidden">
                            <i data-lucide="youtube" class="w-3 h-3 text-red-500"></i> YouTube
                        </div>
                    ` : ""}
                </div>
            `;
        } else {
            thumbnailHtml = `
                <div class="w-full sm:w-48 md:w-44 aspect-video rounded-lg overflow-hidden shrink-0 bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                    <i data-lucide="file-text" class="w-8 h-8"></i>
                </div>
            `;
        }

        // Autor / Canal si existe
        let authorBadge = "";
        if (item.authorName) {
            authorBadge = `
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200">
                    <i data-lucide="user" class="w-2.5 h-2.5 text-slate-400"></i> ${escapeHtml(item.authorName)}
                </span>
            `;
        }

        return `
            <div class="bg-white border border-slate-300 rounded-xl p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all flex flex-col md:flex-row gap-4 sm:gap-5 justify-between items-start md:items-center overflow-hidden">
                ${thumbnailHtml}
                <div class="flex-1 min-w-0 w-full" style="max-width: 100%;">
                    <div class="flex items-center gap-2 flex-wrap mb-1.5">
                        ${folderBadge}
                        ${categoryBadges}
                        ${authorBadge}
                    </div>
                    <div class="marquee-container mb-1.5" title="${safeTitle}">
                        <div class="marquee-content font-bold text-slate-800 text-lg">
                            <span class="pr-12">${safeTitle}</span><span class="pr-12">${safeTitle}</span>
                        </div>
                    </div>
                    <p class="text-xs text-slate-500 flex items-center gap-1.5 font-medium mb-3">
                        <i data-lucide="clock" class="w-3.5 h-3.5"></i> Capturada: ${safeDate}
                    </p>
                    <p class="text-sm text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">${safeSummary}</p>
                </div>
                <div class="flex flex-wrap md:flex-col gap-2 shrink-0 self-stretch md:self-auto justify-end md:justify-start pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 mt-2 md:mt-0 md:w-36">
                    <button type="button" data-action="history-load" data-id="${item.id}" class="flex-1 md:flex-none px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs sm:text-sm rounded-lg transition-colors flex items-center justify-center gap-1.5" title="Cargar y ver">
                        <i data-lucide="external-link" class="w-4 h-4"></i> Cargar
                    </button>
                    <button type="button" data-action="history-organize" data-id="${item.id}" class="flex-1 md:flex-none px-3 py-2 bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 font-semibold text-xs sm:text-sm rounded-lg transition-colors flex items-center justify-center gap-1.5" title="Mover a carpeta o etiquetar">
                        <i data-lucide="folder-cog" class="w-4 h-4"></i> Organizar
                    </button>
                    <button type="button" data-action="history-download" data-id="${item.id}" class="flex-1 md:flex-none px-3 py-2 bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 font-semibold text-xs sm:text-sm rounded-lg transition-colors flex items-center justify-center gap-1.5" title="Descargar como .txt">
                        <i data-lucide="download" class="w-4 h-4"></i> Descargar
                    </button>
                    <button type="button" data-action="history-delete" data-id="${item.id}" class="flex-none px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 font-semibold text-xs sm:text-sm rounded-lg transition-colors flex items-center justify-center gap-1.5" title="Eliminar del historial">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;
    }).join("");

    rerenderIcons();
    renderDashboard();
}

// ─── Control de Filtros ─────────────────────────────────────────────────────

export function openHistoryModalWithFolder(folderId) {
    activeFolderFilter = folderId;
    activeCategoryFilter = null;
    activeSearchQuery = "";
    const searchInput = byId("historySearchInput");
    if (searchInput) {
        searchInput.value = "";
    }
    const clearBtn = byId("historySearchClear");
    if (clearBtn) {
        clearBtn.classList.add("hidden");
    }
    openHistoryModal();
}

export function setFolderFilter(folderId) {
    activeFolderFilter = folderId;
    renderHistoryList();
}

export function setCategoryFilter(categoryId) {
    // Alternar filtro si ya está seleccionado
    if (activeCategoryFilter === categoryId) {
        activeCategoryFilter = null;
    } else {
        activeCategoryFilter = categoryId;
    }
    renderHistoryList();
}

export function setSearchQuery(query) {
    activeSearchQuery = String(query || "").trim();
    const clearBtn = byId("historySearchClear");
    if (clearBtn) {
        clearBtn.classList.toggle("hidden", !activeSearchQuery);
    }
    renderHistoryList();
}

export function clearAllFilters() {
    activeFolderFilter = "all";
    activeCategoryFilter = null;
    activeSearchQuery = "";
    const input = byId("historySearchInput");
    if (input) {
        input.value = "";
    }
    const clearBtn = byId("historySearchClear");
    if (clearBtn) {
        clearBtn.classList.add("hidden");
    }
    renderHistoryList();
}

// ─── Modal Crear / Editar Carpeta ───────────────────────────────────────────

function renderColorPicker(containerId, inputId, selectedColor) {
    const container = byId(containerId);
    const input = byId(inputId);
    if (!container || !input) return;

    input.value = selectedColor;
    container.innerHTML = COLOR_PALETTE.map((c) => {
        const isSelected = c.id === selectedColor;
        return `
            <button type="button" data-action="select-color" data-color-target="${inputId}" data-color-id="${c.id}" class="w-7 h-7 rounded-full ${c.badgeBg} transition-all border-2 ${
                isSelected ? "border-slate-900 scale-110 shadow-md ring-2 ring-blue-400 ring-offset-1" : "border-transparent hover:scale-105"
            }" title="${c.name}"></button>
        `;
    }).join("");
}

export function openFolderModal(folderId = null) {
    const modal = byId("folderModal");
    const title = byId("folderModalTitle");
    const idInput = byId("folderIdInput");
    const nameInput = byId("folderNameInput");
    if (!modal) return;

    const folders = getFolders();
    const folder = folderId ? folders.find((f) => f.id === folderId) : null;

    if (title) {
        title.innerHTML = folder
            ? `<i data-lucide="pencil" class="w-5 h-5 text-blue-600"></i><span>Editar Carpeta</span>`
            : `<i data-lucide="folder-plus" class="w-5 h-5 text-blue-600"></i><span>Nueva Carpeta</span>`;
    }

    if (idInput) idInput.value = folder ? folder.id : "";
    if (nameInput) nameInput.value = folder ? folder.name : "";

    renderColorPicker("folderColorPicker", "folderColorInput", folder ? folder.color : "blue");

    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.remove("opacity-0"), 10);
    rerenderIcons();
}

export function closeFolderModal() {
    const modal = byId("folderModal");
    if (!modal) return;
    modal.classList.add("opacity-0");
    setTimeout(() => modal.classList.add("hidden"), 200);
}

export function handleFolderFormSubmit(event) {
    event.preventDefault();
    const idInput = byId("folderIdInput");
    const nameInput = byId("folderNameInput");
    const colorInput = byId("folderColorInput");

    const folderId = idInput ? idInput.value : "";
    const name = nameInput ? nameInput.value.trim() : "";
    const color = colorInput ? colorInput.value : "blue";

    try {
        if (folderId) {
            updateFolder(folderId, { name, color });
            showToast("Carpeta actualizada.");
        } else {
            createFolder(name, color);
            showToast("Carpeta creada.");
        }
        closeFolderModal();
        renderHistoryList();
    } catch (e) {
        showToast(e.message || "Error al guardar carpeta.");
    }
}

// ─── Modal Crear / Editar Categoría ─────────────────────────────────────────

export function openCategoryModal(categoryId = null) {
    const modal = byId("categoryModal");
    const title = byId("categoryModalTitle");
    const idInput = byId("categoryIdInput");
    const nameInput = byId("categoryNameInput");
    if (!modal) return;

    const categories = getCategories();
    const cat = categoryId ? categories.find((c) => c.id === categoryId) : null;

    if (title) {
        title.innerHTML = cat
            ? `<i data-lucide="pencil" class="w-5 h-5 text-purple-600"></i><span>Editar Categoría</span>`
            : `<i data-lucide="tag" class="w-5 h-5 text-purple-600"></i><span>Nueva Categoría</span>`;
    }

    if (idInput) idInput.value = cat ? cat.id : "";
    if (nameInput) nameInput.value = cat ? cat.name : "";

    renderColorPicker("categoryColorPicker", "categoryColorInput", cat ? cat.color : "purple");

    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.remove("opacity-0"), 10);
    rerenderIcons();
}

export function closeCategoryModal() {
    const modal = byId("categoryModal");
    if (!modal) return;
    modal.classList.add("opacity-0");
    setTimeout(() => modal.classList.add("hidden"), 200);
}

export function handleCategoryFormSubmit(event) {
    event.preventDefault();
    const idInput = byId("categoryIdInput");
    const nameInput = byId("categoryNameInput");
    const colorInput = byId("categoryColorInput");

    const catId = idInput ? idInput.value : "";
    const name = nameInput ? nameInput.value.trim() : "";
    const color = colorInput ? colorInput.value : "purple";

    try {
        if (catId) {
            updateCategory(catId, { name, color });
            showToast("Categoría actualizada.");
        } else {
            createCategory(name, color);
            showToast("Categoría creada.");
        }
        closeCategoryModal();
        renderHistoryList();
    } catch (e) {
        showToast(e.message || "Error al guardar categoría.");
    }
}

// ─── Modal de Confirmación para Eliminar Carpeta con Casos Límite ────────────

let pendingDeleteFolderId = null;

export function promptDeleteFolder(folderId) {
    const count = countTranscriptsInFolder(folderId);
    const folders = getFolders();
    const folder = folders.find((f) => f.id === folderId);
    const folderName = folder ? folder.name : "esta carpeta";

    if (count === 0) {
        // Carpeta vacía: confirmación estándar directa
        if (confirm(`¿Seguro que deseas eliminar la carpeta "${folderName}"?`)) {
            deleteFolder(folderId, "keep-items");
            if (activeFolderFilter === folderId) {
                activeFolderFilter = "all";
            }
            renderHistoryList();
            showToast("Carpeta eliminada.");
        }
        return;
    }

    // Carpeta con elementos: mostrar modal con opciones explícitas
    pendingDeleteFolderId = folderId;
    const modal = byId("deleteFolderConfirmModal");
    const msg = byId("deleteFolderPromptMsg");
    const targetInput = byId("deleteTargetFolderId");

    if (msg) {
        msg.textContent = `La carpeta "${folderName}" contiene ${count} transcripción(es). Elige qué deseas hacer con el contenido:`;
    }
    if (targetInput) {
        targetInput.value = folderId;
    }

    if (modal) {
        modal.classList.remove("hidden");
        setTimeout(() => modal.classList.remove("opacity-0"), 10);
        rerenderIcons();
    }
}

export function closeDeleteFolderModal() {
    pendingDeleteFolderId = null;
    const modal = byId("deleteFolderConfirmModal");
    if (!modal) return;
    modal.classList.add("opacity-0");
    setTimeout(() => modal.classList.add("hidden"), 200);
}

export function confirmDeleteFolder(mode) {
    if (!pendingDeleteFolderId) return;

    const folderId = pendingDeleteFolderId;
    deleteFolder(folderId, mode);

    if (activeFolderFilter === folderId) {
        activeFolderFilter = "all";
    }

    closeDeleteFolderModal();
    renderHistoryList();

    if (mode === "delete-items") {
        showToast("Carpeta y sus transcripciones eliminadas.");
    } else {
        showToast("Carpeta eliminada. Transcripciones conservadas en 'Sin carpeta'.");
    }
}

// ─── Modal de Asignación / Clasificación de Transcripción ────────────────────

export function openAssignModal(transcriptId) {
    const modal = byId("assignModal");
    const idInput = byId("assignTranscriptId");
    const titleLabel = byId("assignTranscriptTitle");
    const folderSelect = byId("assignFolderSelect");
    const checklist = byId("assignCategoriesChecklist");
    if (!modal) return;

    const history = getHistory();
    const item = history.find((entry) => entry.id === Number(transcriptId));
    if (!item) return;

    if (idInput) idInput.value = item.id;
    if (titleLabel) titleLabel.textContent = item.title || "Sin título";

    // Llenar selector de carpetas
    if (folderSelect) {
        const folders = getFolders();
        folderSelect.innerHTML = `<option value="">(Sin carpeta / Raíz)</option>` + folders.map((f) => `
            <option value="${f.id}" ${item.folderId === f.id ? "selected" : ""}>📁 ${escapeHtml(f.name)}</option>
        `).join("");
    }

    // Llenar checkboxes de categorías
    if (checklist) {
        const categories = getCategories();
        if (categories.length === 0) {
            checklist.innerHTML = `<p class="text-xs text-slate-400 py-2 text-center italic">No hay categorías creadas aún.</p>`;
        } else {
            const currentCats = Array.isArray(item.categories) ? item.categories : [];
            checklist.innerHTML = categories.map((c) => {
                const isChecked = currentCats.includes(c.id);
                const colorCfg = getColorConfig(c.color);
                return `
                    <label class="flex items-center gap-2 p-1.5 rounded hover:bg-white cursor-pointer transition-colors text-sm">
                        <input type="checkbox" name="assignCatCheckbox" value="${c.id}" ${isChecked ? "checked" : ""} class="rounded text-blue-600 focus:ring-blue-500 w-4 h-4">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${colorCfg.bg} ${colorCfg.text} border ${colorCfg.border}">
                            ${escapeHtml(c.name)}
                        </span>
                    </label>
                `;
            }).join("");
        }
    }

    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.remove("opacity-0"), 10);
    rerenderIcons();
}

export function closeAssignModal() {
    const modal = byId("assignModal");
    if (!modal) return;
    modal.classList.add("opacity-0");
    setTimeout(() => modal.classList.add("hidden"), 200);
}

export function handleAssignFormSubmit(event) {
    event.preventDefault();
    const idInput = byId("assignTranscriptId");
    const folderSelect = byId("assignFolderSelect");
    const checkboxes = document.querySelectorAll('input[name="assignCatCheckbox"]:checked');

    const transcriptId = idInput ? idInput.value : "";
    const folderId = folderSelect ? folderSelect.value || null : null;
    const categoryIds = Array.from(checkboxes).map((cb) => cb.value);

    try {
        assignTranscriptOrganization(transcriptId, { folderId, categoryIds });
        closeAssignModal();
        renderHistoryList();
        showToast("Organización guardada.");
    } catch (e) {
        showToast(e.message || "Error al asignar organización.");
    }
}

// ─── Cargar, Descargar y Eliminar Transcripciones ────────────────────────────

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

    const hasValidVideo = item.videoId && item.videoId !== "unknown";
    const defaultThumb = hasValidVideo ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : null;

    state.currentMetadata = {
        videoId: item.videoId || null,
        title: item.title || null,
        authorName: item.authorName || null,
        authorUrl: null,
        thumbnailUrl: item.thumbnailUrl || defaultThumb
    };

    renderVideoMetaPreview(state.currentMetadata);

    if (refs.plainTextOutput) {
        refs.plainTextOutput.textContent = state.finalAiData.formattedText;
    }

    if (refs.aiSummary) {
        renderSummaryContent(refs.aiSummary, state.finalAiData.summary);
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
