import { refs, rerenderIcons, byId } from "./dom.js";
import { getHistory } from "./history.js";
import { getFolders, getCategories, countTranscriptsInFolder, getColorConfig } from "./taxonomy.js";
import { STORAGE_KEYS } from "./state.js";

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function renderDashboard() {
    if (!refs.dashboardSection) {
        return;
    }

    const allTranscripts = getHistory();
    const folders = getFolders();
    const categories = getCategories();
    const hasSyncSecret = Boolean(localStorage.getItem(STORAGE_KEYS.vercelSyncSecret));
    const pendingPushCount = allTranscripts.filter((t) => !t.synced && t.videoId !== "unknown").length;
    const organizedCount = allTranscripts.filter((t) => t.folderId).length;

    // ─── 1. Grid de Métricas Generales ──────────────────────────────────────────
    if (refs.dashStatsGrid) {
        let syncCardContent = "";
        if (!hasSyncSecret) {
            syncCardContent = `
                <div data-action="open-settings-modal" class="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between">
                    <div class="flex items-center justify-between gap-2 mb-2">
                        <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Copia Nube</span>
                        <div class="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                            <i data-lucide="cloud-off" class="w-4 h-4"></i>
                        </div>
                    </div>
                    <div>
                        <div class="text-base sm:text-lg font-bold text-slate-700">Sin configurar</div>
                        <p class="text-xs text-blue-600 font-medium mt-0.5 flex items-center gap-1">
                            Añadir Secret <i data-lucide="chevron-right" class="w-3 h-3"></i>
                        </p>
                    </div>
                </div>
            `;
        } else if (pendingPushCount > 0) {
            syncCardContent = `
                <div data-action="backup-cloud" class="bg-white rounded-xl border border-amber-300 bg-amber-50/40 p-4 shadow-2xs hover:shadow-xs hover:border-amber-400 transition-all cursor-pointer flex flex-col justify-between group">
                    <div class="flex items-center justify-between gap-2 mb-2">
                        <span class="text-xs font-semibold text-amber-800 uppercase tracking-wider">Copia Nube</span>
                        <div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <i data-lucide="cloud-upload" class="w-4 h-4"></i>
                        </div>
                    </div>
                    <div>
                        <div class="text-xl sm:text-2xl font-black text-amber-900">${pendingPushCount}</div>
                        <p class="text-xs text-amber-700 font-semibold mt-0.5 flex items-center gap-1">
                            Respaldar ahora <i data-lucide="arrow-up-right" class="w-3 h-3"></i>
                        </p>
                    </div>
                </div>
            `;
        } else {
            syncCardContent = `
                <div data-action="backup-cloud" class="bg-white rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between">
                    <div class="flex items-center justify-between gap-2 mb-2">
                        <span class="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Copia Nube</span>
                        <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <i data-lucide="cloud-check" class="w-4 h-4"></i>
                        </div>
                    </div>
                    <div>
                        <div class="text-base sm:text-lg font-bold text-emerald-800">Al día</div>
                        <p class="text-xs text-emerald-600 font-medium mt-0.5">Sincronizado</p>
                    </div>
                </div>
            `;
        }

        refs.dashStatsGrid.innerHTML = `
            <!-- Card 1: Transcripciones -->
            <div data-action="open-history-modal" class="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between">
                <div class="flex items-center justify-between gap-2 mb-2">
                    <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</span>
                    <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                        <i data-lucide="file-text" class="w-4 h-4"></i>
                    </div>
                </div>
                <div>
                    <div class="text-xl sm:text-2xl font-black text-slate-900">${allTranscripts.length}</div>
                    <p class="text-xs text-slate-500 font-medium mt-0.5">${allTranscripts.length === 1 ? "1 transcripción" : "transcripciones"}</p>
                </div>
            </div>

            <!-- Card 2: Carpetas -->
            <div data-action="open-history-modal" class="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between">
                <div class="flex items-center justify-between gap-2 mb-2">
                    <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Carpetas</span>
                    <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                        <i data-lucide="folder" class="w-4 h-4"></i>
                    </div>
                </div>
                <div>
                    <div class="text-xl sm:text-2xl font-black text-slate-900">${folders.length}</div>
                    <p class="text-xs text-slate-500 font-medium mt-0.5">${organizedCount} organizadas</p>
                </div>
            </div>

            <!-- Card 3: Categorías -->
            <div data-action="open-history-modal" class="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between">
                <div class="flex items-center justify-between gap-2 mb-2">
                    <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Etiquetas</span>
                    <div class="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                        <i data-lucide="tag" class="w-4 h-4"></i>
                    </div>
                </div>
                <div>
                    <div class="text-xl sm:text-2xl font-black text-slate-900">${categories.length}</div>
                    <p class="text-xs text-slate-500 font-medium mt-0.5">${categories.length === 1 ? "1 categoría" : "categorías activas"}</p>
                </div>
            </div>

            <!-- Card 4: Nube -->
            ${syncCardContent}
        `;
    }

    // ─── 2. Acceso Rápido a Carpetas ────────────────────────────────────────────
    if (refs.dashFoldersList) {
        if (folders.length === 0) {
            refs.dashFoldersList.innerHTML = `
                <div class="w-full py-4 text-center">
                    <p class="text-xs text-slate-500 mb-2">Aún no has creado carpetas para clasificar tus videos.</p>
                    <button type="button" data-action="open-create-folder-modal" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs rounded-lg transition-colors">
                        <i data-lucide="folder-plus" class="w-3.5 h-3.5"></i> Crear primera carpeta
                    </button>
                </div>
            `;
        } else {
            const rootCount = allTranscripts.filter((t) => !t.folderId).length;
            const folderChips = folders.map((f) => {
                const count = countTranscriptsInFolder(f.id);
                const colorCfg = getColorConfig(f.color);
                return `
                    <button type="button" data-action="dash-open-folder" data-id="${f.id}"
                        class="group inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 hover:shadow-xs transition-all text-xs font-semibold text-slate-800">
                        <span class="w-2.5 h-2.5 rounded-full ${colorCfg.badgeBg} group-hover:scale-125 transition-transform"></span>
                        <span class="truncate max-w-[140px]">${escapeHtml(f.name)}</span>
                        <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200/70 text-slate-600 font-bold">${count}</span>
                    </button>
                `;
            });

            // Opción para ver transcripciones sin carpeta
            if (rootCount > 0) {
                folderChips.push(`
                    <button type="button" data-action="dash-open-folder" data-id="root"
                        class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 transition-all text-xs font-medium text-slate-600">
                        <i data-lucide="inbox" class="w-3.5 h-3.5 text-slate-400"></i>
                        <span>Sin carpeta</span>
                        <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-white text-slate-600 font-bold">${rootCount}</span>
                    </button>
                `);
            }

            refs.dashFoldersList.innerHTML = folderChips.join("");
        }
    }

    // ─── 3. Actividad Reciente ──────────────────────────────────────────────────
    if (refs.dashRecentList) {
        if (allTranscripts.length === 0) {
            refs.dashRecentList.innerHTML = `
                <div class="col-span-full py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <i data-lucide="sparkles" class="w-8 h-8 text-slate-300 mx-auto mb-2"></i>
                    <p class="text-sm font-semibold text-slate-700">Tu biblioteca está vacía</p>
                    <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Pega una URL de YouTube arriba y pulsa "Procesar Video" para generar y guardar tu primera transcripción.</p>
                </div>
            `;
        } else {
            const recentItems = allTranscripts.slice(0, 3);
            refs.dashRecentList.innerHTML = recentItems.map((item) => {
                const safeTitle = escapeHtml(item.title || "Sin Título");
                const safeAuthor = escapeHtml(item.authorName || "YouTube");
                const safeDate = escapeHtml(item.date || "");
                const hasValidVideo = item.videoId && item.videoId !== "unknown";
                const thumb = item.thumbnailUrl || (hasValidVideo ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : null);

                return `
                    <div class="bg-slate-50 hover:bg-white rounded-xl border border-slate-200 p-3 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between group">
                        <div class="space-y-2.5">
                            <div class="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-900 border border-slate-200">
                                ${thumb ? `
                                    <img src="${thumb}" alt="${safeTitle}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg';" />
                                ` : `
                                    <div class="w-full h-full flex items-center justify-center text-slate-500">
                                        <i data-lucide="file-text" class="w-6 h-6"></i>
                                    </div>
                                `}
                                <div class="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                    ${safeAuthor}
                                </div>
                            </div>
                            <div>
                                <h4 class="font-bold text-slate-900 text-xs line-clamp-2 leading-snug group-hover:text-blue-700 transition-colors" title="${safeTitle}">
                                    ${safeTitle}
                                </h4>
                                <p class="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                                    <i data-lucide="calendar" class="w-3 h-3"></i> ${safeDate}
                                </p>
                            </div>
                        </div>
                        <button type="button" data-action="dash-load-recent" data-id="${item.id}"
                            class="mt-3 w-full py-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-slate-200 hover:border-blue-200 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs">
                            <i data-lucide="external-link" class="w-3.5 h-3.5"></i> Cargar transcripción
                        </button>
                    </div>
                `;
            }).join("");
        }
    }

    rerenderIcons();
}
