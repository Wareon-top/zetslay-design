#!/usr/bin/env python3
"""Stop only the identified legacy syntax-check client; clear an inactive lock."""
from pathlib import Path
from dataclasses import dataclass
import hashlib
import os
import signal
import stat
import subprocess
import sys
import time

LOCK = '.zetslay-landing-hero-update.lock'
LEGACY = '08e682562e9897a0f3f3077a32e1d19a039438c3'

@dataclass(frozen=True)
class Process:
    pid: int
    parent: int
    start: str
    args: tuple
    installer: bool = False
    digest: str = ''

def read_process(path):
    args = tuple(part.decode(errors='replace') for part in (path / 'cmdline').read_bytes().split(b'\0') if part)
    fields = (path / 'stat').read_text().rsplit(')', 1)[1].split()
    data = b''
    if args and Path(args[0]).name == 'bash':
        candidates = [Path(arg) for arg in args[1:] if arg.startswith('/')] + [path / 'fd/255']
        for candidate in candidates:
            try:
                if stat.S_ISREG(candidate.stat().st_mode):
                    with candidate.open('rb') as stream:
                        data = stream.read(262144)
                    break
            except OSError:
                pass
    return Process(int(path.name), int(fields[1]), fields[19], args,
                   LOCK.encode() in data, hashlib.sha256(data).hexdigest())

def scan(root):
    result = {}
    for path in Path('/proc').iterdir():
        if not path.name.isdigit():
            continue
        try:
            if (path / 'cwd').resolve(strict=True) == root:
                process = read_process(path)
                result[process.pid] = process
        except (OSError, ValueError, IndexError):
            pass  # Process exited while being inspected.
    return result

def is_syntax_client(args):
    if len(args) != 11 or Path(args[0]).name != 'docker':
        return False
    expected = ('run', '--rm', '-v', args[4], '-w', '/work',
                'node:22-alpine', 'node', '--check', 'landing-hero.js')
    return args[1:] == expected and args[4].startswith('/') and args[4].endswith('/site:/work:ro')

def select_clients(processes, expected_digest):
    installers = {pid: p for pid, p in processes.items() if p.installer}
    clients = [p for p in processes.values() if is_syntax_client(p.args)
               and p.parent in installers and installers[p.parent].digest == expected_digest]
    allowed_parents = {p.parent for p in clients}
    blocked = [pid for pid in installers if pid not in allowed_parents]
    if blocked:
        raise RuntimeError('Найдена другая активная установка (PID ' + ', '.join(map(str, blocked)) + '). Блокировка сохранена.')
    return clients

def clear_lock(root):
    lock = root / LOCK
    if not lock.exists():
        return
    if lock.is_symlink() or not lock.is_dir():
        raise RuntimeError('Неизвестный тип блокировки. Файлы не изменены.')
    entries = {p.name for p in lock.iterdir()}
    if entries - {'pid'}:
        raise RuntimeError('В блокировке есть неизвестные файлы. Она сохранена.')
    if 'pid' in entries:
        value = (lock / 'pid').read_text().strip()
        if not value.isdigit() or Path('/proc', value).exists():
            raise RuntimeError('PID владельца блокировки ещё существует либо не распознан. Блокировка сохранена.')
        (lock / 'pid').unlink()
    lock.rmdir()

def recover(root):
    root = root.resolve(strict=True)
    if not (root / LOCK).exists():
        print('Блокировки нет. Можно устанавливать обновление.')
        return
    legacy = subprocess.check_output(['git', '-C', str(root), 'show', LEGACY + ':deploy/update-landing-hero.sh'], timeout=10)
    clients = select_clients(scan(root), hashlib.sha256(legacy).hexdigest())
    for client in clients:
        try:
            current = read_process(Path('/proc', str(client.pid)))
            if current != client:
                raise RuntimeError('Процесс изменился при проверке. Повторите восстановление.')
            print('Останавливаем только старую проверку JS, PID', client.pid, flush=True)
            os.kill(client.pid, signal.SIGTERM)
        except FileNotFoundError:
            pass
    deadline = time.monotonic() + 10
    while True:
        active = scan(root)
        if not any(p.installer for p in active.values()) and not any(p.pid in active for p in clients):
            break
        if time.monotonic() >= deadline:
            raise RuntimeError('Старая установка ещё завершается. Блокировка сохранена; новые файлы не установлены.')
        time.sleep(.1)
    clear_lock(root)
    print('Блокировка снята. Docker-служба и контейнеры приложения не перезапускались.')

if __name__ == '__main__':
    try:
        if len(sys.argv) != 2:
            raise RuntimeError('Укажите каталог сайта.')
        recover(Path(sys.argv[1]))
    except (RuntimeError, OSError, subprocess.SubprocessError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
