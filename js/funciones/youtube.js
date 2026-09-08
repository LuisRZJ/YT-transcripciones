export function extractVideoId(url) {
    if (!url || typeof url !== "string") {
        return null;
    }

    const trimmed = url.trim();

    try {
        const urlObj = new URL(trimmed);
        const host = urlObj.hostname.toLowerCase();

        if (host === "youtu.be" || host.endsWith(".youtu.be")) {
            const id = urlObj.pathname.slice(1).split("/")[0];
            return id ? id.split("?")[0] : null;
        }

        if (host.includes("youtube.com") || host.includes("youtube-nocookie.com")) {
            if (urlObj.pathname === "/watch") {
                return urlObj.searchParams.get("v");
            }

            if (urlObj.pathname.startsWith("/shorts/")) {
                return urlObj.pathname.split("/")[2];
            }

            if (urlObj.pathname.startsWith("/embed/")) {
                return urlObj.pathname.split("/")[2];
            }

            if (urlObj.pathname.startsWith("/v/")) {
                return urlObj.pathname.split("/")[2];
            }
        }
    } catch (e) {
        // Fallback a expresión regular si falla el parser de URL
    }

    const match = trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/s]{11})/i);
    if (match && match[1]) {
        return match[1];
    }

    return null;
}

/**
 * Retorna la URL directa de la miniatura de YouTube en el CDN oficial.
 * @param {string} videoId
 * @param {'default' | 'mq' | 'hq' | 'maxres'} quality
 * @returns {string | null}
 */
export function getYouTubeThumbnailUrl(videoId, quality = "hq") {
    if (!videoId || videoId === "unknown") {
        return null;
    }

    const filenameMap = {
        default: "default.jpg",
        mq: "mqdefault.jpg",
        hq: "hqdefault.jpg",
        sd: "sddefault.jpg",
        maxres: "maxresdefault.jpg"
    };

    const filename = filenameMap[quality] || "hqdefault.jpg";
    return `https://i.ytimg.com/vi/${videoId}/${filename}`;
}

/**
 * Consulta la miniatura y metadatos oficiales de YouTube sin consumir cuota API,
 * utilizando el endpoint oEmbed oficial con fallback al CDN directo.
 * @param {string} videoId
 * @returns {Promise<{ videoId: string, title: string | null, authorName: string | null, authorUrl: string | null, thumbnailUrl: string | null }>}
 */
export async function fetchYouTubeMetadata(videoId) {
    if (!videoId || videoId === "unknown") {
        return {
            videoId: "unknown",
            title: null,
            authorName: null,
            authorUrl: null,
            thumbnailUrl: null
        };
    }

    const directThumbnail = getYouTubeThumbnailUrl(videoId, "hq");

    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(oembedUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            return {
                videoId,
                title: data.title || null,
                authorName: data.author_name || null,
                authorUrl: data.author_url || null,
                thumbnailUrl: data.thumbnail_url || directThumbnail
            };
        }
    } catch (e) {
        // Fallback al CDN si falla la petición de oEmbed o hay timeout
    }

    return {
        videoId,
        title: null,
        authorName: null,
        authorUrl: null,
        thumbnailUrl: directThumbnail
    };
}
