export const STORAGE_KEYS = {
    supadataApiKey: "supadata_api_key",
    openrouterApiKey: "openrouter_api_key",
    openrouterModelId: "openrouter_model_id",
    vercelSyncSecret: "vercel_sync_secret",
    history: "saved_transcripts_history",
    appVersion: "app_version",
    appLastVersionCheckAt: "app_last_version_check_at"
};

export const DEFAULT_OPENROUTER_MODEL_ID = "deepseek/deepseek-v4-flash";

export const state = {
    currentTab: "text",
    currentData: null,
    finalAiData: {
        title: "",
        summary: "",
        formattedText: ""
    },
    forceNextFetch: false,
    cloudRestore: {
        isVisible: false,
        missingCount: 0,
        totalCount: 0
    },
    appUpdate: {
        isChecking: false,
        lastKnownVersion: null,
        hasPendingReload: false
    }
};
