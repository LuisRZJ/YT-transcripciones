export const STORAGE_KEYS = {
    supadataApiKey: "supadata_api_key",
    openrouterApiKey: "openrouter_api_key",
    openrouterModelId: "openrouter_model_id",
    googleAiStudioApiKey: "google_ai_studio_api_key",
    googleAiDailyUsage: "google_ai_daily_usage",
    aiProviderPreference: "ai_provider_preference",
    rapidApiKey: "rapidapi_key",
    audioFormat: "audio_format",
    audioQuality: "audio_quality",
    vercelSyncSecret: "vercel_sync_secret",
    sessionExpiry: "session_expiry",
    history: "saved_transcripts_history",
    appVersion: "app_version",
    appLastVersionCheckAt: "app_last_version_check_at"
};

export const DEFAULT_OPENROUTER_MODEL_ID = "deepseek/deepseek-v4-flash";
export const DEFAULT_AI_PROVIDER = "openrouter"; // "openrouter" | "google"
export const GOOGLE_AI_STUDIO_MODEL = "gemini-3.5-flash-lite";
export const RAPIDAPI_DOWNLOADER_HOST = "youtube-mp4-mp3-downloader.p.rapidapi.com";
export const DEFAULT_AUDIO_FORMAT = "mp3";
export const DEFAULT_AUDIO_QUALITY = "128";
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 días en ms


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
