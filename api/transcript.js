export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Se requiere una URL' });
    }

    try {
        const mod = await import('youtube-transcript');
        const YT = mod.YoutubeTranscript ?? mod.default?.YoutubeTranscript ?? mod.default;
        const transcriptList = await YT.fetchTranscript(url);
        const fullText = transcriptList.map(item => item.text).join(' ');
        res.status(200).json({ transcript: fullText });
    } catch (error) {
        console.error('Transcript error:', error);
        res.status(500).json({ error: `Error: ${error.message}` });
    }
}