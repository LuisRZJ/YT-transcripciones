export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    // Autenticación Protegida (Capa 1: Vercel Security API Secret)
    const secret = req.headers.authorization;
    if (!secret || secret !== `Bearer ${process.env.API_SYNC_SECRET}`) {
        return res.status(401).json({ error: 'No Autorizado: API Sync Secret inválido' });
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_TOKEN;
    const { id } = req.query;

    const baseHeaders = {
        'Authorization': `token ${token}`,
        'User-Agent': 'YT-Transcripts-Cloud-Sync'
    };

    try {
        // CASO A: Pedir un archivo específico para descargar
        if (id) {
            const path = `transcripts/${id}.json`;
            const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
                headers: {
                    ...baseHeaders,
                    'Accept': 'application/vnd.github.v3.raw' // Pedir el RAW directo, sin metadata extra
                }
            });
            
            if (!getRes.ok) {
                return res.status(getRes.status).json({ error: 'Error al obtener el archivo desde GitHub' });
            }
            
            const data = await getRes.json();
            return res.status(200).json({ success: true, data });
        }
        
        // CASO B: Listar el directorio virtual para saber qué archivos existen en la nube
        const path = `transcripts`;
        const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
            headers: {
                ...baseHeaders,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (listRes.status === 404) {
            // El directorio no existe aún en GitHub (Es un backup completamente vacío)
            return res.status(200).json({ success: true, fileIds: [] });
        }
        if (!listRes.ok) {
            const err = await listRes.json();
            return res.status(500).json({ error: 'Error al listar el directorio remoto', details: err });
        }

        const json = await listRes.json();
        // Filtrar elementos para asegurarse que sean archivos generados por nosotros y extraer el ID
        const fileIds = json
            .filter(node => node.type === 'file' && node.name.endsWith('.json'))
            .map(node => node.name.replace('.json', ''));
        
        return res.status(200).json({ success: true, fileIds });
        
    } catch (error) {
        return res.status(500).json({ error: 'Network Error conectando con GitHub API', message: error.message });
    }
}
