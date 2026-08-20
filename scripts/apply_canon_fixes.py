# -*- coding: utf-8 -*-
"""Применение утверждённых редактором правок канона из docs/canon-fixes.md (задача 28б).

Адрес блока в файле указан по-человечески («Маг · The Magician» → «Самочувствие»), поэтому
скрипт ищет блок НЕ по маппингу названий, а по ТОЧНОМУ тексту «было»: текст блока уникален
в корпусе, и совпадение либо есть ровно одно, либо правка не применяется вовсе. Так исключён
целый класс ошибок «правка уехала не в тот блок».

Правка считается утверждённой, если редактор поставил [x] ИЛИ вписал свой текст под
«Свой вариант:». Свой текст всегда побеждает предложенный.

    python scripts/apply_canon_fixes.py                 # что будет сделано (ничего не пишет)
    python scripts/apply_canon_fixes.py --apply         # записать правки в cards.json
    python scripts/apply_canon_fixes.py --apply --out docs/specs/28b-changed-addresses.md

⚠️ Пишет JSON тем же форматом, каким он лежит в репозитории (отступ 1): иначе дифф
раздувается на десятки тысяч строк чистой перестановки и настоящая правка в нём тонет.
⚠️ После прогона обязательны: `python scripts/check_edits.py <файл-списка>` (не сломала ли
правка целое) и перевод затронутых мест на es/pt — скрипт печатает их отдельным списком,
потому что перевод остаётся со старой формулировкой и расходится с каноном.
"""
import argparse
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')

CARDS_PATH = 'content/cards.json'
FIXES_PATH = 'docs/canon-fixes.md'
EXTRA_LANGS = ('es', 'pt')


def load_cards(path=CARDS_PATH):
    data = json.loads(open(path, encoding='utf-8').read())
    return data, data['cards'] if isinstance(data, dict) else data


def parse_fixes(text):
    """Режет файл на правки. Понимает оба формата: «RU было/станет» + «EN было/станет»
    (разделы 1–3) и голое «Было/Станет» для правок только русского (раздел 4)."""
    # заголовок правки — «#### …», секция кончается следующим «#### » или «## »
    chunks = re.split(r'\n(?=#### )', text)
    fixes, manual = [], []
    for chunk in chunks[1:]:
        title = chunk.split('\n', 1)[0].replace('####', '').strip()
        body = chunk.split('\n## ')[0]  # не залезать в следующий раздел

        def grab(label):
            m = re.search(rf'\*\*{label}:\*\*\s*(.+?)(?=\n\s*\n|\n\*\*|\n- \[)', body, re.S)
            return m.group(1).strip() if m else None

        ru_from = grab('RU было') or grab('Было')
        ru_to = grab('RU станет') or grab('Станет')
        en_from, en_to = grab('EN было'), grab('EN станет')
        # правка бывает одноязычной в ОБЕ стороны: раздел «Род читателя» — только русский
        # (в английском рода нет), а две правки предсказаний — только английский, потому что
        # русский там уже чист. Требовать русскую пару нельзя: три правки из 67 просто
        # выпали бы из прогона молча.
        if not ((ru_from and ru_to) or (en_from and en_to)):
            # ⚠️ «Можно:» у пограничных мест — это ИНСТРУКЦИЯ человеку («заменить „встреча
            # с подругой“ на „встреча с близким человеком“»), а не готовый текст блока.
            # Принять её за текст «станет» значит записать инструкцию прямо в контент.
            # Такие места скрипт не применяет и обязан назвать вслух, иначе они потеряются.
            if grab('Можно') or ru_from:
                manual.append(title)
            continue

        approved = bool(re.search(r'^- \[[xX]\]', body, re.M))
        # «Свой вариант:» с непустым текстом под ним — тоже утверждение, и он побеждает.
        # ⚠️ Текст обязан идти НА ТОЙ ЖЕ или НЕПОСРЕДСТВЕННО следующей строке и не быть
        # заголовком: первая версия регулярки пропускала пустые строки (`\s*`) и хватала
        # заголовок следующей карты — сухой прогон на неутверждённом файле показал
        # «утверждено 50» там, где редактор не поставил ни одной галочки.
        own = re.search(r'Свой вариант:[ \t]*(?:\n[ \t]*)?([^\s#][^\n]*)', body)
        own_text = own.group(1).strip() if own else None
        fixes.append({
            'title': title, 'ru_from': ru_from, 'ru_to': own_text or ru_to,
            'en_from': en_from, 'en_to': en_to,
            'approved': approved or bool(own_text), 'own': bool(own_text),
        })
    return fixes, manual


def locate(cards, text, lang):
    """Ищет блок по точному тексту. Возвращает список (card, block) — вызывающий обязан
    убедиться, что он ровно один."""
    hits = []
    for c in cards:
        for b, blk in c['content'].items():
            if (blk.get(lang) or '').strip() == text.strip():
                hits.append((c, b))
    return hits


def main():
    ap = argparse.ArgumentParser(description='Применение правок канона (задача 28б)')
    ap.add_argument('--apply', action='store_true', help='записать правки (по умолчанию — сухой прогон)')
    ap.add_argument('--out', help='куда выписать список адресов в формате check_edits.py')
    ap.add_argument('--fixes', default=FIXES_PATH)
    ap.add_argument('--cards', default=CARDS_PATH,
                    help='какой файл колоды править (по умолчанию content/cards.json); '
                         'нужен, чтобы прогонять проверки на копии, не трогая рабочий файл')
    args = ap.parse_args()

    raw, cards = load_cards(args.cards)
    fixes, manual = parse_fixes(open(args.fixes, encoding='utf-8').read())
    if manual:
        print(f'⚠️ мест, которые скрипт применить не может (правка описана словами, '
              f'а не готовым текстом) — {len(manual)}, применяются вручную:')
        for m in manual:
            print(f'   · {m}')
    approved = [f for f in fixes if f['approved']]
    print(f'правок в файле: {len(fixes)} · утверждено редактором: {len(approved)}'
          f' (своих вариантов: {sum(1 for f in approved if f["own"])})')
    if not approved:
        print('нечего применять — редактор ещё не проставил ни одного [x] и не вписал свой текст')
        return 0

    applied, problems, need_translation = [], [], []
    for f in approved:
        # якорь поиска — тот язык, у которого есть пара «было → станет»
        anchor_lang = 'ru' if (f['ru_from'] and f['ru_to']) else 'en'
        anchor_text = f['ru_from'] if anchor_lang == 'ru' else f['en_from']
        hits = locate(cards, anchor_text, anchor_lang)
        if len(hits) != 1:
            problems.append(f'«{f["title"]}»: текст ({anchor_lang}) найден {len(hits)} раз — правка НЕ применена')
            continue
        card, block = hits[0]
        addr = f'{card["id"]}.{block}'
        # английский правится синхронно: расхождение ru↔en — отдельный класс дефекта (задача 31)
        en_ok = True
        if f['en_from'] and f['en_to']:
            if (card['content'][block].get('en') or '').strip() != f['en_from'].strip():
                problems.append(f'{addr}: английский текст в файле не совпадает с корпусом — пара НЕ применена')
                en_ok = False
        elif f['en_from'] or f['en_to']:
            problems.append(f'{addr}: у правки есть только одна половина английской пары')
            en_ok = False
        if not en_ok:
            continue

        if args.apply:
            if f['ru_from'] and f['ru_to']:
                card['content'][block]['ru'] = f['ru_to']
            if f['en_to']:
                card['content'][block]['en'] = f['en_to']
        applied.append((addr, f, card, block))
        present = [l for l in EXTRA_LANGS if (card['content'][block].get(l) or '').strip()]
        if present:
            need_translation.append(f'{addr}: {", ".join(present)}')

    print(f'\nприменимо: {len(applied)} · проблем: {len(problems)}')
    for p in problems:
        print('  ⚠️', p)
    for addr, f, _, _ in applied[:10]:
        print(f'  · {addr}{" (свой вариант редактора)" if f["own"] else ""}')
    if len(applied) > 10:
        print(f'  … ещё {len(applied) - 10}')

    if need_translation:
        print(f'\n⚠️ затронутые места, где перевод остался со старой формулировкой '
              f'({len(need_translation)}) — их обязана перезалить следующая L-сессия:')
        for n in need_translation[:8]:
            print('   ', n)
        if len(need_translation) > 8:
            print(f'    … ещё {len(need_translation) - 8}')

    if args.out and applied:
        lines = ['# Изменённые адреса канона — задача 28б', '',
                 f'Всего {len(applied)} адресов. Вход для `python scripts/check_edits.py`.', '']
        for addr, f, _, _ in applied:
            if f['ru_from'] and f['ru_to']:
                lines += [f'## {addr}.ru', f'- было: {f["ru_from"]}', f'- стало: {f["ru_to"]}', '']
            if f['en_from'] and f['en_to']:
                lines += [f'## {addr}.en', f'- было: {f["en_from"]}', f'- стало: {f["en_to"]}', '']
        open(args.out, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
        print(f'\nсписок адресов: {args.out}')

    if args.apply and applied:
        # формат файла сохраняется байт в байт по отступу — см. предупреждение в шапке
        # ⚠️ именно args.cards, а не CARDS_PATH: при первой проверке скрипта здесь стояла
        # константа, и прогон «на тестовой копии» записал правки в рабочий файл колоды
        open(args.cards, 'w', encoding='utf-8', newline='\n').write(
            json.dumps(raw, ensure_ascii=False, indent=1))
        print(f'\nзаписано в {args.cards}: {len(applied)} блоков')
    elif not args.apply:
        print('\nсухой прогон — файл не изменён. Записать: --apply')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
