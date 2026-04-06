module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'Se requiere una URL' });
    }

    try {
        const videoId = extractVideoId(url);
        if (!videoId) {
            return res.status(400).json({ error: 'URL de YouTube inválida' });
        }

        const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        if (!pageRes.ok) {
            return res.status(502).json({ error: 'No se pudo acceder al video de YouTube' });
        }

        const html = await pageRes.text();
        const captionsUrl = extractCaptionsUrl(html);

        if (!captionsUrl) {
            return res.status(404).json({ error: 'No se encontraron subtítulos para este video' });
        }

        const captionsRes = await fetch(captionsUrl);
        const xml = await captionsRes.text();
        const transcript = parseCaptionsXml(xml);

        res.status(200).json({ transcript });
    } catch (error) {
        console.error('Transcript error:', error);
        res.status(500).json({ error: `Error: ${error.message}` });
    }
};

function extractVideoId(url) {
    const patterns = [
        /[?&]v=([^&#]+)/,
        /youtu\.be\/([^?&#]+)/,
        /youtube\.com\/embed\/([^?&#]+)/,
        /youtube\.com\/shorts\/([^?&#]+)/,
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m) return m[1];
    }
    return null;
}

function extractCaptionsUrl(html) {
    const idx = html.indexOf('"captionTracks"');
    if (idx === -1) return null;
    const section = html.slice(idx, idx + 5000);
    const m = section.match(/"baseUrl":"([^"]+)"/);
    if (!m) return null;
    return m[1].replace(/\\u0026/g, '&');
}

function parseCaptionsXml(xml) {
    return xml
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l)
        .join(' ');
}