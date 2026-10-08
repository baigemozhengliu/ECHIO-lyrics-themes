"""Build a selected theme using Python 3 standard library; no local paths."""
import hashlib
import json
from pathlib import Path
import sys
import zipfile

repo = Path(__file__).resolve().parents[1]
slug = sys.argv[1] if len(sys.argv) == 2 else ''
if not slug or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in slug):
    raise SystemExit('Usage: python tools/package.py <theme-slug>')
content = repo / 'themes' / slug / 'content'
manifest_path = content / 'echo.workshop.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
files = [p for p in sorted(content.rglob('*')) if p.is_file() and p != manifest_path]
manifest['files'] = [{'path': p.relative_to(content).as_posix(), 'size': p.stat().st_size,
                      'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
destination = repo / 'downloads' / f'{slug}-{manifest["version"]}.zip'
destination.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
    for p in [manifest_path, *files]:
        archive.write(p, p.relative_to(content).as_posix())
with zipfile.ZipFile(destination) as archive:
    assert archive.testzip() is None
    for item in manifest['files']:
        assert hashlib.sha256(archive.read(item['path'])).hexdigest() == item['sha256']
print(f'Built downloads/{destination.name}')
