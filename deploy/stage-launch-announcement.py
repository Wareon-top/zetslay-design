"""Retired: the launch announcement was removed at the owner's request (13.11.2026, commit b8d1510).

This installer used to add the weekly launch card to the cabinet. It now always refuses, before any
backup or file write, so an old command cannot bring the card back. To remove a card that is still
installed on the server, use deploy/update-remove-launch.sh.
"""
import sys

MESSAGE = ('Уведомление о запуске снято по решению владельца (13.11.2026). '
           'Установщик выключен; для удаления с сайта используйте deploy/update-remove-launch.sh. Файлы не изменены.')

def stage(local, incoming, out):
    raise ValueError(MESSAGE)

if __name__ == '__main__':
    try:
        stage(*sys.argv[1:])
    except ValueError as error:
        raise SystemExit(str(error))
