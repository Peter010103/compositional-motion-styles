"""Check public assets, local HTML links, and all velocity-bank mappings."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
RELEASE = 'https://github.com/Peter010103/compositional-motion-styles/releases/download/velocity-explorer-720p-v1/'
errors = []

class Links(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key not in ('src', 'href', 'poster') or not value:
                continue
            link = urlsplit(value)
            if link.scheme or value.startswith('#'):
                continue
            if not (ROOT / unquote(link.path)).exists():
                errors.append(f'Missing HTML asset: {value}')

for name in ('index.html', 'controllers.html', 'technical.html'):
    text = (ROOT / name).read_text()
    if re.search(r'Anonymous|ICRA.*[Ss]ubmission|[Aa]nonymous supplementary', text):
        errors.append(f'Submission branding remains: {name}')
    Links().feed(text)

data = json.loads((ROOT / 'data/velocity_explorer.json').read_text())
cells = [c for g in data['groups'] for c in g['cells']]
assert len(data['groups']) == 16 and len(cells) == 2160
urls = {c['video'] for c in cells}
assert len(urls) == 16 and all(u.startswith(RELEASE) for u in urls)
for group in data['groups']:
    if not (ROOT / group['reference_video']).is_file():
        errors.append(f'Missing controller reference for style {group["id"]}')
    for cell in group['cells']:
        reference = cell.get('velocity_reference')
        if reference and not (ROOT / reference['video']).is_file():
            errors.append(f'Missing velocity-matched reference: {reference["video"]}')

expression = "const fs=require('fs'),vm=require('vm');let x={window:{}};vm.runInNewContext(fs.readFileSync('data/velocity_explorer.min.js','utf8'),x);process.stdout.write(JSON.stringify(x.window.VELOCITY_EXPLORER));"
js_data = json.loads(subprocess.check_output(['node', '-e', expression], cwd=ROOT))
if data != js_data:
    errors.append('JSON and browser velocity manifests differ')

if errors:
    raise SystemExit('\n'.join(errors))
print(f'Public pages and assets valid; {len(cells)} cells mapped to {len(urls)} independent release videos.')
