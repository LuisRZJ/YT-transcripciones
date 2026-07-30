function getById(id) {
    return document.getElementById(id);
}

export const refs = {
    appHeader: getById("appHeader"),
    appContent: document.querySelector(".app-content"),
    headerMenuBtn: getById("headerMenuBtn"),
    headerMenuPanel: getById("headerMenuPanel"),

    loginView: getById("loginView"),
    loginForm: getById("loginForm"),
    loginSecretInput: getById("loginSecretInput"),
    loginSubmitBtn: getById("loginSubmitBtn"),
    loginErrorMsg: getById("loginErrorMsg"),

    form: getById("transcriptForm"),
    submitBtn: getById("submitBtn"),
    youtubeUrlInput: getById("youtubeUrl"),
    loadingState: getById("loadingState"),
    errorState: getById("errorState"),
    errorMessage: getById("errorMessage"),
    resultsContainer: getById("resultsContainer"),

    aiLoadingState: getById("aiLoadingState"),
    aiProgressText: getById("aiProgressText"),
    aiProgressBar: getById("aiProgressBar"),
    aiResults: getById("aiResults"),
    aiTitle: getById("aiTitle"),
    plainTextOutput: getById("plainTextOutput"),
    aiSummary: getById("aiSummary"),
    jsonOutput: getById("jsonOutput"),
    actionButtonsGroup: getById("actionButtonsGroup"),

    tabText: getById("tab-text"),
    tabJson: getById("tab-json"),
    contentText: getById("content-text"),
    contentJson: getById("content-json"),

    settingsModal: getById("settingsModal"),
    modalApiKey: getById("modalApiKey"),
    modalOrApiKey: getById("modalOrApiKey"),
    modalModelId: getById("modalModelId"),
    modalGoogleAiKey: getById("modalGoogleAiKey"),
    modalAiProviderSelect: getById("modalAiProviderSelect"),
    modalRapidApiKey: getById("modalRapidApiKey"),
    modalAudioFormat: getById("modalAudioFormat"),
    modalAudioQuality: getById("modalAudioQuality"),
    modalSyncSecret: getById("modalSyncSecret"),
    btnCheckUpdates: getById("btnCheckUpdates"),
    iconCheckUpdates: getById("iconCheckUpdates"),
    txtCheckUpdates: getById("txtCheckUpdates"),

    historyModal: getById("historyModal"),
    historyListContainer: getById("historyListContainer"),
    historyItemCount: getById("historyItemCount"),

    cloudRestoreModal: getById("cloudRestoreModal"),
    cloudRestoreModalMsg: getById("cloudRestoreModalMsg"),

    btnBackupCloud: getById("btnBackupCloud"),
    iconBackup: getById("iconBackup"),
    txtBackup: getById("txtBackup"),
    btnImportCloud: getById("btnImportCloud"),
    iconImport: getById("iconImport"),
    txtImport: getById("txtImport"),

    actionPickerModal: getById("actionPickerModal"),

    audioResultContainer: getById("audioResultContainer"),
    audioProgressBar: getById("audioProgressBar"),
    audioProgressText: getById("audioProgressText"),
    audioResultTitle: getById("audioResultTitle"),
    audioResultDuration: getById("audioResultDuration"),
    audioDownloadBtn: getById("audioDownloadBtn"),

    toast: getById("toast")
};

export function byId(id) {
    return getById(id);
}

export function rerenderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
        window.lucide.createIcons();
    }
}
