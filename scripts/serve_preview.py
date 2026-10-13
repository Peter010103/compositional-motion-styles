"""Preview the project subpath, with local release-media and Range support."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import argparse
import re

ROOT = Path(__file__).resolve().parents[1]
PREFIX = '/compositional-motion-styles/'
RELEASE_URL = 'https://github.com/Peter010103/compositional-motion-styles/releases/download/velocity-explorer-720p-v1/'

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        relative = unquote(urlsplit(path).path).removeprefix(PREFIX)
        if relative.startswith('_release/'):
            return str(ROOT / '.release-assets' / Path(relative).name)
        return str(ROOT / relative)

    def do_GET(self):
        if urlsplit(self.path).path == '/':
            self.send_response(302)
            self.send_header('Location', PREFIX)
            self.end_headers()
            return
        if not urlsplit(self.path).path.startswith(PREFIX):
            self.send_error(404)
            return
        super().do_GET()

    def send_head(self):
        self.remaining = None
        p = Path(self.translate_path(self.path)).resolve()
        if not p.is_relative_to(ROOT):
            self.send_error(403)
            return None
        if p.name in ('velocity_explorer.min.js', 'velocity_explorer.json') and p.is_file() and (ROOT / '.release-assets/style_00_720p.mp4').exists():
            data = p.read_text().replace(RELEASE_URL, PREFIX + '_release/').encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript' if p.suffix == '.js' else 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            from io import BytesIO
            return BytesIO(data)
        requested = self.headers.get('Range')
        if requested and p.is_file():
            match = re.fullmatch(r'bytes=(\d*)-(\d*)', requested)
            size = p.stat().st_size
            if not match or not size:
                self.send_error(416)
                return None
            first, last = match.groups()
            if not first:
                start, end = max(0, size - int(last or 0)), size - 1
            else:
                start, end = int(first), min(int(last) if last else size - 1, size - 1)
            if start > end or start >= size:
                self.send_response(416)
                self.send_header('Content-Range', f'bytes */{size}')
                self.end_headers()
                return None
            stream = p.open('rb')
            stream.seek(start)
            self.remaining = end - start + 1
            self.send_response(206)
            self.send_header('Content-Type', self.guess_type(str(p)))
            self.send_header('Accept-Ranges', 'bytes')
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
            self.send_header('Content-Length', str(self.remaining))
            self.end_headers()
            return stream
        return super().send_head()

    def copyfile(self, source, outputfile):
        try:
            if self.remaining is None:
                return super().copyfile(source, outputfile)
            remaining = self.remaining
            while remaining:
                chunk = source.read(min(65536, remaining))
                if not chunk:
                    break
                outputfile.write(chunk)
                remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8080)
    args = parser.parse_args()
    print(f'Preview: http://localhost:{args.port}{PREFIX}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
