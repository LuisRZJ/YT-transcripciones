export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    // Autenticación Protegida (Capa 1: Vercel Security API Secret)
    const secret = req.headers.authorization;
    if (!secret || secret !== `Bearer ${process.env.API_SYNC_SECRET}`) {
        return res.status(401).json({ error: 'No Autorizado: API Sync Secret inválido' });
    }

    const { videoId, data } = req.body;
    if (!videoId || !data) {
        return res.status(400).json({ error: 'Bad Request: Falta videoId o data' });
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_TOKEN;
    
    // Flat File Structure en Github
    const path = `transcripts/${videoId}.json`;
    const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    // 1. Obtener SHA del archivo si es que ya existe (necesario para updates en GitHub)
    let sha = undefined;
    try {
        const getRes = await fetch(githubApiUrl, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'YT-Transcripts-Cloud-Sync'
            }
        });
        if (getRes.ok) {
            const getJson = await getRes.json();
            sha = getJson.sha;
        }
    } catch (e) {
        // Archivo totalmente nuevo o problemas de red. Ignoramos para crear uno nuevo.
    }

    // 2. Subir Archivo Individual codificado
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    const putBody = {
        message: `Sync Cloud: Transcript ${videoId}`,
        content: content,
        sha: sha // Si es undefined, lo crea. Si existe, lo actualiza limpiamente.
    };

    try {
        const putRes = await fetch(githubApiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'YT-Transcripts-Cloud-Sync'
            },
            body: JSON.stringify(putBody)
        });

        if (!putRes.ok) {
            const err = await putRes.json();
            return res.status(500).json({ error: 'GitHub API PUT Error', details: err });
        }

        return res.status(200).json({ success: true, message: `Archivo ${videoId}.json sincronizado exitosamente.` });
        
    } catch (error) {
        return res.status(500).json({ error: 'Network Error conectando con GitHub API', message: error.message });
    }
}
