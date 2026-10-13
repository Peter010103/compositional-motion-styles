"""Build the public static artifact from an explicit file allowlist."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
FILES = (
    '.nojekyll', 'index.html', 'controllers.html', 'technical.html',
    'site.css', 'motion-ui.js', 'gallery.js', 'velocity-explorer.js',
    'comparisons-content.js', 'comparisons.js', 'paper.pdf',
)
DIRECTORIES = ('data', 'images', 'libs', 'videos')

def build():
    target = ROOT / '_site'
    target.mkdir(exist_ok=True)
    for filename in FILES:
        shutil.copy2(ROOT / filename, target / filename)
    for name in DIRECTORIES:
        shutil.copytree(ROOT / name, target / name, dirs_exist_ok=True)
    size = sum(p.stat().st_size for p in target.rglob('*') if p.is_file())
    print(f'Built {target}: {size / 1e6:.1f} MB')

if __name__ == '__main__':
    build()
