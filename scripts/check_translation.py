# -*- coding: utf-8 -*-
"""Приёмка волны перевода контента (задача 28, роль CC-L2 плана локализации).

Дополняет check_canon.py (тот про качество корпуса) и check_edits.py (тот про правки
«было → стало»): этот отвечает на вопрос «поставка L-N залита правильно и ничего не сломала».

Запуск из корня репозитория:
    python scripts/check_translation.py --wave majors --lang es,pt
    python scripts/check_translation.py --wave wands-cups --lang es,pt
    python scripts/check_translation.py --wave all --lang es --no-git

Волна (--wave) — какие карты ОБЯЗАНЫ быть переведены целиком; остальные карты проверяются
на неприкосновенность канона и на то, что их не задели случайно.

⚠️ Скрипт ничего не правит. Он печатает отчёт и возвращает код 1 при ошибках.
⚠️ Проверки, помеченные [ОТЧЁТ], находками не считаются — это материал для человека.
"""
import argparse
import collections
import json
import re
import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')

CANON = ('ru', 'en')
CARDS_PATH = 'content/cards.json'
# 12 блоков есть у каждой карты; birth_path — только у Старших арканов
COMMON_BLOCKS = ['general', 'reversed', 'love', 'career', 'finances', 'health', 'day_card',
                 'symbolism', 'love_reversed', 'career_reversed', 'finances_reversed',
                 'health_reversed']
MAJOR_ONLY = ['birth_path']
# блоки-сферы: у них зачин-указатель («В любви…»), решение Артёма 20.08 распространяет
# конвенцию канона на es/pt — разнообразие проверяется в тексте ПОСЛЕ указателя
SPHERE_BLOCKS = ['love', 'career', 'finances', 'health']
MINOR_RE = re.compile(r'^[wcsp]\d\d$')
CYRILLIC = re.compile('[Ѐ-ӿ]')
WORD_RE = re.compile(r"[\wÀ-ɏ'-]+", re.UNICODE)

WAVES = {
    'majors': lambda cid: not MINOR_RE.match(cid),
    'wands-cups': lambda cid: bool(re.match(r'^[wc]\d\d$', cid)),
    'swords-pents': lambda cid: bool(re.match(r'^[sp]\d\d$', cid)),
    'minors': lambda cid: bool(MINOR_RE.match(cid)),
    'all': lambda cid: True,
}


def load_cards(text):
    data = json.loads(text)
    return data['cards'] if isinstance(data, dict) else data


def blocks_of(card_id):
    return COMMON_BLOCKS + (MAJOR_ONLY if not MINOR_RE.match(card_id) else [])


def first_words(text, n=2):
    words = WORD_RE.findall(text.lower())
    return ' '.join(words[:n]) if len(words) >= n else None


class Report:
    def __init__(self):
        self.errors = []
        self.notes = []

    def error(self, msg):
        self.errors.append(msg)

    def note(self, msg):
        self.notes.append(msg)

    def section(self, title, found, sample=6):
        mark = 'OK  ' if not found else 'FAIL'
        print(f'{mark} {title}: {len(found)}')
        for f in found[:sample]:
            print(f'       {f}')
        if len(found) > sample:
            print(f'       … ещё {len(found) - sample}')


def check_structure(cards_new, cards_old, in_wave, langs, rep):
    """Полнота и атомарность волны + неприкосновенность того, что волна трогать не должна."""
    new = {c['id']: c for c in cards_new}
    old = {c['id']: c for c in cards_old} if cards_old else {}

    incomplete, bad_words, bad_status, empty, cyr = [], [], [], [], []
    for cid, card in new.items():
        if not in_wave(cid):
            continue
        for lang in langs:
            # слова карты — одна единица перевода (name + keywords + search + wordsStatus)
            missing = [f for f in ('name', 'keywords', 'search') if lang not in card.get(f, {})]
            if missing:
                incomplete.append(f'{cid}: нет {"/".join(missing)}.{lang}')
            kw = card.get('keywords', {}).get(lang) or []
            if len(kw) != 4:
                bad_words.append(f'{cid}: keywords.{lang} = {len(kw)} (нужно 4)')
            sr = card.get('search', {}).get(lang) or []
            if not 8 <= len(sr) <= 12:
                bad_words.append(f'{cid}: search.{lang} = {len(sr)} (нужно 8–12)')
            ws = card.get('wordsStatus', {}).get(lang)
            if ws != 'draft':
                bad_status.append(f'{cid}: wordsStatus.{lang} = {ws} (ожидался draft)')
            for b in blocks_of(cid):
                blk = card['content'].get(b)
                if blk is None:
                    incomplete.append(f'{cid}: блока {b} нет вовсе')
                    continue
                text = blk.get(lang)
                if text is None:
                    incomplete.append(f'{cid}.{b}: нет {lang}')
                elif not text.strip():
                    # пустая строка ≠ отсутствие языка: presentLang сочтёт язык присутствующим
                    # и покажет пустоту вместо готового английского (спека 28а)
                    empty.append(f'{cid}.{b}.{lang}: пустая строка')
                elif CYRILLIC.search(text):
                    cyr.append(f'{cid}.{b}.{lang}: кириллица в тексте')
                st = blk.get('status', {}).get(lang)
                if st != 'draft':
                    bad_status.append(f'{cid}.{b}: status.{lang} = {st} (ожидался draft)')

    rep.section('волна залита целиком (атомарность)', incomplete)
    rep.section('слова карты: keywords 4, search 8–12', bad_words)
    rep.section('статус нового языка = draft', bad_status)
    rep.section('пустых строк в новом языке нет', empty)
    rep.section('кириллицы в новом языке нет', cyr)
    for lst in (incomplete, bad_words, bad_status, empty, cyr):
        rep.errors.extend(lst)

    if not old:
        print('SKIP  сверка с git HEAD отключена (--no-git)')
        return

    canon_changed, outside, block_set = [], [], []
    for cid, card in new.items():
        o = old.get(cid)
        if o is None:
            canon_changed.append(f'{cid}: карта появилась целиком — так волны не работают')
            continue
        # канон ru/en неприкосновенен ВСЕГДА: перевод не имеет права править исходник
        for field in ('name', 'keywords', 'search'):
            for lang in CANON:
                if card.get(field, {}).get(lang) != o.get(field, {}).get(lang):
                    canon_changed.append(f'{cid}: {field}.{lang} изменён')
        for lang in CANON:
            if card.get('wordsStatus', {}).get(lang) != o.get('wordsStatus', {}).get(lang):
                canon_changed.append(f'{cid}: wordsStatus.{lang} изменён')
        for b, blk in card['content'].items():
            oblk = o['content'].get(b, {})
            for lang in CANON:
                if blk.get(lang) != oblk.get(lang):
                    canon_changed.append(f'{cid}.{b}.{lang} изменён')
                if blk.get('status', {}).get(lang) != oblk.get('status', {}).get(lang):
                    canon_changed.append(f'{cid}.{b}: status.{lang} изменён')
        if set(card['content'].keys()) != set(o['content'].keys()):
            block_set.append(f'{cid}: набор блоков изменился')
        # карты ВНЕ волны: правки нового языка допустимы только как корректирующий проход
        # (шаг 0 промта L-2 — приведение зачинов), поэтому это [ОТЧЁТ], а не ошибка
        if not in_wave(cid) and card != o:
            changed = [f'{b}.{lang}' for b, blk in card['content'].items() for lang in langs
                       if blk.get(lang) != o['content'].get(b, {}).get(lang)]
            if changed:
                outside.append(f'{cid}: {", ".join(changed[:4])}{"…" if len(changed) > 4 else ""}')

    rep.section('канон ru/en не тронут', canon_changed)
    rep.section('набор блоков не менялся', block_set)
    rep.errors.extend(canon_changed + block_set)
    if outside:
        print(f'[ОТЧЁТ] карты вне волны с правками нового языка: {len(outside)}'
              f' (законно, если это корректирующий проход — проверить глазами)')
        for f in outside[:8]:
            print(f'       {f}')
        rep.note(f'правки вне волны: {len(outside)} карт')


def check_key_order(cards_new, rep):
    order = ['ru', 'en', 'es', 'pt']
    bad = []
    for card in cards_new:
        for field in ('name', 'keywords', 'search'):
            keys = [k for k in card.get(field, {}) if k in order]
            if keys != [k for k in order if k in keys]:
                bad.append(f'{card["id"]}.{field}: {keys}')
        for b, blk in card['content'].items():
            keys = [k for k in blk if k in order]
            if keys != [k for k in order if k in keys]:
                bad.append(f'{card["id"]}.{b}: {keys}')
    rep.section('порядок языков ru → en → es → pt', bad)
    rep.errors.extend(bad)


def check_pointers(cards_new, langs, rep):
    """Зачины сферных блоков: указатель определяется как САМАЯ ЧАСТАЯ формула сферы,
    и дальше проверяется, сколько карт от неё отклоняются (решение 20.08 — единообразие)."""
    for lang in langs:
        for sphere in SPHERE_BLOCKS:
            starts = collections.Counter()
            for c in cards_new:
                t = c['content'][sphere].get(lang)
                if t:
                    fw = first_words(t)
                    if fw:
                        starts[fw] += 1
            if not starts:
                continue
            pointer, hits = starts.most_common(1)[0]
            total = sum(starts.values())
            others = total - hits
            mark = 'OK  ' if others == 0 else '[ОТЧЁТ]'
            print(f'{mark} указатель {lang}.{sphere}: «{pointer}» у {hits} из {total}'
                  + (f', отклоняются {others}' if others else ''))
            if others:
                rep.note(f'{lang}.{sphere}: {others} карт вне указателя «{pointer}»')


def check_openings(cards_new, langs, rep, threshold=3):
    """Однообразие зачинов ПО КАЖДОМУ ЯЗЫКУ ОТДЕЛЬНО (урок задачи 25: en тихо разошёлся с ru).
    У сферных блоков указатель снимается — считается то, что идёт ПОСЛЕ него."""
    for lang in langs:
        pointers = {}
        for sphere in SPHERE_BLOCKS:
            starts = collections.Counter()
            for c in cards_new:
                t = c['content'][sphere].get(lang)
                if t:
                    fw = first_words(t)
                    if fw:
                        starts[fw] += 1
            if starts:
                pointers[sphere] = starts.most_common(1)[0][0]

        repeats = collections.Counter()
        for c in cards_new:
            for b in blocks_of(c['id']):
                t = c['content'][b].get(lang)
                if not t:
                    continue
                words = WORD_RE.findall(t.lower())
                if b in pointers:
                    ptr = pointers[b].split()
                    if words[:len(ptr)] == ptr:
                        words = words[len(ptr):]
                if len(words) >= 2:
                    repeats[' '.join(words[:2])] += 1
        found = [f'«{k}» ×{v}' for k, v in repeats.most_common() if v >= threshold]
        rep.section(f'повторы зачинов {lang} (порог {threshold}+)', found, sample=8)
        rep.errors.extend([f'{lang}: зачин {f}' for f in found])


def check_names(cards_new, langs, rep):
    """Имя карты в её текстах — на языке текста, чужих английских имён быть не должно."""
    en_names = []
    for c in cards_new:
        bare = re.sub(r'^The\s+', '', c['name']['en'])
        # короткие и совпадающие с обычными романскими словами не берём: «Sun», «Star»,
        # «Mundo» и подобное дают шум, который топит настоящие находки (урок задачи 31)
        if len(bare) >= 6 and ' ' not in bare:
            en_names.append(bare)
    leaks, selfname = [], []
    for lang in langs:
        for c in cards_new:
            for b in blocks_of(c['id']):
                t = c['content'][b].get(lang)
                if not t:
                    continue
                for n in en_names:
                    if re.search(r'\b' + re.escape(n) + r'\b', t):
                        leaks.append(f'{c["id"]}.{b}.{lang}: английское имя «{n}»')
            g = c['content']['general'].get(lang)
            name = c.get('name', {}).get(lang)
            if g and name:
                bare = re.sub(r'^(El|La|Los|Las|O|A|Os|As)\s+', '', name, flags=re.I)
                if bare.lower() not in g.lower():
                    selfname.append(f'{c["id"]}.general.{lang}: не зовёт карту «{name}»')
    rep.section('английских имён карт в переводе нет', leaks)
    rep.errors.extend(leaks)
    if selfname:
        print(f'[ОТЧЁТ] general не упоминает имя своей карты: {len(selfname)}')
        for f in selfname[:6]:
            print(f'       {f}')
        rep.note(f'general без имени карты: {len(selfname)}')


def check_lengths(cards_new, in_wave, langs, rep, lo=0.8, hi=1.25):
    """Длина относительно английского. [ОТЧЁТ]: коридор — ориентир редактора, не контракт
    (нормы длин разведены по языкам в content-guide — урок задачи 31)."""
    for lang in langs:
        out = []
        for c in cards_new:
            if not in_wave(c['id']):
                continue
            for b in blocks_of(c['id']):
                en = c['content'][b].get('en')
                t = c['content'][b].get(lang)
                if en and t:
                    ratio = len(t) / len(en)
                    if not lo <= ratio <= hi:
                        out.append(f'{c["id"]}.{b} ×{ratio:.2f}')
        print(f'[ОТЧЁТ] длины {lang} вне {lo}–{hi} от en: {len(out)}')
        for f in out[:6]:
            print(f'       {f}')
        if out:
            rep.note(f'{lang}: {len(out)} блоков вне коридора длины')


def check_not_english(cards_new, in_wave, langs, rep):
    """Блок, дословно совпавший с английским, — забытый перевод, а не совпадение."""
    same = []
    for lang in langs:
        for c in cards_new:
            if not in_wave(c['id']):
                continue
            for b in blocks_of(c['id']):
                en = (c['content'][b].get('en') or '').strip()
                t = (c['content'][b].get(lang) or '').strip()
                if en and t and en == t:
                    same.append(f'{c["id"]}.{b}.{lang}: совпадает с английским дословно')
    rep.section('перевод не равен английскому', same)
    rep.errors.extend(same)


def main():
    ap = argparse.ArgumentParser(description='Приёмка волны перевода (задача 28)')
    ap.add_argument('--wave', default='majors', choices=sorted(WAVES),
                    help='какие карты обязаны быть переведены целиком')
    ap.add_argument('--lang', default='es,pt', help='языки волны через запятую')
    ap.add_argument('--no-git', action='store_true',
                    help='не сверять с git HEAD (когда поставка уже закоммичена)')
    ap.add_argument('--file', default=CARDS_PATH,
                    help='какой файл проверять (по умолчанию content/cards.json); '
                         'пригодится для черновика до слияния и для красных прогонов')
    args = ap.parse_args()

    langs = [l.strip() for l in args.lang.split(',') if l.strip()]
    in_wave = WAVES[args.wave]

    cards_new = load_cards(open(args.file, encoding='utf-8').read())
    cards_old = None
    if not args.no_git:
        head = subprocess.run(['git', 'show', f'HEAD:{CARDS_PATH}'],
                              capture_output=True).stdout.decode('utf-8')
        cards_old = load_cards(head) if head.strip() else None
        if cards_old is None:
            print('SKIP  git HEAD недоступен — сверка с каноном пропущена')

    wave_ids = [c['id'] for c in cards_new if in_wave(c['id'])]
    print(f'Волна «{args.wave}»: {len(wave_ids)} карт · языки: {", ".join(langs)}')
    print('=' * 70)

    rep = Report()
    check_structure(cards_new, cards_old, in_wave, langs, rep)
    check_key_order(cards_new, rep)
    check_not_english(cards_new, in_wave, langs, rep)
    check_names(cards_new, langs, rep)
    check_pointers(cards_new, langs, rep)
    check_openings(cards_new, langs, rep)
    check_lengths(cards_new, in_wave, langs, rep)

    print('=' * 70)
    print(f'ОШИБОК: {len(rep.errors)} · заметок для человека: {len(rep.notes)}')
    for n in rep.notes:
        print(f'  · {n}')
    print('ПРИЁМКА: ' + ('ЗЕЛЁНАЯ' if not rep.errors else 'КРАСНАЯ'))
    return 1 if rep.errors else 0


if __name__ == '__main__':
    sys.exit(main())
