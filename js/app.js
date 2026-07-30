import { refs, rerenderIcons } from "./funciones/dom.js";
import { state, STORAGE_KEYS, DEFAULT_AUDIO_FORMAT, DEFAULT_AUDIO_QUALITY } from "./funciones/state.js";
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
import { fetchAudioDownload, triggerBrowserDownload, formatDuration } from "./funciones/audio-downloader.js";
import { isSessionValid, loginWithSecret, logout, showMainApp, showLoginView } from "./funciones/auth.js";

// Estado temporal para el picker de acción
const pickerState = {
	videoId: null,
	url: null,
	audioDownloadUrl: null,
	audioTitle: null
};

// ─── Menú de cabecera ────────────────────────────────────────────────────────

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

// ─── Header offset ───────────────────────────────────────────────────────────

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

// ─── Warning duplicados ──────────────────────────────────────────────────────

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

// ─── Modal Selector de Acción ────────────────────────────────────────────────

function openActionPicker(videoId, url) {
	if (!refs.actionPickerModal) {
		return;
	}

	pickerState.videoId = videoId;
	pickerState.url = url;
	pickerState.audioDownloadUrl = null;
	pickerState.audioTitle = null;

	// Mostrar el ID del video en el modal
	const videoIdLabel = document.getElementById("actionPickerVideoId");
	if (videoIdLabel) {
		videoIdLabel.textContent = `Video ID: ${videoId}`;
	}

	// Mostrar/ocultar badge "Sin clave" en el botón de Audio
	const badge = document.getElementById("audioPickerBadge");
	if (badge) {
		const hasRapidKey = !!localStorage.getItem(STORAGE_KEYS.rapidApiKey);
		badge.classList.toggle("hidden", hasRapidKey);
	}

	refs.actionPickerModal.classList.remove("hidden");
	setTimeout(() => {
		refs.actionPickerModal.classList.remove("opacity-0");
		const panel = refs.actionPickerModal.querySelector("div");
		if (panel) {
			panel.classList.remove("scale-95");
		}
	}, 10);
	rerenderIcons();
}

function closeActionPicker() {
	if (!refs.actionPickerModal) {
		return;
	}

	refs.actionPickerModal.classList.add("opacity-0");
	const panel = refs.actionPickerModal.querySelector("div");
	if (panel) {
		panel.classList.add("scale-95");
	}

	setTimeout(() => {
		refs.actionPickerModal.classList.add("hidden");
	}, 300);
}

// ─── Panel de Audio ──────────────────────────────────────────────────────────

function showAudioProcessing() {
	if (refs.audioResultContainer) {
		refs.audioResultContainer.classList.remove("hidden");
	}

	const processingState = document.getElementById("audioProcessingState");
	const readyState = document.getElementById("audioReadyState");

	if (processingState) {
		processingState.classList.remove("hidden");
	}

	if (readyState) {
		readyState.classList.add("hidden");
	}

	if (refs.audioProgressBar) {
		refs.audioProgressBar.style.width = "0%";
	}

	if (refs.audioProgressText) {
		refs.audioProgressText.textContent = "Iniciando proceso de audio...";
	}

	// Ocultar otros paneles para no confundir
	if (refs.errorState) {
		refs.errorState.classList.add("hidden");
	}

	if (refs.resultsContainer) {
		refs.resultsContainer.classList.add("hidden");
	}

	if (refs.loadingState) {
		refs.loadingState.classList.add("hidden");
		refs.loadingState.classList.remove("flex");
	}
}

function showAudioReady(title, duration) {
	const processingState = document.getElementById("audioProcessingState");
	const readyState = document.getElementById("audioReadyState");

	if (processingState) {
		processingState.classList.add("hidden");
	}

	if (readyState) {
		readyState.classList.remove("hidden");
	}

	if (refs.audioResultTitle) {
		refs.audioResultTitle.textContent = title || "Audio descargado";
	}

	if (refs.audioResultDuration) {
		refs.audioResultDuration.textContent = duration > 0
			? `Duración: ${formatDuration(duration)}`
			: "Duración: —";
	}

	rerenderIcons();
}

function hideAudioPanel() {
	if (refs.audioResultContainer) {
		refs.audioResultContainer.classList.add("hidden");
	}
}

function updateAudioProgress(pct) {
	if (refs.audioProgressBar) {
		refs.audioProgressBar.style.width = `${pct}%`;
	}

	if (refs.audioProgressText) {
		if (pct < 10) {
			refs.audioProgressText.textContent = "Iniciando proceso de audio...";
		} else if (pct < 50) {
			refs.audioProgressText.textContent = `Procesando audio... ${pct}%`;
		} else if (pct < 90) {
			refs.audioProgressText.textContent = `Casi listo... ${pct}%`;
		} else {
			refs.audioProgressText.textContent = "Finalizando...";
		}
	}
}

// ─── Flujo de Transcripción ──────────────────────────────────────────────────

async function runTranscriptFlow(url, videoId) {
	const apiKey = localStorage.getItem(STORAGE_KEYS.supadataApiKey);
	const openRouterKey = localStorage.getItem(STORAGE_KEYS.openrouterApiKey);
	const googleKey = localStorage.getItem(STORAGE_KEYS.googleAiStudioApiKey);

	if (!apiKey || (!openRouterKey && !googleKey)) {
		openSettingsModal();
		showToast("Por favor, configura tus API Keys primero.");
		return;
	}

	hideAudioPanel();

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

// ─── Flujo de Descarga de Audio ──────────────────────────────────────────────

async function runAudioFlow(videoId) {
	const rapidApiKey = localStorage.getItem(STORAGE_KEYS.rapidApiKey);

	if (!rapidApiKey) {
		showToast("Configura tu RapidAPI Key en Ajustes para descargar audio.");
		openSettingsModal();
		return;
	}

	const format = localStorage.getItem(STORAGE_KEYS.audioFormat) || DEFAULT_AUDIO_FORMAT;
	const quality = localStorage.getItem(STORAGE_KEYS.audioQuality) || DEFAULT_AUDIO_QUALITY;

	if (refs.submitBtn) {
		refs.submitBtn.disabled = true;
	}

	showAudioProcessing();

	try {
		const result = await fetchAudioDownload(
			videoId,
			{ format, quality, rapidApiKey },
			updateAudioProgress
		);

		pickerState.audioDownloadUrl = result.url;
		pickerState.audioTitle = result.title;

		showAudioReady(result.title, result.duration);
	} catch (error) {
		hideAudioPanel();

		if (refs.errorMessage) {
			refs.errorMessage.textContent = error && error.message
				? error.message
				: "No se pudo obtener el audio. Intenta de nuevo.";
		}

		if (refs.errorState) {
			refs.errorState.classList.remove("hidden");
		}
	} finally {
		if (refs.submitBtn) {
			refs.submitBtn.disabled = false;
		}
	}
}

// ─── Submit del formulario ───────────────────────────────────────────────────

async function handleTranscriptSubmit(event) {
	event.preventDefault();

	const url = refs.youtubeUrlInput ? refs.youtubeUrlInput.value.trim() : "";
	if (!url) {
		return;
	}

	const videoId = extractVideoId(url);
	if (!videoId) {
		if (refs.errorMessage) {
			refs.errorMessage.textContent = "Por favor ingresa una URL válida de YouTube (ej. https://youtube.com/watch?v=... o https://youtube.com/shorts/...).";
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

	// Verificar duplicado antes de mostrar el picker
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

	// Abrir modal de selección
	openActionPicker(videoId, url);
}

// ─── Click global ────────────────────────────────────────────────────────────

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

		// ── Picker de acción ──────────────────────────────────────────────
		case "close-action-picker":
			closeActionPicker();
			break;
		case "picker-open-settings":
			closeActionPicker();
			openSettingsModal();
			break;
		case "pick-transcript":
			closeActionPicker();
			if (pickerState.url && pickerState.videoId) {
				await runTranscriptFlow(pickerState.url, pickerState.videoId);
			}

			break;
		case "pick-audio":
			closeActionPicker();
			if (pickerState.videoId) {
				await runAudioFlow(pickerState.videoId);
			}

			break;

		case "logout":
			closeHeaderMenu();
			logout();
			break;

		// ── Descarga de audio ─────────────────────────────────────────────
		case "download-audio": {
			const dlUrl = pickerState.audioDownloadUrl;
			const dlTitle = pickerState.audioTitle;
			const format = localStorage.getItem(STORAGE_KEYS.audioFormat) || DEFAULT_AUDIO_FORMAT;

			if (!dlUrl) {
				showToast("No hay audio disponible para descargar.");
				break;
			}

			const safeTitle = (dlTitle || "audio_youtube")
				.replace(/[^a-z0-9\s_-]/gi, "")
				.trim()
				.replace(/\s+/g, "_")
				.toLowerCase()
				.slice(0, 80);

			triggerBrowserDownload(dlUrl, `${safeTitle}.${format}`);
			showToast("¡Descarga iniciada!");
			break;
		}

		default:
			break;
	}
}

async function handleLoginSubmit(event) {
	event.preventDefault();

	if (!refs.loginSecretInput) {
		return;
	}

	const secret = refs.loginSecretInput.value.trim();
	if (!secret) {
		return;
	}

	if (refs.loginSubmitBtn) {
		refs.loginSubmitBtn.disabled = true;
		const span = refs.loginSubmitBtn.querySelector("span");
		if (span) {
			span.textContent = "Verificando...";
		}
	}

	if (refs.loginErrorMsg) {
		refs.loginErrorMsg.classList.add("hidden");
	}

	try {
		await loginWithSecret(secret);
		showToast("¡Sesión iniciada! Válida por 7 días.");

		// Verificar inmediatamente datos de la nube con la clave introducida
		await checkCloudOnSecretSave(secret);
	} catch (error) {
		if (refs.loginErrorMsg) {
			const errTextNode = document.getElementById("loginErrorText");
			if (errTextNode) {
				errTextNode.textContent = error?.message || "Contraseña incorrecta.";
			}
			refs.loginErrorMsg.classList.remove("hidden");
		}
	} finally {
		if (refs.loginSubmitBtn) {
			refs.loginSubmitBtn.disabled = false;
			const span = refs.loginSubmitBtn.querySelector("span");
			if (span) {
				span.textContent = "Iniciar Sesión";
			}
		}
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

	closeActionPicker();
	closeHeaderMenu();
}

async function initApp() {
	rerenderIcons();
	scheduleHeaderOffsetSync();

	if (refs.loginForm) {
		refs.loginForm.addEventListener("submit", handleLoginSubmit);
	}

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

	// Guard de Autenticación
	if (isSessionValid()) {
		showMainApp();
		await checkCloudOnPageLoad();
	} else {
		showLoginView();
	}
}

initApp();
