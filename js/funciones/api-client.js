const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function fetchWithRetry(url, options, retries = 5) {
    const delays = [1000, 2000, 4000, 8000, 16000];

    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res;
        } catch (err) {
            if (i === retries - 1) {
                throw err;
            }
            await new Promise((resolve) => setTimeout(resolve, delays[i]));
        }
    }

    throw new Error("No se pudo completar la solicitud");
}

export async function fetchSupadataTranscript(videoUrl, apiKey) {
    const response = await fetch(
        `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(videoUrl)}`,
        {
            method: "GET",
            headers: {
                "x-api-key": apiKey,
                Accept: "application/json"
            }
        }
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error HTTP: ${response.status}`);
    }

    return response.json();
}

export async function callOpenRouter(payload, openRouterKey) {
    const response = await fetchWithRetry(OPENROUTER_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openRouterKey}`,
            "HTTP-Referer": window.location.href,
            "X-Title": "Extractor YT"
        },
        body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.error) {
        throw new Error(result.error.message || "Error en OpenRouter API");
    }

    return result;
}
