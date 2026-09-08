import { STORAGE_KEYS } from "./state.js";
import { getHistory, saveHistory } from "./history.js";

export const COLOR_PALETTE = [
    { id: "blue", name: "Azul", bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300", badgeBg: "bg-blue-500" },
    { id: "emerald", name: "Verde", bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", badgeBg: "bg-emerald-500" },
    { id: "purple", name: "Púrpura", bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-300", badgeBg: "bg-purple-500" },
    { id: "amber", name: "Ámbar", bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300", badgeBg: "bg-amber-500" },
    { id: "rose", name: "Rosa", bg: "bg-rose-100", text: "text-rose-800", border: "border-rose-300", badgeBg: "bg-rose-500" },
    { id: "indigo", name: "Índigo", bg: "bg-indigo-100", text: "text-indigo-800", border: "border-indigo-300", badgeBg: "bg-indigo-500" },
    { id: "cyan", name: "Cian", bg: "bg-cyan-100", text: "text-cyan-800", border: "border-cyan-300", badgeBg: "bg-cyan-500" },
    { id: "slate", name: "Gris", bg: "bg-slate-100", text: "text-slate-800", border: "border-slate-300", badgeBg: "bg-slate-500" }
];

export function getColorConfig(colorId) {
    return COLOR_PALETTE.find((c) => c.id === colorId) || COLOR_PALETTE[0];
}

// ─── Carpetas ─────────────────────────────────────────────────────────────

export function getFolders() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.folders);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

export function saveFolders(folders) {
    localStorage.setItem(STORAGE_KEYS.folders, JSON.stringify(folders));
}

export function createFolder(name, color = "blue") {
    const cleanName = String(name || "").trim();
    if (!cleanName) {
        throw new Error("El nombre de la carpeta no puede estar vacío.");
    }

    const folders = getFolders();
    const existing = folders.find((f) => f.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
        throw new Error(`Ya existe una carpeta con el nombre "${cleanName}".`);
    }

    const newFolder = {
        id: `fld_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: cleanName,
        color: color || "blue",
        createdAt: Date.now()
    };

    folders.push(newFolder);
    saveFolders(folders);
    return newFolder;
}

export function updateFolder(id, { name, color }) {
    const folders = getFolders();
    const idx = folders.findIndex((f) => f.id === id);
    if (idx === -1) {
        throw new Error("Carpeta no encontrada.");
    }

    const cleanName = String(name || "").trim();
    if (!cleanName) {
        throw new Error("El nombre de la carpeta no puede estar vacío.");
    }

    const duplicate = folders.find((f) => f.id !== id && f.name.toLowerCase() === cleanName.toLowerCase());
    if (duplicate) {
        throw new Error(`Ya existe otra carpeta con el nombre "${cleanName}".`);
    }

    folders[idx].name = cleanName;
    if (color) {
        folders[idx].color = color;
    }

    saveFolders(folders);
    return folders[idx];
}

/**
 * Elimina una carpeta y gestiona los casos límite de elementos contenidos.
 * @param {string} folderId 
 * @param {"keep-items" | "delete-items"} mode
 */
export function deleteFolder(folderId, mode = "keep-items") {
    const folders = getFolders();
    const filteredFolders = folders.filter((f) => f.id !== folderId);
    saveFolders(filteredFolders);

    const history = getHistory();
    let historyChanged = false;

    if (mode === "delete-items") {
        // Borrar todas las transcripciones pertenecientes a esta carpeta
        const newHistory = history.filter((item) => item.folderId !== folderId);
        if (newHistory.length !== history.length) {
            saveHistory(newHistory);
            historyChanged = true;
        }
    } else {
        // Modo por defecto "keep-items": conservar las transcripciones y desvincularlas a la raíz (null)
        for (const item of history) {
            if (item.folderId === folderId) {
                item.folderId = null;
                item.synced = false; // Marcar para sincronizar cambio en la nube
                historyChanged = true;
            }
        }
        if (historyChanged) {
            saveHistory(history);
        }
    }

    return { historyChanged };
}

// ─── Categorías ───────────────────────────────────────────────────────────

export function getCategories() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.categories);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

export function saveCategories(categories) {
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories));
}

export function createCategory(name, color = "purple") {
    const cleanName = String(name || "").trim();
    if (!cleanName) {
        throw new Error("El nombre de la categoría no puede estar vacío.");
    }

    const categories = getCategories();
    const existing = categories.find((c) => c.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
        throw new Error(`Ya existe una categoría con el nombre "${cleanName}".`);
    }

    const newCategory = {
        id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: cleanName,
        color: color || "purple",
        createdAt: Date.now()
    };

    categories.push(newCategory);
    saveCategories(categories);
    return newCategory;
}

export function updateCategory(id, { name, color }) {
    const categories = getCategories();
    const idx = categories.findIndex((c) => c.id === id);
    if (idx === -1) {
        throw new Error("Categoría no encontrada.");
    }

    const cleanName = String(name || "").trim();
    if (!cleanName) {
        throw new Error("El nombre de la categoría no puede estar vacío.");
    }

    const duplicate = categories.find((c) => c.id !== id && c.name.toLowerCase() === cleanName.toLowerCase());
    if (duplicate) {
        throw new Error(`Ya existe otra categoría con el nombre "${cleanName}".`);
    }

    categories[idx].name = cleanName;
    if (color) {
        categories[idx].color = color;
    }

    saveCategories(categories);
    return categories[idx];
}

export function deleteCategory(categoryId) {
    const categories = getCategories();
    const filteredCategories = categories.filter((c) => c.id !== categoryId);
    saveCategories(filteredCategories);

    // Retirar la categoría de las transcripciones que la tengan asignada
    const history = getHistory();
    let historyChanged = false;

    for (const item of history) {
        if (Array.isArray(item.categories) && item.categories.includes(categoryId)) {
            item.categories = item.categories.filter((catId) => catId !== categoryId);
            item.synced = false;
            historyChanged = true;
        }
    }

    if (historyChanged) {
        saveHistory(history);
    }

    return { historyChanged };
}

// ─── Asignación de transcripciones ──────────────────────────────────────────

export function assignTranscriptOrganization(transcriptId, { folderId, categoryIds }) {
    const history = getHistory();
    const numId = Number(transcriptId);
    const item = history.find((entry) => entry.id === numId);
    if (!item) {
        throw new Error("Transcripción no encontrada.");
    }

    item.folderId = folderId || null;
    item.categories = Array.isArray(categoryIds) ? categoryIds : [];
    item.synced = false; // Requiere re-sincronización a la nube

    saveHistory(history);
    return item;
}

// ─── Conteos y Utilidades ───────────────────────────────────────────────────

export function countTranscriptsInFolder(folderId) {
    const history = getHistory();
    return history.filter((item) => item.folderId === folderId).length;
}

export function countTranscriptsWithoutFolder() {
    const history = getHistory();
    return history.filter((item) => !item.folderId).length;
}

export function countTranscriptsInCategory(categoryId) {
    const history = getHistory();
    return history.filter((item) => Array.isArray(item.categories) && item.categories.includes(categoryId)).length;
}
