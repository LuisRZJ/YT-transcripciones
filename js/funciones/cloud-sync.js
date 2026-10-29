import { byId, refs, rerenderIcons } from "./dom.js";
import { state, STORAGE_KEYS } from "./state.js";
import { normalizeOpenRouterKey } from "./api-client.js";
import { showToast } from "./ui-actions.js";
import { getHistory, openHistoryModal, renderHistoryList, saveHistory } from "./history.js";
import { getFolders, saveFolders, getCategories, saveCategories } from "./taxonomy.js";
import { renderDashboard } from "./dashboard.js";

let pendingCloudUpdates = [];

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function updateActionButtonState({ button, textNode, iconId, idleIcon, message, isSpinning }) {
    if (!button || !textNode) {
        return;
    }

    textNode.textContent = message;
    button.disabled = isSpinning;

    const icon = byId(iconId);
    if (icon) {
        icon.classList.remove("animate-spin");
        icon.setAttribute("data-lucide", isSpinning ? "loader-2" : idleIcon);
        if (isSpinning) {
            icon.classList.add("animate-spin");
        }
    }

    rerenderIcons();

    const renderedIcon = byId(iconId);
    if (renderedIcon) {
        renderedIcon.classList.remove("animate-spin");
        if (isSpinning) {
            renderedIcon.classList.add("animate-spin");
        }
    }
}

function setImportUiState(message, isSpinning = true) {
    updateActionButtonState({
        button: refs.btnImportCloud,
        textNode: refs.txtImport,
        iconId: "iconImport",
        idleIcon: "cloud-download",
        message,
        isSpinning
    });
}

function setBackupUiState(message, isSpinning = true) {
    updateActionButtonState({
        button: refs.btnBackupCloud,
        textNode: refs.txtBackup,
        iconId: "iconBackup",
        idleIcon: "cloud-upload",
        message,
        isSpinning
    });
}

function setCloudRestoreModalVisibility(isVisible) {
    if (!refs.cloudRestoreModal) {
        return;
    }

    state.cloudRestore.isVisible = isVisible;

    if (isVisible) {
        refs.cloudRestoreModal.classList.remove("hidden");
        refs.cloudRestoreModal.classList.add("flex");
        document.body.style.overflow = "hidden";
    } else {
        refs.cloudRestoreModal.classList.remove("flex");
        refs.cloudRestoreModal.classList.add("hidden");
        document.body.style.overflow = "";
    }

    rerenderIcons();
}

function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

async function getCloudRestoreData(syncSecret) {
    const listRes = await fetch("/api/pull", {
        method: "GET",
        headers: { Authorization: `Bearer ${syncSecret}` }
    });

    if (!listRes.ok) {
        return null;
    }

    const listData = await listRes.json();
    const cloudIds = (listData.fileIds || []).filter((id) => id !== "_api_keys" && id !== "_taxonomy");

    if (cloudIds.length === 0) {
        return null;
    }

    const localVideoIds = getHistory().map((item) => item.videoId);
    const missingLocally = cloudIds.filter((id) => !localVideoIds.includes(id));

    return {
        totalCount: cloudIds.length,
        missingCount: missingLocally.length,
        missingIds: missingLocally
    };
}

function showCloudRestoreModal(missingCount, totalCount) {
    if (!refs.cloudRestoreModalMsg) {
        return;
    }

    state.cloudRestore.missingCount = missingCount;
    state.cloudRestore.totalCount = totalCount;

    refs.cloudRestoreModalMsg.textContent = `Se encontraron ${totalCount} transcripción(es) en tu respaldo, de las cuales ${missingCount} no están en este navegador.`;
    setCloudRestoreModalVisibility(true);
}

function hideCloudRestoreModal() {
    setCloudRestoreModalVisibility(false);
}

export function isCloudRestoreModalOpen() {
    return state.cloudRestore.isVisible;
}

export async function checkCloudSyncStatus(providedSecret) {
    const syncSecret = providedSecret || localStorage.getItem(STORAGE_KEYS.vercelSyncSecret);
    const localHistory = getHistory();
    const pendingPush = localHistory.filter((item) => item.synced !== true && item.videoId !== "unknown").length;
    state.syncStatus.pendingPushCount = pendingPush;

    if (!syncSecret) {
        state.syncStatus.pendingPullCount = 0;
        state.syncStatus.isChecking = false;
        renderDashboard();
        return;
    }

    state.syncStatus.isChecking = true;
    renderDashboard();

    try {
        const restoreData = await getCloudRestoreData(syncSecret);
        if (restoreData) {
            state.syncStatus.pendingPullCount = restoreData.missingCount || 0;
            state.syncStatus.lastCheckedAt = Date.now();
        } else {
            state.syncStatus.pendingPullCount = 0;
        }
    } catch (e) {
        // Fallo silencioso
    } finally {
        state.syncStatus.isChecking = false;
        renderDashboard();
    }
}

export async function checkCloudOnSecretSave(syncSecret) {
    if (!syncSecret) {
        checkCloudSyncStatus();
        return;
    }

    await checkCloudSyncStatus(syncSecret);
    if (state.syncStatus.pendingPullCount > 0) {
        showCloudRestoreModal(state.syncStatus.pendingPullCount, state.cloudRestore.totalCount);
    }
}
export async function checkCloudOnPageLoad() {
    const syncSecret = localStorage.getItem(STORAGE_KEYS.vercelSyncSecret);
    if (!syncSecret) {
        checkCloudSyncStatus();
        return;
    }

    await checkCloudSyncStatus(syncSecret);
    if (state.syncStatus.pendingPullCount > 0 && !isCloudRestoreModalOpen()) {
        showCloudRestoreModal(state.syncStatus.pendingPullCount, state.cloudRestore.totalCount);
    }
}

export function continueWithLocalData() {
    hideCloudRestoreModal();
    showToast("Continuando con datos locales. Puedes restaurar desde Historial cuando quieras.");
}

export async function restoreFromCloud() {
    hideCloudRestoreModal();
    openHistoryModal();
    await importFromCloud();
}

export async function importFromCloud() {
    const syncSecret = localStorage.getItem(STORAGE_KEYS.vercelSyncSecret);
    if (!syncSecret) {
        setImportUiState("Importar desde Nube", false);
        showToast("Falta el Secret de Vercel. Configúralo en Ajustes.");
        return;
    }

    setImportUiState("Verificando...");
    let localHistory = getHistory();

    try {
        const listRes = await fetch("/api/pull", {
            headers: { Authorization: `Bearer ${syncSecret}` }
        });

        if (!listRes.ok) {
            throw new Error("Error listando archivos en la nube");
        }

        const listData = await listRes.json();
        const cloudIdsRaw = listData.fileIds || [];

        let keysImported = false;
        const keysIndex = cloudIdsRaw.indexOf("_api_keys");
        if (keysIndex !== -1) {
            cloudIdsRaw.splice(keysIndex, 1);
            try {
                const pullRes = await fetch("/api/pull?id=_api_keys", {
                    headers: { Authorization: `Bearer ${syncSecret}` }
                });

                if (pullRes.ok) {
                    const pullData = await pullRes.json();
                    const keyData = pullData.data || {};

                    const hasSupadata = hasOwn(keyData, "supadata_api_key");
                    const hasOpenrouter = hasOwn(keyData, "openrouter_api_key");
                    const hasModelId = hasOwn(keyData, "openrouter_model_id");
                    const hasGoogleKey = hasOwn(keyData, "google_ai_studio_api_key");
                    const hasProviderPref = hasOwn(keyData, "ai_provider_preference");
                    const hasRapidApiKey = hasOwn(keyData, "rapidapi_key");
                    const hasAudioFormat = hasOwn(keyData, "audio_format");
                    const hasAudioQuality = hasOwn(keyData, "audio_quality");

                    if (hasSupadata) {
                        if (keyData.supadata_api_key) {
                            localStorage.setItem(STORAGE_KEYS.supadataApiKey, keyData.supadata_api_key);
                        } else {
                            localStorage.removeItem(STORAGE_KEYS.supadataApiKey);
                        }
                    }

                    if (hasOpenrouter) {
                        const normalizedCloudOrKey = normalizeOpenRouterKey(keyData.openrouter_api_key);
                        if (normalizedCloudOrKey) {
                            localStorage.setItem(STORAGE_KEYS.openrouterApiKey, normalizedCloudOrKey);
                        } else {
                            localStorage.removeItem(STORAGE_KEYS.openrouterApiKey);
                        }
                    }

                    if (hasModelId) {
                        if (keyData.openrouter_model_id) {
                            localStorage.setItem(STORAGE_KEYS.openrouterModelId, keyData.openrouter_model_id);
                        } else {
                            localStorage.removeItem(STORAGE_KEYS.openrouterModelId);
                        }
                    }

                    if (hasGoogleKey) {
                        if (keyData.google_ai_studio_api_key) {
                            localStorage.setItem(STORAGE_KEYS.googleAiStudioApiKey, keyData.google_ai_studio_api_key);
                        } else {
                            localStorage.removeItem(STORAGE_KEYS.googleAiStudioApiKey);
                        }
                    }

                    if (hasProviderPref) {
                        if (keyData.ai_provider_preference) {
                            localStorage.setItem(STORAGE_KEYS.aiProviderPreference, keyData.ai_provider_preference);
                        } else {
                            localStorage.removeItem(STORAGE_KEYS.aiProviderPreference);
                        }
                    }

                    if (hasRapidApiKey) {
                        if (keyData.rapidapi_key) {
                            localStorage.setItem(STORAGE_KEYS.rapidApiKey, keyData.rapidapi_key);
                        } else {
                            localStorage.removeItem(STORAGE_KEYS.rapidApiKey);
                        }
                    }

                    if (hasAudioFormat && keyData.audio_format) {
                        localStorage.setItem(STORAGE_KEYS.audioFormat, keyData.audio_format);
                    }

                    if (hasAudioQuality && keyData.audio_quality) {
                        localStorage.setItem(STORAGE_KEYS.audioQuality, keyData.audio_quality);
                    }

                    keysImported = hasSupadata || hasOpenrouter || hasModelId || hasGoogleKey || hasProviderPref || hasRapidApiKey;
                }
            } catch (e) {
                console.error("Error importando claves API", e);
            }
        }

        // 1.5. Importar Taxonomía (Carpetas y Categorías)
        const hasTaxonomyInCloud = cloudIdsRaw.includes("_taxonomy");
        let taxonomyImported = false;
        if (hasTaxonomyInCloud) {
            try {
                const taxRes = await fetch("/api/pull?id=_taxonomy", {
                    headers: { Authorization: `Bearer ${syncSecret}` }
                });
                if (taxRes.ok) {
                    const taxJson = await taxRes.json();
                    const taxData = taxJson.data || {};

                    if (Array.isArray(taxData.folders)) {
                        const localFolders = getFolders();
                        const mergedFolders = [...localFolders];
                        for (const rf of taxData.folders) {
                            if (!mergedFolders.some((lf) => lf.id === rf.id)) {
                                mergedFolders.push(rf);
                            }
                        }
                        saveFolders(mergedFolders);
                    }

                    if (Array.isArray(taxData.categories)) {
                        const localCategories = getCategories();
                        const mergedCategories = [...localCategories];
                        for (const rc of taxData.categories) {
                            if (!mergedCategories.some((lc) => lc.id === rc.id)) {
                                mergedCategories.push(rc);
                            }
                        }
                        saveCategories(mergedCategories);
                    }
                    taxonomyImported = true;
                }
            } catch (e) {
                console.error("Error importando taxonomía desde la nube", e);
            }
        }

        const cloudIds = cloudIdsRaw.filter((id) => id !== "_taxonomy");

        if (cloudIds.length === 0) {
            setImportUiState("Sin datos", false);
            if (taxonomyImported) {
                renderHistoryList();
                showToast("✓ Organización (carpetas/categorías) restaurada desde la nube.");
            } else if (keysImported) {
                showToast("Ajustes de IA restaurados, pero no hay transcripciones que importar.");
            } else {
                showToast("La nube está vacía. No hay datos que importar.");
            }
            setTimeout(() => setImportUiState("Importar desde Nube", false), 3000);
            return;
        }

        const localMap = Object.fromEntries(localHistory.map((item) => [item.videoId, item]));
        const missingLocally = cloudIds.filter((id) => !localMap[id]);
        const overlap = cloudIds.filter((id) => localMap[id]);
        let importedCount = 0;
        const newerInCloud = [];

        if (missingLocally.length > 0) {
            setImportUiState(`Importando ${missingLocally.length}...`);
            for (const pullId of missingLocally) {
                try {
                    const pullRes = await fetch(`/api/pull?id=${pullId}`, {
                        headers: { Authorization: `Bearer ${syncSecret}` }
                    });

                    const pullData = await pullRes.json();
                    if (pullData.data) {
                        pullData.data.synced = true;
                        localHistory.push(pullData.data);
                        importedCount++;
                    }
                } catch (e) {
                    console.error(`Error descargando ${pullId}`, e);
                }
            }

            localHistory.sort((a, b) => b.id - a.id);
            saveHistory(localHistory);
            renderHistoryList();
        } else if (taxonomyImported) {
            renderHistoryList();
        }

        if (overlap.length > 0) {
            setImportUiState("Comparando versiones...");
            for (const videoId of overlap) {
                try {
                    const res = await fetch(`/api/pull?id=${videoId}`, {
                        headers: { Authorization: `Bearer ${syncSecret}` }
                    });

                    if (!res.ok) {
                        continue;
                    }

                    const pulled = await res.json();
                    const cloudItem = pulled.data;
                    if (cloudItem && cloudItem.id > localMap[videoId].id) {
                        newerInCloud.push({ videoId, cloudItem, localItem: localMap[videoId] });
                    }
                } catch (e) {
                    // Ignorar errores puntuales de item.
                }
            }
        }

        setImportUiState("Listo", false);

        if (importedCount === 0 && newerInCloud.length === 0) {
            if (keysImported && taxonomyImported) {
                showToast("✓ Ajustes y organización restaurados desde la nube.");
            } else if (taxonomyImported) {
                showToast("✓ Organización (carpetas/categorías) restaurada desde la nube.");
            } else if (keysImported) {
                showToast("✓ Todo está al día. Se restauraron ajustes de IA.");
            } else {
                showToast("✓ Todo está al día. No hay datos nuevos en la nube.");
            }
        } else {
            let message = "";
            if (importedCount > 0) {
                message += `${importedCount} transcripción(es) nuevas importadas. `;
            }
            if (taxonomyImported) {
                message += "Organización restaurada. ";
            }
            if (keysImported) {
                message += "Ajustes de IA restaurados.";
            }
            if (message) {
                showToast(message.trim());
            }
            if (newerInCloud.length > 0) {
                showCloudUpdatesBanner(newerInCloud);
            }
        }

        setTimeout(() => setImportUiState("Importar desde Nube", false), 3000);
    } catch (err) {
        console.error("Error en importación:", err);
        setImportUiState("Error", false);
        showToast("Error al conectar con la nube.");
        setTimeout(() => setImportUiState("Importar desde Nube", false), 3000);
    }
}

export function showCloudUpdatesBanner(newerItems) {
    if (!refs.historyListContainer) {
        return;
    }

    const existing = byId("cloudUpdatesBanner");
    if (existing) {
        existing.remove();
    }

    const banner = document.createElement("div");
    banner.id = "cloudUpdatesBanner";
    banner.className = "bg-sky-50 border-2 border-sky-300 rounded-lg p-4 flex items-start gap-3 shrink-0";

    const itemsList = newerItems
        .map((item) => `<li class="truncate">${escapeHtml(item.cloudItem.title || item.videoId)}</li>`)
        .join("");

    banner.innerHTML = `
        <i data-lucide="cloud-download" class="w-5 h-5 text-sky-600 shrink-0 mt-0.5"></i>
        <div class="flex-1">
            <p class="text-sm font-bold text-sky-900">${newerItems.length} transcripción(es) con versión más reciente en la nube</p>
            <ul class="text-xs text-sky-800 mt-1.5 space-y-0.5 list-disc list-inside">
                ${itemsList}
            </ul>
            <div class="flex gap-2 mt-3 flex-wrap">
                <button type="button" data-action="cloud-updates-apply" class="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded transition-colors flex items-center gap-1.5">
                    <i data-lucide="download" class="w-3.5 h-3.5"></i> Actualizar todos (${newerItems.length})
                </button>
                <button type="button" data-action="cloud-updates-dismiss" class="px-3 py-1.5 bg-white hover:bg-sky-50 text-sky-700 font-medium text-xs rounded transition-colors border border-sky-200">
                    Descartar
                </button>
            </div>
        </div>
    `;

    pendingCloudUpdates = newerItems;
    refs.historyListContainer.prepend(banner);
    rerenderIcons();
}

export function dismissCloudUpdatesBanner() {
    const existing = byId("cloudUpdatesBanner");
    if (existing) {
        existing.remove();
    }
    pendingCloudUpdates = [];
}

export function applyAllCloudUpdates() {
    if (pendingCloudUpdates.length === 0) {
        return;
    }

    const history = getHistory();
    for (const { videoId, cloudItem } of pendingCloudUpdates) {
        const idx = history.findIndex((item) => item.videoId === videoId);
        if (idx !== -1) {
            cloudItem.synced = true;
            history[idx] = cloudItem;
        }
    }

    const updatedCount = pendingCloudUpdates.length;
    saveHistory(history);
    pendingCloudUpdates = [];
    renderHistoryList();
    showToast(`${updatedCount} transcripción(es) actualizadas desde la nube.`);
}

export async function backupToCloud() {
    const syncSecret = localStorage.getItem(STORAGE_KEYS.vercelSyncSecret);
    if (!syncSecret) {
        setBackupUiState("Respaldar", false);
        showToast("Falta el Secret de Vercel. Configúralo en el panel de Ajustes.");
        return;
    }

    const localHistory = getHistory();
    const pendingPush = localHistory.filter((item) => item.synced !== true && item.videoId !== "unknown");

    setBackupUiState("Respaldando ajustes...");

    let keysBackedUp = false;
    try {
        const sApiKey = localStorage.getItem(STORAGE_KEYS.supadataApiKey);
        const orApiKey = normalizeOpenRouterKey(localStorage.getItem(STORAGE_KEYS.openrouterApiKey));
        const modelId = localStorage.getItem(STORAGE_KEYS.openrouterModelId);
        const googleKey = localStorage.getItem(STORAGE_KEYS.googleAiStudioApiKey);
        const providerPref = localStorage.getItem(STORAGE_KEYS.aiProviderPreference) || "openrouter";
        const rapidKey = localStorage.getItem(STORAGE_KEYS.rapidApiKey);
        const audioFormat = localStorage.getItem(STORAGE_KEYS.audioFormat) || "mp3";
        const audioQuality = localStorage.getItem(STORAGE_KEYS.audioQuality) || "128";

        const res = await fetch("/api/push", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${syncSecret}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                videoId: "_api_keys",
                data: {
                    supadata_api_key: sApiKey || null,
                    openrouter_api_key: orApiKey || null,
                    openrouter_model_id: modelId || null,
                    google_ai_studio_api_key: googleKey || null,
                    ai_provider_preference: providerPref,
                    rapidapi_key: rapidKey || null,
                    audio_format: audioFormat,
                    audio_quality: audioQuality
                }
            })
        });

        if (res.ok) {
            keysBackedUp = true;
        }
    } catch (e) {
        console.error("Error subiendo claves API", e);
    }

    // Respaldar Taxonomía (Carpetas y Categorías)
    let taxonomyBackedUp = false;
    try {
        const localFolders = getFolders();
        const localCategories = getCategories();
        const taxRes = await fetch("/api/push", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${syncSecret}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                videoId: "_taxonomy",
                data: {
                    folders: localFolders,
                    categories: localCategories,
                    updatedAt: Date.now()
                }
            })
        });
        if (taxRes.ok) {
            taxonomyBackedUp = true;
        }
    } catch (e) {
        console.error("Error subiendo taxonomía a la nube", e);
    }

    if (pendingPush.length === 0) {
        if (keysBackedUp || taxonomyBackedUp) {
            showToast("✓ Ajustes y organización respaldados exitosamente. Las transcripciones ya están al día.");
        } else {
            showToast("✓ Todo está respaldado. No hay nada nuevo que subir.");
        }
        setBackupUiState("Respaldar", false);
        return;
    }

    setBackupUiState(`Subiendo 0/${pendingPush.length}...`);

    try {
        let count = 0;
        for (const item of pendingPush) {
            count++;
            setBackupUiState(`Subiendo ${count}/${pendingPush.length}...`);
            try {
                const pushRes = await fetch("/api/push", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${syncSecret}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ videoId: item.videoId, data: item })
                });

                if (pushRes.ok) {
                    item.synced = true;
                }
            } catch (e) {
                console.error(`Error subiendo ${item.videoId}`, e);
            }
        }

        saveHistory(localHistory);
        renderHistoryList();
        setBackupUiState("¡Respaldado!", false);
        showToast(`${pendingPush.length} transcripción(es) respaldadas en la nube.`);
        setTimeout(() => setBackupUiState("Respaldar", false), 3000);
    } catch (err) {
        console.error("Error en backup:", err);
        setBackupUiState("Error", false);
        showToast("Ocurrió un error al respaldar.");
        setTimeout(() => setBackupUiState("Respaldar", false), 3000);
    }
}
/**
 * Sincronización bidireccional interactiva activada desde la tarjeta del Dashboard.
 * Realiza descarga (pull) de elementos remotos faltantes y subida (push) de pendientes locales,
 * reportando el avance en tiempo real en la tarjeta.
 */
export async function syncBidirectionalFromDashboard() {
    const syncSecret = localStorage.getItem(STORAGE_KEYS.vercelSyncSecret);
    if (!syncSecret) {
        showToast("Falta el Secret de Vercel. Configúralo en Ajustes.");
        const { openSettingsModal } = await import("./settings.js");
        openSettingsModal();
        return;
    }

    if (state.syncStatus.isSyncing) {
        return;
    }

    state.syncStatus.isSyncing = true;
    state.syncStatus.currentStep = "Comprobando nube...";
    renderDashboard();

    try {
        // 1. Fase de Descarga (PULL)
        const listRes = await fetch("/api/pull", {
            headers: { Authorization: `Bearer ${syncSecret}` }
        });

        if (!listRes.ok) {
            throw new Error(`Error conectando con la nube (HTTP ${listRes.status})`);
        }

        const listData = await listRes.json();
        const cloudIdsRaw = listData.fileIds || [];

        // 1.1 Descargar claves si existen
        const keysIndex = cloudIdsRaw.indexOf("_api_keys");
        if (keysIndex !== -1) {
            cloudIdsRaw.splice(keysIndex, 1);
            try {
                const pullRes = await fetch("/api/pull?id=_api_keys", {
                    headers: { Authorization: `Bearer ${syncSecret}` }
                });
                if (pullRes.ok) {
                    const pullData = await pullRes.json();
                    const keyData = pullData.data || {};
                    if (hasOwn(keyData, "supadata_api_key") && keyData.supadata_api_key) {
                        localStorage.setItem(STORAGE_KEYS.supadataApiKey, keyData.supadata_api_key);
                    }
                    if (hasOwn(keyData, "openrouter_api_key") && keyData.openrouter_api_key) {
                        localStorage.setItem(STORAGE_KEYS.openrouterApiKey, keyData.openrouter_api_key);
                    }
                    if (hasOwn(keyData, "openrouter_model_id") && keyData.openrouter_model_id) {
                        localStorage.setItem(STORAGE_KEYS.openrouterModelId, keyData.openrouter_model_id);
                    }
                    if (hasOwn(keyData, "google_ai_studio_api_key") && keyData.google_ai_studio_api_key) {
                        localStorage.setItem(STORAGE_KEYS.googleAiStudioApiKey, keyData.google_ai_studio_api_key);
                    }
                    if (hasOwn(keyData, "ai_provider_preference") && keyData.ai_provider_preference) {
                        localStorage.setItem(STORAGE_KEYS.aiProviderPreference, keyData.ai_provider_preference);
                    }
                    if (hasOwn(keyData, "rapidapi_key") && keyData.rapidapi_key) {
                        localStorage.setItem(STORAGE_KEYS.rapidApiKey, keyData.rapidapi_key);
                    }
                    if (hasOwn(keyData, "audio_format") && keyData.audio_format) {
                        localStorage.setItem(STORAGE_KEYS.audioFormat, keyData.audio_format);
                    }
                    if (hasOwn(keyData, "audio_quality") && keyData.audio_quality) {
                        localStorage.setItem(STORAGE_KEYS.audioQuality, keyData.audio_quality);
                    }
                }
            } catch (e) {
                // Continuar si falla
            }
        }

        // 1.2 Descargar taxonomía si existe
        const taxIndex = cloudIdsRaw.indexOf("_taxonomy");
        if (taxIndex !== -1) {
            cloudIdsRaw.splice(taxIndex, 1);
            try {
                const taxRes = await fetch("/api/pull?id=_taxonomy", {
                    headers: { Authorization: `Bearer ${syncSecret}` }
                });
                if (taxRes.ok) {
                    const taxJson = await taxRes.json();
                    const taxData = taxJson.data || {};
                    if (Array.isArray(taxData.folders)) {
                        const localFolders = getFolders();
                        const mergedFolders = [...localFolders];
                        for (const rF of taxData.folders) {
                            if (!mergedFolders.some((lf) => lf.id === rF.id)) {
                                mergedFolders.push(rF);
                            }
                        }
                        saveFolders(mergedFolders);
                    }
                    if (Array.isArray(taxData.categories)) {
                        const localCats = getCategories();
                        const mergedCats = [...localCats];
                        for (const rC of taxData.categories) {
                            if (!mergedCats.some((lc) => lc.id === rC.id)) {
                                mergedCats.push(rC);
                            }
                        }
                        saveCategories(mergedCats);
                    }
                }
            } catch (e) {
                // Continuar si falla
            }
        }

        // 1.3 Descargar transcripciones remotas faltantes
        let localHistory = getHistory();
        const localVideoIds = new Set(localHistory.map((item) => item.videoId));
        const missingLocally = cloudIdsRaw.filter((id) => !localVideoIds.has(id));

        for (let i = 0; i < missingLocally.length; i++) {
            const pullId = missingLocally[i];
            state.syncStatus.currentStep = `Descargando ${i + 1}/${missingLocally.length}...`;
            renderDashboard();

            try {
                const pullRes = await fetch(`/api/pull?id=${pullId}`, {
                    headers: { Authorization: `Bearer ${syncSecret}` }
                });
                if (pullRes.ok) {
                    const pullData = await pullRes.json();
                    if (pullData.data) {
                        const importedItem = {
                            ...pullData.data,
                            synced: true,
                            id: pullData.data.id || `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
                        };
                        localHistory.push(importedItem);
                        saveHistory(localHistory);
                    }
                }
            } catch (err) {
                console.warn(`Error al descargar ${pullId}:`, err);
            }
        }

        // 2. Fase de Subida (PUSH)
        state.syncStatus.currentStep = "Respaldando ajustes...";
        renderDashboard();

        try {
            const sApiKey = localStorage.getItem(STORAGE_KEYS.supadataApiKey);
            const orApiKey = normalizeOpenRouterKey(localStorage.getItem(STORAGE_KEYS.openrouterApiKey));
            const modelId = localStorage.getItem(STORAGE_KEYS.openrouterModelId);
            const googleKey = localStorage.getItem(STORAGE_KEYS.googleAiStudioApiKey);
            const providerPref = localStorage.getItem(STORAGE_KEYS.aiProviderPreference) || "openrouter";
            const rapidKey = localStorage.getItem(STORAGE_KEYS.rapidApiKey);
            const audioFormat = localStorage.getItem(STORAGE_KEYS.audioFormat) || "mp3";
            const audioQuality = localStorage.getItem(STORAGE_KEYS.audioQuality) || "128";

            await fetch("/api/push", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${syncSecret}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    videoId: "_api_keys",
                    data: {
                        supadata_api_key: sApiKey || null,
                        openrouter_api_key: orApiKey || null,
                        openrouter_model_id: modelId || null,
                        google_ai_studio_api_key: googleKey || null,
                        ai_provider_preference: providerPref,
                        rapidapi_key: rapidKey || null,
                        audio_format: audioFormat,
                        audio_quality: audioQuality
                    }
                })
            });
        } catch (e) {
            // Continuar
        }

        try {
            const localFolders = getFolders();
            const localCategories = getCategories();
            await fetch("/api/push", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${syncSecret}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    videoId: "_taxonomy",
                    data: {
                        folders: localFolders,
                        categories: localCategories
                    }
                })
            });
        } catch (e) {
            // Continuar
        }

        localHistory = getHistory();
        const pendingPush = localHistory.filter((item) => item.synced !== true && item.videoId !== "unknown");

        for (let j = 0; j < pendingPush.length; j++) {
            const item = pendingPush[j];
            state.syncStatus.currentStep = `Subiendo ${j + 1}/${pendingPush.length}...`;
            renderDashboard();

            try {
                const pushRes = await fetch("/api/push", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${syncSecret}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ videoId: item.videoId, data: item })
                });

                if (pushRes.ok) {
                    item.synced = true;
                    saveHistory(localHistory);
                }
            } catch (err) {
                console.warn(`Error al subir ${item.videoId}:`, err);
            }
        }

        state.syncStatus.pendingPushCount = localHistory.filter((item) => item.synced !== true && item.videoId !== "unknown").length;
        state.syncStatus.pendingPullCount = 0;
        state.syncStatus.currentStep = "";
        state.syncStatus.lastCheckedAt = Date.now();
        showToast("¡Sincronización en la nube completada con éxito!");
    } catch (err) {
        showToast(`Error al sincronizar: ${err.message || "Error de red"}`);
    } finally {
        state.syncStatus.isSyncing = false;
        state.syncStatus.isChecking = false;
        state.syncStatus.currentStep = "";
        renderDashboard();
        renderHistoryList();
    }
}
