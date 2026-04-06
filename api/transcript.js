module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Se requiere una URL' });

    const videoId = extractVideoId(url);
    if (!videoId) return res.status(400).json({ error: 'URL de YouTube inválida' });

    const debug = {};

    try {
        const transcript = await getViaInnerTube(videoId, debug);

        if (!transcript) {
            return res.status(404).json({ error: 'No se encontraron subtítulos para este video', debug });
        }

        res.status(200).json({ transcript });
    } catch (error) {
        console.error('Transcript error:', error);
        res.status(500).json({ error: `Error: ${error.message}`, debug });
    }
};

async function getViaInnerTube(videoId, debug) {
    try {
        const body = {
            context: {
                client: {
                    clientName: 'WEB',
                    clientVersion: '2.20240101.00.00',
                    hl: 'es',
                }
            },
            videoId
        };

        const res = await fetch(
            'https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'X-YouTube-Client-Name': '1',
                    'X-YouTube-Client-Version': '2.20240101.00.00',
                    'Origin': 'https://www.youtube.com',
                    'Referer': 'https://www.youtube.com/',
                },
                body: JSON.stringify(body)
            }
        );

        debug.innertube_status = res.status;
        if (!res.ok) return null;

        const data = await res.json();
        const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

        debug.innertube_tracks = tracks?.map(t => ({
            lang: t.languageCode,
            name: t.name?.simpleText,
            auto: t.kind ?? null
        })) ?? [];

        if (!tracks || tracks.length === 0) return null;

        // Preferir: español > inglés > manual > cualquiera
        const track = tracks.find(t => t.languageCode?.startsWith('es'))
            || tracks.find(t => t.languageCode?.startsWith('en'))
            || tracks.find(t => !t.kind)
            || tracks[0];

        debug.innertube_selected = { lang: track.languageCode, auto: track.kind ?? null };

        const captRes = await fetch(track.baseUrl + '&fmt=json3');
        debug.innertube_capt_status = captRes.status;
        if (!captRes.ok) return null;

        const captData = await captRes.json();
        debug.innertube_events = (captData.events || []).length;

        const text = (captData.events || [])
            .filter(e => e.segs)
            .map(e => e.segs.map(s => s.utf8 ?? '').join(''))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        return text || null;
    } catch (e) {
        debug.innertube_error = e.message;
        return null;
    }
}

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


module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'Se requiere una URL' });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
        return res.status(400).json({ error: 'URL de YouTube inválida' });
    }

    try {
        const debug = {};
        const transcript = await getViaTimedtextApi(videoId, debug) ?? await getViaPageScraping(videoId, debug);

        if (!transcript) {
            return res.status(404).json({ error: 'No se encontraron subtítulos para este video', debug });
        }

        res.status(200).json({ transcript });
    } catch (error) {
        console.error('Transcript error:', error);
        res.status(500).json({ error: `Error: ${error.message}` });
    }
};

// Estrategia 1: API pública de timedtext
async function getViaTimedtextApi(videoId, debug) {
    try {
        const listRes = await fetch(
            `https://www.youtube.com/api/timedtext?v=${videoId}&type=list`,
            { headers: HEADERS }
        );
        debug.timedtext_status = listRes.status;
        if (!listRes.ok) return null;

        const listXml = await listRes.text();
        debug.timedtext_list = listXml.slice(0, 500);
        const langMatch = listXml.match(/lang_code="([^"]+)"/);
        if (!langMatch) return null;

        debug.timedtext_lang = langMatch[1];
        const captRes = await fetch(
            `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${langMatch[1]}&fmt=json3`,
            { headers: HEADERS }
        );
        if (!captRes.ok) return null;

        const data = await captRes.json();
        debug.timedtext_events = (data.events || []).length;
        const text = (data.events || [])
            .filter(e => e.segs)
            .map(e => e.segs.map(s => s.utf8 ?? '').join(''))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        return text || null;
    } catch (e) {
        debug.timedtext_error = e.message;
        return null;
    }
}

// Estrategia 2: scraping de la página del video
async function getViaPageScraping(videoId, debug) {
    try {
        const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, { headers: HEADERS });
        debug.scrape_status = pageRes.status;
        if (!pageRes.ok) return null;

        const html = await pageRes.text();
        debug.scrape_html_len = html.length;

        const idx = html.indexOf('"captionTracks"');
        debug.scrape_captionTracks_found = idx !== -1;
        if (idx === -1) return null;

        const sub = html.slice(idx + '"captionTracks":'.length);
        const arrEnd = findArrayEnd(sub);
        debug.scrape_arrEnd = arrEnd;
        if (arrEnd === -1) return null;

        let tracks;
        try {
            tracks = JSON.parse(sub.slice(0, arrEnd + 1));
        } catch (e) {
            debug.scrape_parse_error = e.message;
            return null;
        }

        debug.scrape_tracks = tracks.map(t => ({ lang: t.languageCode, name: t.name?.simpleText, url: t.baseUrl?.slice(0, 80) }));
        if (!Array.isArray(tracks) || tracks.length === 0) return null;

        const captUrl = tracks[0].baseUrl.replace(/\\u0026/g, '&');
        const captRes = await fetch(captUrl, { headers: HEADERS });
        const xml = await captRes.text();
        debug.scrape_xml_len = xml.length;

        return parseCaptionsXml(xml);
    } catch (e) {
        debug.scrape_error = e.message;
        return null;
    }
}

// Encuentra el índice del cierre del array JSON (maneja anidamiento y strings)
function findArrayEnd(str) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (escape) { escape = false; continue; }
        if (c === '\\' && inString) { escape = true; continue; }
        if (c === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (c === '[') depth++;
        else if (c === ']') { depth--; if (depth === 0) return i; }
    }
    return -1;
}

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