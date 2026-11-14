#!/usr/bin/env python3
"""Rebuild deploy/cabinet-v3-manifest.json from app/cabinet-v3.
Hashes are computed on the bytes Git stores: text files covered by `.gitattributes eol=lf`
are hashed with LF line endings, so the manifest matches a fresh checkout on any OS.
Host pins (`host`) and the handoff hash are kept unchanged.
usage: python scripts/build-cabinet-v3-manifest.py <release>
"""
from pathlib import Path
import hashlib, json, sys

ROOT = Path(__file__).resolve().parents[1]
TEXT = {'.js', '.mjs', '.css', '.json', '.txt', '.svg', '.html'}
release = sys.argv[1]
path = ROOT / 'deploy/cabinet-v3-manifest.json'
manifest = json.loads(path.read_text(encoding='utf-8'))
files = []
for f in sorted((ROOT / 'app/cabinet-v3').rglob('*')):
    if not f.is_file() or f.name.endswith('.test.mjs'):
        continue
    data = f.read_bytes()
    if f.suffix in TEXT:
        data = data.replace(b'\r\n', b'\n')
    files.append({'path': f.relative_to(ROOT).as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
manifest['release'] = release
manifest['files'] = files
path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n', encoding='utf-8', newline='\n')
print(release, len(files), 'files')
