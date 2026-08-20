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
COURSE_PATH = 'content/course.json'
SPREADS_PATH = 'content/spreads.json'
# 12 блоков есть у каждой карты; birth_path — только у Старших арканов
COMMON_BLOCKS = ['general', 'reversed', 'love', 'career', 'finances', 'health', 'day_card',
                 'symbolism', 'love_reversed', 'career_reversed', 'finances_reversed',
                 'health_reversed']
MAJOR_ONLY = ['birth_path']
# блоки-сферы: у них зачин-указатель («В любви…»), решение Артёма 20.08 распространяет
# конвенцию канона на es/pt — разнообразие проверяется в тексте ПОСЛЕ указателя
SPHERE_BLOCKS = ['love', 'career', 'finances', 'health']

# Реестр зачинов-указателей — копия таблицы из content-guide.md (раздел «Реестр зачинов-
# указателей», заведён 20.08). content-guide прямо требует: «скрипт проверки обязан сначала
# отрезать указатель по реестру, иначе он либо поднимет ложную тревогу на нормальной конвенции,
# либо (хуже) заставит переводчика её сломать» — ровно это и случилось в L-1, где порог
# разнообразия применялся к строке ВМЕСТЕ с указателем и указатели вымело из es/pt.
# Указатель есть не только у сфер: birth_path («Ваш путь»), day_card («Сегодня») и reversed
# («Перевёрнутая <Карта>») тоже. Формы — в нижнем регистре, сравнение по началу строки.
POINTERS = {
    'ru': {
        'love': ['в любви', 'в отношениях'],
        'career': ['в работе', 'в карьере'],
        'finances': ['в финансах', 'в деньгах'],
        'health': ['для самочувствия', 'для здоровья'],
        'birth_path': ['ваш путь'],
        'day_card': ['сегодня'],
    },
    'en': {
        'love': ['in love', 'in relationships'],
        'career': ['at work', 'in career'],
        'finances': ['financially', 'with money'],
        'health': ['for wellbeing', 'for health'],
        'birth_path': ['your path'],
        'day_card': ['today'],
    },
    'es': {
        'love': ['en el amor', 'en las relaciones'],
        'career': ['en el trabajo', 'en la carrera'],
        'finances': ['en lo económico', 'con el dinero'],
        'health': ['para tu bienestar', 'para tu salud'],
        'birth_path': ['tu camino'],
        'day_card': ['hoy'],
    },
    'pt': {
        'love': ['no amor', 'nos relacionamentos'],
        'career': ['no trabalho', 'na carreira'],
        'finances': ['nas finanças', 'com o dinheiro'],
        'health': ['para o seu bem-estar', 'para a sua saúde'],
        'birth_path': ['seu caminho'],
        'day_card': ['hoje'],
    },
}
# у `reversed` указатель несёт имя самой карты («Перевёрнутая Императрица…»), поэтому он не
# перечислим таблицей: снимается слово-маркер вместе со всем, что стоит до него
REVERSED_MARKER = {
    'ru': re.compile(r'^перевёрнут\w*\b', re.I),
    'en': re.compile(r'^reversed\b', re.I),
    'es': re.compile(r'^.{0,40}?\binvertid[ao]s?\b', re.I),
    'pt': re.compile(r'^.{0,40}?\binvertid[ao]s?\b', re.I),
}
# Приписки сфер (`*_reversed`) по правилу content-guide указателей НЕ имеют — но в каноне
# нашлось 3 блока `love_reversed` и 3 `finances_reversed`, которые открываются указателем
# сферы. Раз канон это допускает, перевод обязан следовать ему карта-в-карту, а проверка —
# снимать указатель перед сравнением зачинов, иначе законное следование канону выглядит
# «сведённым зачином» (нашла приёмка L-3).
for _lang, _table in POINTERS.items():
    for _sphere in SPHERE_BLOCKS:
        _table[f'{_sphere}_reversed'] = list(_table[_sphere])

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


# Служебные слова, которые НЕ несут смысла в зачине. Нужны, чтобы сравнивать языки
# сопоставимо: русский обходится тире («Дурак — карта начала пути»), а романские обязаны
# ставить связку и артикль («El Loco es la carta de los comienzos»). Без их снятия окно
# в два слова попадает у ru на «карта начала» (информативно), а у es на «es la» (пусто) —
# и проверка объявляет находкой саму грамматику языка.
STOPWORDS = {
    'ru': {'и', 'в', 'во', 'на', 'о', 'об', 'к', 'с', 'со', 'у', 'это', 'а', 'но', 'же', 'то'},
    'en': {'the', 'a', 'an', 'is', 'are', 'of', 'to', 'in', 'at', 'it', 'this', 'and', 'for'},
    'es': {'el', 'la', 'los', 'las', 'un', 'una', 'es', 'son', 'está', 'de', 'del', 'al',
           'en', 'lo', 'que', 'y', 'se', 'a', 'su', 'sus', 'te', 'tu'},
    'pt': {'o', 'a', 'os', 'as', 'um', 'uma', 'é', 'são', 'está', 'de', 'do', 'da', 'dos',
           'das', 'em', 'no', 'na', 'nos', 'nas', 'que', 'e', 'se', 'ao', 'seu', 'sua'},
}


def first_words(text, n=2, lang=None):
    """Первые n ЗНАМЕНАТЕЛЬНЫХ слов: служебные снимаются по языку."""
    words = WORD_RE.findall(text.lower())
    if lang:
        stop = STOPWORDS.get(lang, set())
        words = [w for w in words if w not in stop]
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
    """Указатель ставится там, где он стоит в РУССКОМ КАНОНЕ у этой карты, а не по умолчанию
    (content-guide, 20.08): у четырёх карт `health` в каноне свободный, значит и в переводе
    свободный. Поэтому сверяется не «у всех ли есть указатель», а совпадение с каноном
    карта-в-карту — расхождение в любую сторону показывается человеку."""
    for lang in langs:
        for block in ['love', 'career', 'finances', 'health', 'birth_path', 'day_card',
                      'love_reversed', 'career_reversed', 'finances_reversed', 'health_reversed']:
            missing, extra = [], []
            for c in cards_new:
                t = c['content'].get(block, {}).get(lang)
                ru = c['content'].get(block, {}).get('ru')
                if not t or not ru:
                    continue
                ru_has = strip_pointer(ru, 'ru', block) != ru
                tr_has = strip_pointer(t, lang, block) != t
                if ru_has and not tr_has:
                    missing.append(c['id'])
                elif tr_has and not ru_has:
                    extra.append(c['id'])
            if not missing and not extra:
                continue
            print(f'[ОТЧЁТ] указатели {lang}.{block}: нет там, где канон его держит — '
                  f'{len(missing)} {missing[:4]}; есть там, где канон свободен — '
                  f'{len(extra)} {extra[:4]}')
            rep.note(f'{lang}.{block}: указателей не совпало с каноном '
                     f'({len(missing)} нет, {len(extra)} лишних)')


def strip_name(text, name):
    """Снимает имя карты в начале блока вместе с артиклем: «El Emperador es…» → «es…».
    Канон делает так же («Император — карта структуры»), поэтому имя в зачине — норма
    корпуса, а не находка; без его снятия проверка выдаёт по 3–4 ложных срабатывания
    на каждую карту, чьё имя длиннее одного слова."""
    if not name:
        return text
    bare = re.sub(r'^(el|la|los|las|o|a|os|as|the)\s+', '', name.strip(), flags=re.I)
    low = text.lstrip().lower()
    for form in (name.strip().lower(), bare.lower()):
        if form and low.startswith(form):
            return text.lstrip()[len(form):].lstrip(' ,.:;—-')
    return text


def strip_pointer(text, lang, block):
    """Снимает зачин-указатель по реестру content-guide. Возвращает текст ПОСЛЕ указателя.
    Указателя может не быть законно (четыре карты держат `health` свободным, потому что
    он свободен в русском каноне) — тогда текст возвращается как есть."""
    low = text.lstrip().lower()
    if block == 'reversed':
        m = REVERSED_MARKER.get(lang, REVERSED_MARKER['en']).match(low)
        if m:
            return text.lstrip()[m.end():].lstrip(' ,.:;—-')
        return text
    for form in sorted(POINTERS.get(lang, {}).get(block, []), key=len, reverse=True):
        if low.startswith(form):
            return text.lstrip()[len(form):].lstrip(' ,.:;—-')
    return text


def opening_of(card, block, lang):
    """Зачин блока для сравнения: снят указатель по реестру и имя карты."""
    t = card['content'].get(block, {}).get(lang)
    if not t:
        return None
    name = card.get('name', {}).get(lang, '')
    return first_words(strip_name(strip_pointer(t, lang, block), name), lang=lang)


def check_openings(cards_new, langs, rep, threshold=3):
    """Однообразие зачинов ПО КАЖДОМУ ЯЗЫКУ ОТДЕЛЬНО (урок задачи 25: переводчик сводит
    разные обороты оригинала к одной удобной конструкции — «Your body…» открывало 11 приписок
    из 78, хотя в русском разнобой).

    ⚠️ Норма берётся ИЗ КОРПУСА, а не из головы (урок задачи 31). Голый порог «3+ одинаковых
    зачина» на переводе даёт ложную тревогу: на тех же 22 картах канон ru даёт 15 таких групп,
    en — 67, то есть перевод «нарушает» правило РЕЖЕ оригинала. Дефект — не совпадение само
    по себе, а совпадение ТАМ, ГДЕ ОРИГИНАЛ РАЗЛИЧАЕТСЯ: значит смысл свёлся при переводе.
    Поэтому каждая группа сверяется с русскими зачинами ТЕХ ЖЕ адресов."""
    for lang in langs:
        if lang in CANON:
            continue
        repeats, examples = collections.Counter(), {}
        for c in cards_new:
            for b in blocks_of(c['id']):
                fw = opening_of(c, b, lang)
                if fw:
                    repeats[fw] += 1
                    examples.setdefault(fw, []).append((c, b))
        found, ok_by_canon = [], []
        for fw, n in repeats.most_common():
            if n < threshold:
                continue
            addrs = examples[fw]
            ru_starts = [opening_of(c, b, 'ru') for c, b in addrs]
            uniq_ru = len({s for s in ru_starts if s})
            label = (f'«{fw}» ×{n} '
                     f'({", ".join(f"{c['id']}.{b}" for c, b in addrs[:3])})')
            # Ошибка — только когда в русском ВСЕ зачины разные, а перевод свёл их в один:
            # тогда однообразие внесено переводом. Если русский сам повторяется хотя бы
            # частично (у всех тузов «рука из облака» — канонический элемент рисунка,
            # у финансов «Финансовая стабильность»/«устойчивость»), это свойство корпуса,
            # и жёсткий порог «3 совпадения в переводе» объявлял бы находкой саму карту.
            if uniq_ru == len(addrs) and uniq_ru > 1:
                found.append(f'{label} — в ru все зачины разные')
            else:
                ok_by_canon.append(f'{label} — в ru {uniq_ru} разных из {len(addrs)}')
        rep.section(f'сведённые зачины {lang} (совпали в переводе, различаются в ru)', found, sample=8)
        rep.errors.extend([f'{lang}: {f}' for f in found])
        if ok_by_canon:
            print(f'[ОТЧЁТ] {lang}: групп зачинов, повторяющих конвенцию канона: {len(ok_by_canon)}')
            for f in ok_by_canon[:4]:
                print(f'       {f}')


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


def check_course(rep, langs, use_git, path=COURSE_PATH):
    """Приёмка перевода курса (сессия L-4): заголовки модулей и уроков, теория, викторины.
    ⚠️ Главная проверка здесь — НЕ полнота, а `correct`: индекс верного ответа не должен уехать
    при переводе. Проект уже платил за это дважды (задачи 29 и 31): агент переставил варианты
    местами, не тронув `correct`, схема осталась валидной, контракт-тест молчал — и вопрос
    перестал проверять знание. Механически ловится только тем, что индекс и ЧИСЛО вариантов
    сверяются с каноном; совпадение по смыслу остаётся человеку."""
    data = json.loads(open(path, encoding='utf-8').read())
    mods = data['modules'] if isinstance(data, dict) else data
    old = None
    if use_git:
        head = subprocess.run(['git', 'show', f'HEAD:{COURSE_PATH}'], capture_output=True).stdout.decode('utf-8')
        if head.strip():
            o = json.loads(head)
            old = {m['id']: m for m in (o['modules'] if isinstance(o, dict) else o)}

    missing, empty, cyr, bad_status, structure, canon = [], [], [], [], [], []
    for m in mods:
        for lang in langs:
            if not (m.get('title', {}).get(lang) or '').strip():
                missing.append(f'модуль {m["id"]}: нет title.{lang}')
        for les in m['lessons']:
            lid = f'{m["id"]}/{les["id"]}'
            for lang in langs:
                if not (les.get('title', {}).get(lang) or '').strip():
                    missing.append(f'{lid}: нет title.{lang}')
                th = les.get('theory', {})
                text = th.get(lang)
                if text is None:
                    missing.append(f'{lid}: нет theory.{lang}')
                elif not text.strip():
                    empty.append(f'{lid}: theory.{lang} пустая')
                elif CYRILLIC.search(text):
                    cyr.append(f'{lid}: кириллица в theory.{lang}')
                if th.get('status', {}).get(lang) != 'draft':
                    bad_status.append(f'{lid}: theory status.{lang} = {th.get("status", {}).get(lang)}')
                if les.get('quizStatus', {}).get(lang) != 'draft':
                    bad_status.append(f'{lid}: quizStatus.{lang} = {les.get("quizStatus", {}).get(lang)}')
            for i, q in enumerate(les.get('quiz', [])):
                for lang in langs:
                    for field in ('q', 'explain'):
                        t = q.get(field, {}).get(lang)
                        if t is None:
                            missing.append(f'{lid} в{i + 1}: нет {field}.{lang}')
                        elif not t.strip():
                            empty.append(f'{lid} в{i + 1}: {field}.{lang} пустой')
                        elif CYRILLIC.search(t):
                            cyr.append(f'{lid} в{i + 1}: кириллица в {field}.{lang}')
                    # options — СПИСОК многоязычных объектов [{ru, en, …}], а не словарь по языкам
                    for j, opt in enumerate(q.get('options', [])):
                        t = opt.get(lang)
                        if t is None:
                            missing.append(f'{lid} в{i + 1}: нет варианта {j + 1}.{lang}')
                        elif not t.strip():
                            empty.append(f'{lid} в{i + 1}: вариант {j + 1}.{lang} пустой')
                        elif CYRILLIC.search(t):
                            cyr.append(f'{lid} в{i + 1}: кириллица в варианте {j + 1}.{lang}')
                if old:
                    om = old.get(m['id'])
                    ol = next((x for x in om['lessons'] if x['id'] == les['id']), None) if om else None
                    oq = ol.get('quiz', [])[i] if ol and i < len(ol.get('quiz', [])) else None
                    if oq is not None:
                        if oq.get('correct') != q.get('correct'):
                            canon.append(f'{lid} в{i + 1}: correct {oq.get("correct")} → {q.get("correct")}')
                        if len(oq.get('options', [])) != len(q.get('options', [])):
                            structure.append(f'{lid} в{i + 1}: число вариантов '
                                             f'{len(oq.get("options", []))} → {len(q.get("options", []))}')
                        for lang in CANON:
                            if oq.get('q', {}).get(lang) != q.get('q', {}).get(lang):
                                canon.append(f'{lid} в{i + 1}: вопрос {lang} изменён')
                            # порядок вариантов канона обязан сохраниться: переставили их —
                            # и `correct` указывает на дистрактор (задачи 29 и 31)
                            oo = [o.get(lang) for o in oq.get('options', [])]
                            no = [o.get(lang) for o in q.get('options', [])]
                            if oo != no:
                                canon.append(f'{lid} в{i + 1}: варианты {lang} изменены или переставлены')
            if old:
                om = old.get(m['id'])
                ol = next((x for x in om['lessons'] if x['id'] == les['id']), None) if om else None
                if ol:
                    for lang in CANON:
                        if ol.get('theory', {}).get(lang) != les.get('theory', {}).get(lang):
                            canon.append(f'{lid}: theory.{lang} изменена')

    # Викторины живут в ДВУХ местах: staging `content/quiz-*.json` и собранный course.json.
    # `merge_quiz.py` заменяет массив вопросов урока целиком, поэтому перевод, залитый прямо
    # в course.json, стирается первым же прогоном конвейера. Обратная ошибка не менее вероятна:
    # перевели staging и забыли слить — тогда приложение показывает старые вопросы, а причина
    # выглядит как «перевода нет». Различить эти два случая и есть смысл проверки.
    import glob
    staged = {}
    for path in sorted(glob.glob('content/quiz-*.json')):
        try:
            qf = json.loads(open(path, encoding='utf-8').read())
        except (OSError, ValueError):
            continue
        for entry in qf.get('lessons', []):
            staged[entry.get('lessonId')] = (path, entry.get('questions', []), qf.get('status') or {})
    unmerged = []
    for m in mods:
        for les in m['lessons']:
            info = staged.get(les['id'])
            if not info:
                continue
            path, questions, st = info
            for lang in langs:
                st_has = any((q.get('q', {}) or {}).get(lang) for q in questions)
                course_has = any((q.get('q', {}) or {}).get(lang) for q in les.get('quiz', []))
                if st_has and not course_has:
                    unmerged.append(f'{les["id"]}: {lang} есть в {path}, но не в course.json')
                elif course_has and not st_has:
                    unmerged.append(f'{les["id"]}: {lang} есть в course.json, но НЕ в staging — '
                                    f'следующий merge_quiz.py его сотрёт')
                if st.get(lang) and st.get(lang) != les.get('quizStatus', {}).get(lang):
                    unmerged.append(f'{les["id"]}: статус {lang} в staging «{st.get(lang)}», '
                                    f'в course.json «{les.get("quizStatus", {}).get(lang)}»')
    rep.section('staging викторин и course.json согласованы (merge_quiz.py прогнан)', unmerged)
    rep.errors.extend(unmerged)

    rep.section('курс залит целиком', missing)
    rep.section('пустых значений нет', empty)
    rep.section('кириллицы в новом языке нет', cyr)
    rep.section('статус нового языка = draft', bad_status)
    rep.section('структура викторины не менялась (число вариантов)', structure)
    rep.section('канон курса не тронут, индекс верного ответа на месте', canon)
    for lst in (missing, empty, cyr, bad_status, structure, canon):
        rep.errors.extend(lst)
    print('[ОТЧЁТ] совпадение вариантов ПО СМЫСЛУ механически не проверяется — '
          'если варианты переставляли, сверять текст верного ответа до и после руками')


def check_spreads(rep, langs, path=SPREADS_PATH):
    """Расклады: у них НЕТ статусов, поэтому единственная проверка — полнота и структура."""
    data = json.loads(open(path, encoding='utf-8').read())
    spreads = data['spreads'] if isinstance(data, dict) else data
    missing, empty, structure = [], [], []
    for s in spreads:
        for lang in langs:
            for field in ('name', 'description'):
                t = s.get(field, {}).get(lang)
                if t is None:
                    missing.append(f'{s["id"]}: нет {field}.{lang}')
                elif not t.strip():
                    empty.append(f'{s["id"]}: {field}.{lang} пустой')
            for i, pos in enumerate(s.get('positions', [])):
                t = pos.get(lang)
                if t is None:
                    missing.append(f'{s["id"]} поз.{i + 1}: нет {lang}')
                elif not t.strip():
                    empty.append(f'{s["id"]} поз.{i + 1}: {lang} пустая')
        if len(s.get('positions', [])) != s.get('cards'):
            structure.append(f'{s["id"]}: позиций {len(s.get("positions", []))}, карт {s.get("cards")}')
    rep.section('расклады залиты целиком', missing)
    rep.section('пустых значений нет', empty)
    rep.section('число позиций совпадает с числом карт', structure)
    for lst in (missing, empty, structure):
        rep.errors.extend(lst)


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
    ap.add_argument('--scope', default='cards', choices=('cards', 'course', 'spreads'),
                    help='что принимаем: колоду карт (по умолчанию), курс или расклады. '
                         'Курс и расклады — периметр сессии L-4')
    args = ap.parse_args()

    langs = [l.strip() for l in args.lang.split(',') if l.strip()]
    in_wave = WAVES[args.wave]

    if args.scope in ('course', 'spreads'):
        rep = Report()
        title = 'курс (теория и викторины)' if args.scope == 'course' else 'расклады'
        print(f'Приёмка: {title} · языки: {", ".join(langs)}')
        print('=' * 70)
        if args.scope == 'course':
            check_course(rep, langs, not args.no_git, args.file if args.file != CARDS_PATH else COURSE_PATH)
        else:
            check_spreads(rep, langs, args.file if args.file != CARDS_PATH else SPREADS_PATH)
        print('=' * 70)
        print(f'ОШИБОК: {len(rep.errors)}')
        print('ПРИЁМКА: ' + ('ЗЕЛЁНАЯ' if not rep.errors else 'КРАСНАЯ'))
        return 1 if rep.errors else 0

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
