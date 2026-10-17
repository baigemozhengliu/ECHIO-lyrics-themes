"""Rebuild this theme's manifest and importable ZIP using Python 3 only."""
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent
content = root / 'content'
manifest_path = content / 'echo.workshop.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
files = sorted(p for p in content.rglob('*') if p.is_file() and p != manifest_path)
manifest['files'] = [dict(path=p.relative_to(content).as_posix(), size=p.stat().st_size,
                          sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in files]
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
downloads = root.parents[1] / 'downloads'
downloads.mkdir(exist_ok=True)
target = downloads / (manifest['title'] + '-' + manifest['version'] + '.zip')
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for p in [manifest_path, *files]:
        archive.write(p, p.relative_to(content).as_posix())
print(target.name)
