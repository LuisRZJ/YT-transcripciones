from http.server import BaseHTTPRequestHandler
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound, VideoUnavailable
import json
import urllib.parse


class handler(BaseHTTPRequestHandler):

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        video_id = params.get("v", [None])[0]
        lang     = params.get("lang", ["es"])[0]

        if not video_id:
            self._json(400, {"error": "Falta el parámetro ?v=VIDEO_ID"})
            return

        try:
            # Intenta el idioma pedido, luego inglés, luego español como fallbacks
            preferred = [lang]
            if lang != "en":  preferred.append("en")
            if lang != "es":  preferred.append("es")

            transcript_list = YouTubeTranscriptApi.get_transcript(
                video_id,
                languages=preferred
            )

            text = " ".join(entry["text"] for entry in transcript_list)
            word_count = len(text.split())

            self._json(200, {
                "transcript": text,
                "word_count": word_count,
                "video_id": video_id,
            })

        except VideoUnavailable:
            self._json(404, {"error": "Vídeo no disponible o URL incorrecta."})
        except TranscriptsDisabled:
            self._json(404, {"error": "Este vídeo tiene los captions desactivados."})
        except NoTranscriptFound:
            self._json(404, {"error": f"No se encontraron captions. Prueba otro idioma."})
        except Exception as e:
            self._json(500, {"error": f"Error inesperado: {str(e)}"})

    def do_OPTIONS(self):
        # Preflight CORS
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def _json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, format, *args):
        pass  # Silencia logs de requests en Vercel
