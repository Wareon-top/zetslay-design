"""Retire the launch announcement without replacing the cabinet or its other assets."""
import argparse
import hashlib
import os
import re
import subprocess
import tarfile
import tempfile
from pathlib import Path

BEFORE_JS = 'e18f779d058cf3d14ff4fb146ddea3f9a01d4f9767b6c9b73bd697291e044b40'
RETIRED_JS = b'/* Retired launch announcement. Intentionally inert for cached pages. */\n'
ASSET = 'app/launch-announcement.js'
INDEX = 'app/index.html'
PREFIX = rb'(?:\./|/app/|https://zetslay\.pro/app/)?'
SCRIPT = re.compile(rb'<script\b[^>]*\bsrc\s*=\s*([\x22\x27])' + PREFIX + rb'launch-announcement\.js(?:\?[^\x22\x27]*)?\1[^>]*>\s*</script\s*>', re.I)
STYLE = re.compile(rb'<link\b[^>]*\bhref\s*=\s*([\x22\x27])' + PREFIX + rb'launch-announcement\.css(?:\?[^\x22\x27]*)?\1[^>]*>', re.I)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def remove_includes(data):
    result, scripts = SCRIPT.subn(b'', data)
    result, styles = STYLE.subn(b'', result)
    if scripts > 1 or styles > 1 or b'launch-announcement.' in result.lower():
        raise ValueError('Не распознаны подключения объявления. Файлы не изменены.')
    return result

def prepare(root, revision):
    payload = subprocess.run(['git', 'show', revision + ':' + ASSET], cwd=root, check=True, capture_output=True).stdout
    if payload != RETIRED_JS:
        raise ValueError('Не подтверждён пакет отключения объявления.')
    changes = {}
    for name in (ASSET, INDEX):
        path = root / name
        if path.is_symlink() or not path.is_file() or path.stat().st_size > 10_000_000:
            raise ValueError('Не подтверждён файл ' + name)
        before = path.read_bytes()
        if name == ASSET:
            if digest(before) not in {BEFORE_JS, digest(RETIRED_JS)}:
                raise ValueError('Объявление изменено относительно проверенной версии. Сайт не изменён.')
            after = RETIRED_JS
        else:
            after = remove_includes(before)
        if before != after:
            changes[name] = (before, after)
    return changes

def write(root, name, data):
    target = root / name
    original = target.stat()
    fd, temporary = tempfile.mkstemp(prefix='.remove-launch-', dir=target.parent)
    try:
        with os.fdopen(fd, 'wb') as output:
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temporary, original.st_mode & 0o777)
        if hasattr(os, 'chown'):
            os.chown(temporary, original.st_uid, original.st_gid)
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)

def verify_public(root):
    for route, expected in [('app/launch-announcement.js?v=removed-20261113', RETIRED_JS), ('app/?v=removed-20261113', None)]:
        result = subprocess.run(['curl', '-q', '-fsS', '--max-time', '12', 'https://zetslay.pro/' + route], capture_output=True, timeout=15)
        if result.returncode:
            raise ValueError('Не удалось подтвердить публичный файл ' + route.split('?')[0])
        if expected is not None and result.stdout != expected:
            raise ValueError('Публичный скрипт не подтвердил отключение объявления.')
        if expected is None and (b'launch-announcement.' in result.stdout.lower() or result.stdout != (root / INDEX).read_bytes()):
            raise ValueError('Публичная страница не подтвердила отключение объявления.')

def apply(root, changes, check, backup_dir):
    if not changes:
        check()
        return None
    fd, backup = tempfile.mkstemp(prefix='zetslay-before-remove-launch.', suffix='.tar.gz', dir=backup_dir)
    os.close(fd)
    with tarfile.open(backup, 'w:gz') as archive:
        for name, (before, _) in changes.items():
            if (root / name).read_bytes() != before:
                raise ValueError('Файлы изменились во время подготовки.')
            archive.add(root / name, arcname=name, recursive=False)
    with tarfile.open(backup, 'r:gz') as archive:
        for name, (before, _) in changes.items():
            if archive.extractfile(name).read() != before:
                raise ValueError('Не подтверждена резервная копия.')
    written = []
    try:
        for name, (before, after) in changes.items():
            if (root / name).read_bytes() != before:
                raise ValueError('Файлы изменились во время установки.')
            write(root, name, after)
            written.append(name)
        check()
    except BaseException:
        for name in reversed(written):
            if (root / name).read_bytes() == changes[name][1]:
                write(root, name, changes[name][0])
        print('Публикация не подтверждена; прежние файлы возвращены. Backup: ' + backup, flush=True)
        raise
    return backup

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('revision')
    parser.add_argument('--preflight', action='store_true')
    args = parser.parse_args()
    if not re.fullmatch('[a-f0-9]{40}', args.revision):
        raise ValueError('Нужна полная ревизия.')
    root = Path.cwd()
    changes = prepare(root, args.revision)
    if args.preflight:
        print('Отключение объявления подготовлено. Файлов к обновлению: ' + str(len(changes)) + '. Сайт не изменён.')
        return
    backup = apply(root, changes, lambda: verify_public(root), Path(os.environ.get('ZETSLAY_BACKUP_DIR', '/root')))
    print('Объявление об обновлении и запуске отключено.' + (' Backup: ' + backup if backup else ' Изменения уже установлены.'))

if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        print(str(error))
        raise SystemExit(1)
