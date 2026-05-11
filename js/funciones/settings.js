import { refs } from "./dom.js";
import { STORAGE_KEYS } from "./state.js";
import { showToast } from "./ui-actions.js";

export function openSettingsModal() {
    if (!refs.settingsModal) {
        return;
    }

    const savedSdKey = localStorage.getItem(STORAGE_KEYS.supadataApiKey);
    const savedOrKey = localStorage.getItem(STORAGE_KEYS.openrouterApiKey);
    const savedModelId = localStorage.getItem(STORAGE_KEYS.openrouterModelId);
    const savedSyKey = localStorage.getItem(STORAGE_KEYS.vercelSyncSecret);

    if (refs.modalApiKey) {
        refs.modalApiKey.value = savedSdKey || "";
    }

    if (refs.modalOrApiKey) {
        refs.modalOrApiKey.value = savedOrKey || "";
    }

    if (refs.modalModelId) {
        refs.modalModelId.value = savedModelId || "";
    }

    if (refs.modalSyncSecret) {
        refs.modalSyncSecret.value = savedSyKey || "";
    }

    refs.settingsModal.classList.remove("hidden");
    setTimeout(() => {
        refs.settingsModal.classList.remove("opacity-0");
        const panel = refs.settingsModal.querySelector("div");
        if (panel) {
            panel.classList.remove("scale-95");
        }
    }, 10);
}

export function closeSettingsModal() {
    if (!refs.settingsModal) {
        return;
    }

    refs.settingsModal.classList.add("opacity-0");
    const panel = refs.settingsModal.querySelector("div");
    if (panel) {
        panel.classList.add("scale-95");
    }

    setTimeout(() => {
        refs.settingsModal.classList.add("hidden");
    }, 300);
}

export function saveApiKey(onSyncSecretChanged) {
    const inputSd = refs.modalApiKey ? refs.modalApiKey.value.trim() : "";
    const inputOr = refs.modalOrApiKey ? refs.modalOrApiKey.value.trim() : "";
    const inputModel = refs.modalModelId ? refs.modalModelId.value.trim() : "";
    const inputSy = refs.modalSyncSecret ? refs.modalSyncSecret.value.trim() : "";

    const prevSyncSecret = localStorage.getItem(STORAGE_KEYS.vercelSyncSecret);

    if (inputSd) {
        localStorage.setItem(STORAGE_KEYS.supadataApiKey, inputSd);
    } else {
        localStorage.removeItem(STORAGE_KEYS.supadataApiKey);
    }

    if (inputOr) {
        localStorage.setItem(STORAGE_KEYS.openrouterApiKey, inputOr);
    } else {
        localStorage.removeItem(STORAGE_KEYS.openrouterApiKey);
    }

    if (inputModel) {
        localStorage.setItem(STORAGE_KEYS.openrouterModelId, inputModel);
    } else {
        localStorage.removeItem(STORAGE_KEYS.openrouterModelId);
    }

    if (inputSy) {
        localStorage.setItem(STORAGE_KEYS.vercelSyncSecret, inputSy);
    } else {
        localStorage.removeItem(STORAGE_KEYS.vercelSyncSecret);
    }

    closeSettingsModal();
    showToast("Ajustes guardados correctamente.");

    if (inputSy && inputSy !== prevSyncSecret && typeof onSyncSecretChanged === "function") {
        onSyncSecretChanged(inputSy);
    }
}

export function deleteApiKey() {
    localStorage.removeItem(STORAGE_KEYS.supadataApiKey);
    localStorage.removeItem(STORAGE_KEYS.openrouterApiKey);
    localStorage.removeItem(STORAGE_KEYS.vercelSyncSecret);

    if (refs.modalApiKey) {
        refs.modalApiKey.value = "";
    }

    if (refs.modalOrApiKey) {
        refs.modalOrApiKey.value = "";
    }

    if (refs.modalSyncSecret) {
        refs.modalSyncSecret.value = "";
    }

    showToast("Claves y secretos borrados.");
}
