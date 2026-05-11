export function extractVideoId(url) {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === "youtu.be") {
            return urlObj.pathname.slice(1);
        }

        if (urlObj.hostname.includes("youtube.com")) {
            if (urlObj.pathname === "/watch") {
                return urlObj.searchParams.get("v");
            }

            if (urlObj.pathname.startsWith("/embed/")) {
                return urlObj.pathname.split("/")[2];
            }
        }
    } catch (e) {
        return null;
    }

    return null;
}
