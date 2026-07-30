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
