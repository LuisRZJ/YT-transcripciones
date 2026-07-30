import { refs } from "./dom.js";
import { STORAGE_KEYS, DEFAULT_AUDIO_FORMAT, DEFAULT_AUDIO_QUALITY } from "./state.js";
import { normalizeOpenRouterKey } from "./api-client.js";
import { showToast } from "./ui-actions.js";

export function openSettingsModal() {
    if (!refs.settingsModal) {
        return;
    }

    const savedSdKey = localStorage.getItem(STORAGE_KEYS.supadataApiKey);
    const storedOrKey = localStorage.getItem(STORAGE_KEYS.openrouterApiKey);
    const savedOrKey = normalizeOpenRouterKey(storedOrKey);
    const savedModelId = localStorage.getItem(STORAGE_KEYS.openrouterModelId);
    const savedGoogleKey = localStorage.getItem(STORAGE_KEYS.googleAiStudioApiKey);
    const savedProviderPref = localStorage.getItem(STORAGE_KEYS.aiProviderPreference) || "openrouter";
    const savedRapidApiKey = localStorage.getItem(STORAGE_KEYS.rapidApiKey);
    const savedAudioFormat = localStorage.getItem(STORAGE_KEYS.audioFormat) || DEFAULT_AUDIO_FORMAT;
    const savedAudioQuality = localStorage.getItem(STORAGE_KEYS.audioQuality) || DEFAULT_AUDIO_QUALITY;
    const savedSyKey = localStorage.getItem(STORAGE_KEYS.vercelSyncSecret);

    if (storedOrKey && savedOrKey && storedOrKey !== savedOrKey) {
        localStorage.setItem(STORAGE_KEYS.openrouterApiKey, savedOrKey);
    }

    if (refs.modalApiKey) {
        refs.modalApiKey.value = savedSdKey || "";
    }

    if (refs.modalOrApiKey) {
        refs.modalOrApiKey.value = savedOrKey || "";
    }

    if (refs.modalModelId) {
        refs.modalModelId.value = savedModelId || "";
    }

    if (refs.modalGoogleAiKey) {
        refs.modalGoogleAiKey.value = savedGoogleKey || "";
    }

    if (refs.modalAiProviderSelect) {
        refs.modalAiProviderSelect.value = savedProviderPref;
    }

    if (refs.modalRapidApiKey) {
        refs.modalRapidApiKey.value = savedRapidApiKey || "";
    }

    if (refs.modalAudioFormat) {
        refs.modalAudioFormat.value = savedAudioFormat;
    }

    if (refs.modalAudioQuality) {
        refs.modalAudioQuality.value = savedAudioQuality;
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
    const inputOr = normalizeOpenRouterKey(refs.modalOrApiKey ? refs.modalOrApiKey.value : "");
    const inputModel = refs.modalModelId ? refs.modalModelId.value.trim() : "";
    const inputGoogleKey = refs.modalGoogleAiKey ? refs.modalGoogleAiKey.value.trim() : "";
    const inputProviderPref = refs.modalAiProviderSelect ? refs.modalAiProviderSelect.value : "openrouter";
    const inputRapidApiKey = refs.modalRapidApiKey ? refs.modalRapidApiKey.value.trim() : "";
    const inputAudioFormat = refs.modalAudioFormat ? refs.modalAudioFormat.value : DEFAULT_AUDIO_FORMAT;
    const inputAudioQuality = refs.modalAudioQuality ? refs.modalAudioQuality.value : DEFAULT_AUDIO_QUALITY;
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

    if (refs.modalOrApiKey) {
        refs.modalOrApiKey.value = inputOr;
    }

    if (inputModel) {
        localStorage.setItem(STORAGE_KEYS.openrouterModelId, inputModel);
    } else {
        localStorage.removeItem(STORAGE_KEYS.openrouterModelId);
    }

    if (inputGoogleKey) {
        localStorage.setItem(STORAGE_KEYS.googleAiStudioApiKey, inputGoogleKey);
    } else {
        localStorage.removeItem(STORAGE_KEYS.googleAiStudioApiKey);
    }

    localStorage.setItem(STORAGE_KEYS.aiProviderPreference, inputProviderPref);

    if (inputRapidApiKey) {
        localStorage.setItem(STORAGE_KEYS.rapidApiKey, inputRapidApiKey);
    } else {
        localStorage.removeItem(STORAGE_KEYS.rapidApiKey);
    }

    localStorage.setItem(STORAGE_KEYS.audioFormat, inputAudioFormat);
    localStorage.setItem(STORAGE_KEYS.audioQuality, inputAudioQuality);

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
    localStorage.removeItem(STORAGE_KEYS.googleAiStudioApiKey);
    localStorage.removeItem(STORAGE_KEYS.aiProviderPreference);
    localStorage.removeItem(STORAGE_KEYS.rapidApiKey);
    localStorage.removeItem(STORAGE_KEYS.vercelSyncSecret);

    if (refs.modalApiKey) {
        refs.modalApiKey.value = "";
    }

    if (refs.modalOrApiKey) {
        refs.modalOrApiKey.value = "";
    }

    if (refs.modalGoogleAiKey) {
        refs.modalGoogleAiKey.value = "";
    }

    if (refs.modalAiProviderSelect) {
        refs.modalAiProviderSelect.value = "openrouter";
    }

    if (refs.modalRapidApiKey) {
        refs.modalRapidApiKey.value = "";
    }

    if (refs.modalSyncSecret) {
        refs.modalSyncSecret.value = "";
    }

    showToast("Claves y secretos borrados.");
}
