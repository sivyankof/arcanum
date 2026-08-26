# -*- coding: utf-8 -*-
"""Проверка `.easignore`: что уедет в архив сборки EAS и не потеряно ли нужное (спека 61).

Запускать из корня репозитория:

    python scripts/check_easignore.py                 # проверить текущий .easignore
    python scripts/check_easignore.py путь/к/правилам # прогон мутации, файл проекта не трогается

Зачем. Без `.easignore` в архив EAS уезжало всё рабочее дерево — 305 МБ, из них почти
200 МБ скриншотов веб-проверок и кэша сканов Commons, которых сборке не видно и не нужно.
Файл правил легко испортить в обе стороны: выкинуть лишнее (сборка упадёт на бандле, а не
сразу) или недовыкинуть секреты. Этот скрипт отвечает на оба вопроса числами.

⚠️ Главное про сам `.easignore`: если он есть, EAS ПЕРЕСТАЁТ читать `.gitignore` целиком
(`https://expo.fyi/eas-build-archive`). Поэтому проверка секретов здесь не формальность —
без продублированных шаблонов keystore и `.env` уехали бы на серверы сборки.

Как считает. Матчер берётся у самого git, а не пишется свой: поднимается ПУСТОЙ временный
репозиторий, туда кладётся проверяемый файл правил под именем `.gitignore` — ровно схема
EAS «один файл правил в корне» — и у git спрашивается судьба каждого пути проекта.
Рабочее дерево не трогается: `git check-ignore` работает со строками путей, файлам
существовать не обязательно.

⚠️ Две ловушки, на которых проверка молча притворяется успешной (обе пойманы 26.08):
  1. `git check-ignore` НЕ понимает `--exclude-from` — это опция `ls-files`. С ней он
     исключает ноль файлов, и отчёт выглядит нормальным.
  2. Обмен только через `-z`/`\0`. На Windows Python подменяет `\n` на `\r\n` при записи
     в stdin, git принимает `\r` за часть имени и начинает экранировать пути кавычками —
     совпадений снова ноль.

Код возврата: 0 — всё хорошо, 1 — найдены потери или утечка, 2 — не удалось запустить git.
Проверка обязана краснеть на испорченных правилах; мутации для прогона — в спеке 61.
"""
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.abspath('.')
IGNORE_FILE = sys.argv[1] if len(sys.argv) > 1 else '.easignore'
ALWAYS_SKIP = {'.git', 'node_modules'}  # EAS исключает их независимо от файла правил

# Без чего сборка не соберётся вовсе.
MUST_KEEP = [
    'app.json', 'package.json', 'package-lock.json', 'babel.config.js',
    'tsconfig.json', 'eas.json',
    'assets/images/icon.png', 'assets/images/adaptive-icon.png',
    'assets/images/splash-icon.png', 'assets/images/notification-icon.png',
    'assets/images/favicon.png',
    'content/cards.json', 'content/spreads.json', 'content/course.json',
    'src/lib/cardImages.ts', 'src/lib/i18n.ts', 'app/_layout.tsx',
]

# Каталоги, из которых нельзя потерять НИ ОДНОГО файла.
MUST_KEEP_WHOLE = ('assets/cards', 'assets/fonts', 'assets/images', 'content', 'app', 'src')

SECRET_SUFFIXES = ('.jks', '.p8', '.p12', '.key', '.pem', '.mobileprovision')

MB = 1024 * 1024


def walk_project():
    """Все файлы рабочего дерева, кроме тех, что EAS не берёт в любом случае."""
    out = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        parts = set(os.path.relpath(dirpath, ROOT).split(os.sep))
        if parts & ALWAYS_SKIP:
            dirnames[:] = []
            continue
        dirnames[:] = [d for d in dirnames if d not in ALWAYS_SKIP]
        for name in filenames:
            rel = os.path.relpath(os.path.join(dirpath, name), ROOT).replace(os.sep, '/')
            out.append(rel)
    return out


def ask_git(files, rules_path):
    """Какие из путей git считает исключёнными по данному файлу правил."""
    tmp = tempfile.mkdtemp(prefix='easignore-check-')
    try:
        subprocess.run(['git', 'init', '-q', tmp], check=True, capture_output=True)
        shutil.copyfile(rules_path, os.path.join(tmp, '.gitignore'))
        proc = subprocess.run(
            ['git', '-C', tmp, 'check-ignore', '--stdin', '-z'],
            input=b'\0'.join(f.encode('utf-8') for f in files), capture_output=True,
        )
        if proc.returncode not in (0, 1):  # 0 — что-то исключено, 1 — ничего
            print('git check-ignore упал:', proc.returncode,
                  proc.stderr.decode('utf-8', 'replace'), file=sys.stderr)
            sys.exit(2)
        return {p.decode('utf-8') for p in proc.stdout.split(b'\0') if p}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def size(paths):
    return sum(os.path.getsize(os.path.join(ROOT, p)) for p in paths)


def main():
    rules = os.path.join(ROOT, IGNORE_FILE) if not os.path.isabs(IGNORE_FILE) else IGNORE_FILE
    if not os.path.exists(rules):
        print(f'Файл правил не найден: {IGNORE_FILE}', file=sys.stderr)
        sys.exit(2)

    files = walk_project()
    ignored = ask_git(files, rules)
    kept = [f for f in files if f not in ignored]
    kept_set = set(kept)

    print(f'Правила            : {IGNORE_FILE}')
    print(f'Всего в дереве     : {len(files):5} файл(ов)  {size(files) / MB:8.1f} МБ')
    print(f'Исключено          : {len(ignored):5} файл(ов)  {size(list(ignored)) / MB:8.1f} МБ')
    print(f'УЕДЕТ В АРХИВ      : {len(kept):5} файл(ов)  {size(kept) / MB:8.1f} МБ')

    by_top = {}
    for f in kept:
        by_top.setdefault(f.split('/')[0] if '/' in f else '(корень)', []).append(f)
    print('\nЧто уедет, по каталогам:')
    for top, fs in sorted(by_top.items(), key=lambda kv: -size(kv[1])):
        print(f'  {top:22} {size(fs) / MB:8.2f} МБ  {len(fs):5} файл(ов)')

    problems = []

    missing = [p for p in MUST_KEEP if p not in kept_set]
    print('\nОбязательные файлы :', 'все на месте' if not missing else f'ПОТЕРЯНЫ {missing}')
    if missing:
        problems.append('потеряны обязательные файлы')

    for folder in MUST_KEEP_WHOLE:
        on_disk = [f for f in files if f.startswith(folder + '/')]
        survived = [f for f in on_disk if f in kept_set]
        ok = len(on_disk) == len(survived)
        print(f'  {folder:15} на диске {len(on_disk):4}, уедет {len(survived):4}',
              '— ок' if ok else '— ПОТЕРИ')
        if not ok:
            print('     потеряно:', sorted(set(on_disk) - kept_set)[:10])
            problems.append(f'потери в {folder}')

    secrets = [f for f in files
               if f.endswith(SECRET_SUFFIXES)
               or os.path.basename(f) == '.env'
               or os.path.basename(f).startswith('.env.')]
    leaked = [f for f in secrets if f in kept_set]
    print(f'\nСекретных файлов на диске: {len(secrets)} | утекло бы в архив: {len(leaked)}',
          leaked or '')
    if leaked:
        problems.append('утечка секретов')

    print('\nИТОГ:', 'всё хорошо' if not problems else 'ПРОБЛЕМЫ: ' + ', '.join(problems))
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
