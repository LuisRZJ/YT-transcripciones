import { refs, rerenderIcons } from "./funciones/dom.js";
import { state, STORAGE_KEYS } from "./funciones/state.js";
import { extractVideoId } from "./funciones/youtube.js";
import { fetchSupadataTranscript } from "./funciones/api-client.js";
import { processAndRender } from "./funciones/processing.js";
import { copyContent, downloadContent, executeForceFetch, showToast, switchTab } from "./funciones/ui-actions.js";
import { closeSettingsModal, deleteApiKey, openSettingsModal, saveApiKey } from "./funciones/settings.js";
import {
	closeHistoryModal,
	deleteFromHistory,
	downloadFromHistory,
	getHistory,
	loadFromHistory,
	openHistoryModal,
	saveTranscript
} from "./funciones/history.js";
import {
	applyAllCloudUpdates,
	backupToCloud,
	checkCloudOnPageLoad,
	checkCloudOnSecretSave,
	continueWithLocalData,
	dismissCloudUpdatesBanner,
	importFromCloud,
	isCloudRestoreModalOpen,
	restoreFromCloud
} from "./funciones/cloud-sync.js";
import { checkForAppUpdates, initServiceWorkerManager } from "./funciones/sw-manager.js";

function isHeaderMenuOpen() {
	return !!(refs.headerMenuPanel && !refs.headerMenuPanel.classList.contains("hidden"));
}

function closeHeaderMenu() {
	if (!refs.headerMenuPanel) {
		return;
	}

	refs.headerMenuPanel.classList.add("hidden");
	if (refs.headerMenuBtn) {
		refs.headerMenuBtn.setAttribute("aria-expanded", "false");
	}
}

function openHeaderMenu() {
	if (!refs.headerMenuPanel) {
		return;
	}

	refs.headerMenuPanel.classList.remove("hidden");
	if (refs.headerMenuBtn) {
		refs.headerMenuBtn.setAttribute("aria-expanded", "true");
	}
	rerenderIcons();
}

function toggleHeaderMenu() {
	if (isHeaderMenuOpen()) {
		closeHeaderMenu();
		return;
	}
	openHeaderMenu();
}

function syncHeaderOffset() {
	if (!refs.appHeader) {
		return;
	}

	const headerHeight = Math.ceil(refs.appHeader.getBoundingClientRect().height);
	const extraGap = 12;
	document.body.style.setProperty("--app-header-offset", `${headerHeight + extraGap}px`);
}

function scheduleHeaderOffsetSync() {
	requestAnimationFrame(syncHeaderOffset);
}

function showDuplicateWarning(existingId) {
	if (!refs.errorMessage) {
		return;
	}

	refs.errorMessage.innerHTML = `Esta transcripción ya se encuentra en tu biblioteca local.<br><br>
		<div class="flex gap-2 mt-3">
			<button type="button" data-action="history-load" data-id="${existingId}" class="px-3 py-1.5 bg-blue-100 text-blue-800 hover:bg-blue-200 font-semibold text-sm rounded shadow-sm transition-colors border border-blue-200">
				Abrir desde Biblioteca
			</button>
			<button type="button" data-action="execute-force-fetch" class="px-3 py-1.5 bg-red-100 text-red-800 hover:bg-red-200 font-semibold text-sm rounded shadow-sm transition-colors border border-red-200">
				Re-analizar (Sobreescribir)
			</button>
		</div>`;
}

async function handleTranscriptSubmit(event) {
	event.preventDefault();

	const apiKey = localStorage.getItem(STORAGE_KEYS.supadataApiKey);
	const openRouterKey = localStorage.getItem(STORAGE_KEYS.openrouterApiKey);

	if (!apiKey || !openRouterKey) {
		openSettingsModal();
		showToast("Por favor, configura tus API Keys primero.");
		return;
	}

	const url = refs.youtubeUrlInput ? refs.youtubeUrlInput.value.trim() : "";
	if (!url) {
		return;
	}

	const videoId = extractVideoId(url);
	if (!videoId) {
		if (refs.errorMessage) {
			refs.errorMessage.textContent = "Por favor ingresa una URL válida de YouTube (ej. https://youtu.be/... o https://youtube.com/watch?v=...).";
		}
		if (refs.errorState) {
			refs.errorState.classList.remove("hidden");
		}
		if (refs.resultsContainer) {
			refs.resultsContainer.classList.add("hidden");
		}
		if (refs.loadingState) {
			refs.loadingState.classList.add("hidden");
			refs.loadingState.classList.remove("flex");
		}
		return;
	}

	if (!state.forceNextFetch) {
		const history = getHistory();
		const existing = history.find((item) => item.videoId === videoId);
		if (existing) {
			showDuplicateWarning(existing.id);
			if (refs.errorState) {
				refs.errorState.classList.remove("hidden");
			}
			if (refs.resultsContainer) {
				refs.resultsContainer.classList.add("hidden");
			}
			if (refs.loadingState) {
				refs.loadingState.classList.add("hidden");
				refs.loadingState.classList.remove("flex");
			}
			return;
		}
	}

	state.forceNextFetch = false;

	if (refs.errorState) {
		refs.errorState.classList.add("hidden");
	}
	if (refs.resultsContainer) {
		refs.resultsContainer.classList.add("hidden");
	}
	if (refs.loadingState) {
		refs.loadingState.classList.remove("hidden");
		refs.loadingState.classList.add("flex");
	}
	if (refs.submitBtn) {
		refs.submitBtn.disabled = true;
	}

	try {
		const data = await fetchSupadataTranscript(url, apiKey);
		state.currentData = data;
		await processAndRender(data);
	} catch (error) {
		if (refs.errorMessage) {
			refs.errorMessage.textContent = error && error.message
				? error.message
				: "Ocurrió un error inesperado.";
		}
		if (refs.errorState) {
			refs.errorState.classList.remove("hidden");
		}
		if (refs.loadingState) {
			refs.loadingState.classList.add("hidden");
			refs.loadingState.classList.remove("flex");
		}
		if (refs.submitBtn) {
			refs.submitBtn.disabled = false;
		}
	}
}

async function handleGlobalClick(event) {
	const actionNode = event.target.closest("[data-action]");
	if (!actionNode) {
		if (isHeaderMenuOpen()) {
			const clickInPanel = refs.headerMenuPanel && refs.headerMenuPanel.contains(event.target);
			const clickInButton = refs.headerMenuBtn && refs.headerMenuBtn.contains(event.target);
			if (!clickInPanel && !clickInButton) {
				closeHeaderMenu();
			}
		}
		return;
	}

	const { action } = actionNode.dataset;

	if (
		isHeaderMenuOpen() &&
		action !== "toggle-header-menu" &&
		action !== "header-menu-history" &&
		action !== "header-menu-settings"
	) {
		closeHeaderMenu();
	}

	switch (action) {
		case "toggle-header-menu":
			toggleHeaderMenu();
			break;
		case "header-menu-history":
			closeHeaderMenu();
			openHistoryModal();
			break;
		case "header-menu-settings":
			closeHeaderMenu();
			openSettingsModal();
			break;
		case "open-history-modal":
			closeHeaderMenu();
			openHistoryModal();
			break;
		case "open-settings-modal":
			closeHeaderMenu();
			openSettingsModal();
			break;
		case "cloud-restore-cloud":
			await restoreFromCloud();
			break;
		case "cloud-restore-local":
			continueWithLocalData();
			break;
		case "switch-tab":
			if (actionNode.dataset.tab) {
				switchTab(actionNode.dataset.tab);
			}
			break;
		case "save-transcript":
			saveTranscript();
			break;
		case "download-content":
			downloadContent();
			break;
		case "copy-content":
			copyContent();
			break;
		case "close-settings-modal":
			closeSettingsModal();
			break;
		case "delete-api-key":
			deleteApiKey();
			break;
		case "save-api-key":
			saveApiKey(checkCloudOnSecretSave);
			break;
		case "check-app-updates":
			await checkForAppUpdates({ triggeredByUser: true });
			break;
		case "close-history-modal":
			closeHistoryModal();
			break;
		case "backup-to-cloud":
			await backupToCloud();
			break;
		case "import-from-cloud":
			await importFromCloud();
			break;
		case "execute-force-fetch":
			executeForceFetch();
			break;
		case "history-load":
			if (actionNode.dataset.id) {
				loadFromHistory(actionNode.dataset.id);
			}
			break;
		case "history-download":
			if (actionNode.dataset.id) {
				downloadFromHistory(actionNode.dataset.id);
			}
			break;
		case "history-delete":
			if (actionNode.dataset.id) {
				deleteFromHistory(actionNode.dataset.id);
			}
			break;
		case "cloud-updates-apply":
			applyAllCloudUpdates();
			break;
		case "cloud-updates-dismiss":
			dismissCloudUpdatesBanner();
			break;
		default:
			break;
	}
}

function handleKeyDown(event) {
	if (event.key !== "Escape") {
		return;
	}

	if (isCloudRestoreModalOpen()) {
		event.preventDefault();
		return;
	}

	closeHeaderMenu();
}

async function initApp() {
	rerenderIcons();
	scheduleHeaderOffsetSync();

	if (refs.form) {
		refs.form.addEventListener("submit", handleTranscriptSubmit);
	}

	document.addEventListener("click", handleGlobalClick);
	document.addEventListener("keydown", handleKeyDown);
	window.addEventListener("resize", scheduleHeaderOffsetSync);
	window.addEventListener("load", scheduleHeaderOffsetSync);

	if (document.fonts && document.fonts.ready) {
		document.fonts.ready.then(scheduleHeaderOffsetSync).catch(() => {
			// No-op: el fallback en CSS ya evita el solapamiento.
		});
	}

	await initServiceWorkerManager();

	await checkCloudOnPageLoad();
}

initApp();
