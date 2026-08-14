"""Корпусная проверка контента карт (спека 31).

Ловит то, что не видит вычитка отдельного текста: дефект живёт в статистике корпуса
или в соседстве блоков одной карты. Ничего не правит — только печатает отчёт.

Запуск из корня репозитория:
    python scripts/check_canon.py             # все проверки
    python scripts/check_canon.py --only 5 7  # только выбранные номера
    python scripts/check_canon.py --list      # список проверок

Проверки писались под задачу 31, но рассчитаны на повторное использование волнами
ES/PT (задача 28) и новыми модулями курса: пороги вынесены в константы наверху файла.
"""

from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

# Windows-консоль по умолчанию cp1251 и падает на кириллице в выводе.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
CARDS_PATH = ROOT / "content" / "cards.json"
PHRASES_PATH = ROOT / "content" / "phrases.json"

# --- пороги и словари (docs/content-guide.md) ---------------------------------

# Лимиты слов основных блоков. birth_path не нормирован — вычитан отдельно (задача 23).
WORD_LIMITS = {
    "general": (40, 80),
    "reversed": (35, 60),
    "love": (35, 60),
    "career": (35, 60),
    "day_card": (35, 60),
    "finances": (25, 50),
    "health": (25, 40),
    "symbolism": (40, 80),
}

# Приписки сфер меряются знаками, а не словами (задача 25).
CHAR_LIMITS = {
    "love_reversed": {"ru": (100, 220), "en": (90, 220)},
    "career_reversed": {"ru": (100, 220), "en": (90, 220)},
    "finances_reversed": {"ru": (100, 220), "en": (90, 220)},
    "health_reversed": {"ru": (100, 220), "en": (90, 220)},
}

HEALTH_BLOCKS = ("health", "health_reversed")

# Рамка предсказания: мы про рефлексию, а не про «вас ждёт» (content-guide, logic-spec §3).
# ⚠️ Ловим только конструкции, где обещает КАРТА. Первая редакция брала «обеща» целиком
# и давала 86 находок, почти все — про обещания людей («обещания звучат красиво»,
# «долги возвращать, обещания выполнять»), то есть ровно тот шум, что топит настоящее.
# ⚠️ Отрицание — законный приём и даже полезный: «Крупных сумм карта НЕ обещает» снимает
# рамку предсказания, а не ставит её. Такие места отсекаются lookbehind'ом.
PREDICTION = {
    "ru": r"сбыл|сбудет|сбывает|(?<!не )обещает|(?<!не )обещают|вас ждёт|вас ожидает|предсказ|"
          r"судьба реш|исполнит|гарантир|непременно случ|обязательно прид",
    "en": r"will come true|comes true|card promises(?! no)|promises you|promises a |awaits you|"
          r"is waiting for you|destiny|guaranteed|is bound to happen",
}

JARGON = {
    "ru": r"вибрац|энерги[ияюей] вселенн|высшие силы|карма нака|астрал|чакр|аур[аыу]\b|тонкий план",
    "en": r"vibrations|the universe will|higher powers|karma will|astral|chakra|aura\b",
}

MEDICINE = {
    "ru": r"диагноз|лечен|лечит|врач|таблетк|болезн|симптом|давлени[ея]|анализ[ыов]|терапи|"
          r"лекарств|обследован|клиник|заболеван",
    "en": r"diagnos|treatment|doctor|medication|illness|symptom|therapy|prescription|clinic|disease",
}

# Женский род ЧИТАТЕЛЯ. Голые «сама» / «одной» из набора убраны намеренно: в задаче 25
# они давали ложные срабатывания на «одна сторона», «одна привычка» — шум топил находки.
# ⚠️ «собой» и «сама собой» тоже исключены: рода не несут («быть собой», «переполняется
# сама собой» — про чашу). Окончания -ей/-ою обязательны: первая редакция искала только
# -ой и прошла мимо «быть настоящей, а не удобной» — известной находки задачи 30.
FEMININE = r"(?:ой|ей|ою)"
GENDER = [
    rf"\bчувствуете\s+себя\s+\w+{FEMININE}\b",
    rf"\bбыть\s+(?!собой|сам)\w+{FEMININE}\b",
    rf"\bоставаться\s+(?!собой|сам)\w+{FEMININE}\b",
    r"\bсам(?:ой|а)\s+соб(?:ой|ою)\b",
    r"\bостат\w*\s+(?:\w+\s+){0,3}одн(?:а|ой)\b",
    r"\bостал(?:ась|ись)\s+(?:\w+\s+){0,3}одн(?:а|ой)\b",
    r"\b(?:я|вы)\s+(?:\w+\s+){0,2}\w{3,}ла\b",
    r"\bя\s+(?:должна|готова|уверена|способна|виновата|обижена|счастлива|одинока)\b",
    # Мужской род читателя — тот же дефект: корпус безличен, а не мужской.
    # ⚠️ «быть \w+ым» сюда не годится: в русском это чаще про предмет («путь может быть
    # непростым», «обмен перестал быть равным») — обе находки первой редакции были ложными.
    r"\bчувствуете\s+себя\s+\w+ым\b",
    r"\bя\s+(?:должен|готов|уверен|способен|виноват|обижен|счастлив|одинок)\b",
]
# Существительные на «-ла»: глагол прошедшего времени от них не отличить без морфологии,
# а список короткий. Без него «вы даёте телу тепла» читалось как женский род.
GENDER_NOUNS = r"\b(?:тепла|дела|тела|числа|масла|крыла|зеркала|начала|светила|стекла|весла)\b"

# Канонический глоссарий: масти и имена карт переименовывать нельзя.
# ⚠️ «чаша» и «посох» как ПРЕДМЕТЫ на картинке законны («переливает воду из чаши в чашу»,
# посох Отшельника) — запрещено называть так МАСТЬ. Поэтому ищем только форму термина:
# слово с заглавной или во множественном рядом с «масть/масти».
GLOSSARY = {
    "ru": r"масть\s+(?:чаш|посох|денари)|мает?и\s+(?:чаш|посох|денари)|\bденарии\b|"
          r"обратн(?:ая|ой|ую) карт",
    "en": r"Rider-Waite",
}

# Имена карт — канон из cards.json. Общепринятые синонимы в текстах называют карту иначе,
# чем заголовок страницы: пользователь видит «Fortitude» сверху и «Strength» в абзаце.
NAME_ALIASES = {
    "strength": (r"\bStrength\b", "Fortitude"),
    "judgement": (r"\bJudgement\b|\bThe Judgment\b", "The Last Judgment"),
}

# Запрещённое в search: обещания сбычи и медицина (content-guide).
# ⚠️ «рак» обязан быть в границах слова целиком: без \b он ловил «брак», а брак —
# законный поисковый запрос. «Исцеление» оставлено разрешённым: у Звезды и Умеренности
# это душевное исцеление, а запрет content-guide — про диагнозы и лечение.
SEARCH_BANNED = r"выигрыш|он вернётся|она вернётся|приворот|\bрак\b|депресси|беременн|"
SEARCH_BANNED += r"смерть близк|диагноз"

# Структурные обороты жанра — не тики: «Туз Кубков — это…», «is the card of».
STRUCTURAL_TRIGRAM = (
    r"^(?:the |is the |of |a |an )|card of|the ace|the two|the three|the four|the five|"
    r"the six|the seven|the eight|the nine|the ten|of wands|of cups|of swords|of pentacles|"
    r"кубков|жезлов|мечей|пентаклей|это карта|карта дня"
)

KEYWORDS_COUNT = 4
SEARCH_RANGE = (8, 12)
SEARCH_SPREAD_MAX = 8      # слово, подходящее больше чем 8 картам, поиску бесполезно
OPENING_MIN_REPEAT = 3     # порог однообразия зачинов (задача 25)
TIC_MIN_COUNT = 15         # оборот-тик по корпусу
TIC_CLUSTER_MIN = 3        # редкий оборот: кучность внутри карты имеет смысл считать от него
CLUSTER_BLOCKS = 3         # в скольких блоках одной карты оборот считается тиком автора
LEN_RATIO_TOLERANCE = 0.45 # допуск отклонения отношения длин en/ru от медианы корпуса

LANGS = ("ru", "en")


# --- загрузка -----------------------------------------------------------------

def load_cards() -> list[dict]:
    data = json.loads(CARDS_PATH.read_text(encoding="utf-8"))
    return data["cards"] if isinstance(data, dict) else data


def words(text: str) -> list[str]:
    return re.findall(r"[\w’'-]+", text.lower())


def blocks(card: dict):
    """Отдаёт (имя блока, язык, текст) для всех непустых текстов карты."""
    for name, block in (card.get("content") or {}).items():
        for lang in LANGS:
            text = (block.get(lang) or "").strip()
            if text:
                yield name, lang, text


def addr(card: dict, block: str, lang: str) -> str:
    return f"{card['id']}.{block}.{lang}"


# --- проверки -----------------------------------------------------------------
# Каждая возвращает список строк-находок. Пустой список = проверка чиста.

def check_1_limits(cards: list[dict]) -> list[str]:
    """Лимиты длины блоков (content-guide §Структура блоков карты).

    Недобор и перебор печатаются раздельно: если корпус систематически короче нормы,
    это разговор про норму, а не сто отдельных дефектов.
    """
    short, long = [], []
    for card in cards:
        for name, lang, text in blocks(card):
            if name in WORD_LIMITS:
                lo, hi = WORD_LIMITS[name]
                n, unit = len(words(text)), "слов"
            elif name in CHAR_LIMITS:
                lo, hi = CHAR_LIMITS[name][lang]
                n, unit = len(text), "знаков"
            else:
                continue
            if n < lo:
                short.append(f"[короче] {addr(card, name, lang)}: {n} {unit}, норма {lo}–{hi}")
            elif n > hi:
                long.append(f"[длиннее] {addr(card, name, lang)}: {n} {unit}, норма {lo}–{hi}")
    return short + long


def _regex_check(cards: list[dict], patterns: dict[str, str], only_blocks=None) -> list[str]:
    out = []
    for card in cards:
        for name, lang, text in blocks(card):
            if only_blocks and name not in only_blocks:
                continue
            hits = re.findall(patterns[lang], text, flags=re.IGNORECASE)
            if hits:
                out.append(f"{addr(card, name, lang)}: {sorted(set(h.lower() for h in hits))} — «{text[:110]}…»")
    return out


def check_2_prediction(cards: list[dict]) -> list[str]:
    """Рамка предсказания: «сбудется», «обещает», «вас ждёт»."""
    return _regex_check(cards, PREDICTION)


def check_3_jargon(cards: list[dict]) -> list[str]:
    """Эзотерический жаргон, запрещённый тоном."""
    return _regex_check(cards, JARGON)


def check_4_medicine(cards: list[dict]) -> list[str]:
    """Медицина в блоках здоровья (риск ревью сторов)."""
    return _regex_check(cards, MEDICINE, only_blocks=HEALTH_BLOCKS)


def check_5_gender(cards: list[dict]) -> list[str]:
    """Женский род читателя (решение 15.08: корпус безличен)."""
    out = []
    for card in cards:
        for name, lang, text in blocks(card):
            if lang != "ru":
                continue
            seen: set[int] = set()
            for pattern in GENDER:
                for hit in re.finditer(pattern, text, flags=re.IGNORECASE):
                    # Один и тот же оборот ловится несколькими паттернами — считаем один раз.
                    if any(abs(hit.start() - s) < 12 for s in seen):
                        continue
                    if re.search(GENDER_NOUNS, hit.group(0), flags=re.IGNORECASE):
                        continue
                    around = text[max(0, hit.start() - 45):hit.end() + 30]
                    seen.add(hit.start())
                    out.append(f"{addr(card, name, lang)}: «…{around}…»")
    return out


def check_6_glossary(cards: list[dict]) -> list[str]:
    """Канонический глоссарий мастей и неканоничные имена карт в английских текстах."""
    out = _regex_check(cards, GLOSSARY)
    for card in cards:
        for name, lang, text in blocks(card):
            if lang != "en":
                continue
            for _, (pattern, canon) in NAME_ALIASES.items():
                # Регистр важен: «strength» строчными — обычное слово, «Strength» — имя карты.
                hits = re.findall(pattern, text)
                if hits:
                    out.append(f"[имя] {addr(card, name, lang)}: {sorted(set(hits))} — канон «{canon}»")
    return out


def check_7_openings(cards: list[dict]) -> list[str]:
    """Однообразие зачинов — отдельно по языку И типу блока (урок задачи 25)."""
    buckets: dict[tuple[str, str], Counter] = defaultdict(Counter)
    where: dict[tuple[str, str, str], list[str]] = defaultdict(list)
    for card in cards:
        for name, lang, text in blocks(card):
            opening = " ".join(words(text)[:2])
            buckets[(lang, name)][opening] += 1
            where[(lang, name, opening)].append(card["id"])
    out = []
    for (lang, name), counter in sorted(buckets.items()):
        # Сводка по ПЕРВОМУ слову: «В финансах, а…» и «В финансах, но…» — один и тот же
        # зачин для читателя, а по двум словам они расходятся и выглядят безобидно.
        first_words = Counter(op.split()[0] for op in counter.elements())
        top_word, top_count = first_words.most_common(1)[0]
        total = sum(counter.values())
        if top_count >= OPENING_MIN_REPEAT and top_count / total >= 0.25:
            out.append(f"[сводка] {name}.{lang}: «{top_word}…» открывает {top_count} из {total} блоков")
        for opening, count in counter.most_common():
            if count >= OPENING_MIN_REPEAT:
                ids = ", ".join(where[(lang, name, opening)])
                out.append(f"{name}.{lang}: «{opening}…» × {count} — {ids}")
    return out


def check_8_tics(cards: list[dict]) -> list[str]:
    """Обороты-тики по корпусу и их кучность внутри одной карты.

    ⚠️ Кучность считается только для РЕДКИХ оборотов. Частый оборот в двух блоках одной
    карты — статистика, а не тик: «a good time» стоит в корпусе 29 раз, и две его
    встречи у Дурака ничего не значат. Тик — это когда автор повторил СВОЮ находку.
    """
    corpus: Counter = Counter()
    per_card: dict[str, Counter] = defaultdict(Counter)
    for card in cards:
        for name, lang, text in blocks(card):
            tokens = words(text)
            seen_here = set()
            for i in range(len(tokens) - 2):
                trigram = " ".join(tokens[i:i + 3])
                if trigram in seen_here:
                    continue
                seen_here.add(trigram)
                corpus[(lang, trigram)] += 1
                per_card[card["id"]][(lang, trigram)] += 1
    out = []
    for (lang, trigram), count in corpus.most_common():
        if count >= TIC_MIN_COUNT and not re.search(STRUCTURAL_TRIGRAM, trigram):
            out.append(f"[тик] {lang}: «{trigram}» × {count}")
    for card_id, counter in sorted(per_card.items()):
        for (lang, trigram), count in counter.items():
            # Порог 3 блока: именно так в задаче 25 нашлась Справедливость («Спросите себя»
            # в трёх сферах из четырёх). Два блока — обычное совпадение, 271 запись шума.
            if (count >= CLUSTER_BLOCKS and corpus[(lang, trigram)] <= TIC_MIN_COUNT
                    and not re.search(STRUCTURAL_TRIGRAM, trigram)):
                out.append(f"[кучность] {card_id} {lang}: «{trigram}» в {count} блоках одной карты")
    return out


def check_9_ru_en(cards: list[dict]) -> list[str]:
    """Рассинхрон пары ru↔en: длина и дописанные переводчиком обстоятельства."""
    ratios = []
    pairs = []
    for card in cards:
        for name, block in (card.get("content") or {}).items():
            ru, en = (block.get("ru") or "").strip(), (block.get("en") or "").strip()
            if ru and en:
                ratios.append(len(en) / len(ru))
                pairs.append((card, name, ru, en))
    if not ratios:
        return []
    median = statistics.median(ratios)
    lo, hi = median * (1 - LEN_RATIO_TOLERANCE), median * (1 + LEN_RATIO_TOLERANCE)
    out = [f"[справка] медиана отношения длин en/ru = {median:.2f}, коридор {lo:.2f}–{hi:.2f}"]
    for card, name, ru, en in pairs:
        ratio = len(en) / len(ru)
        if not lo <= ratio <= hi:
            out.append(f"[длина] {card['id']}.{name}: en/ru = {ratio:.2f} ({len(ru)} → {len(en)} знаков)")
        # Обстоятельство в зачине английского, которого нет в русском (урок задачи 25).
        head = re.match(r"^(at|in|when|after|before|during|on)\b\s+\w+", en, flags=re.IGNORECASE)
        if head and not re.match(r"^(в|на|во|когда|после|перед|при|у)\b", ru, flags=re.IGNORECASE):
            out.append(f"[зачин] {card['id']}.{name}: en «{head.group(0)}…» ← ru «{' '.join(ru.split()[:3])}…»")
    return out


def check_10_words(cards: list[dict]) -> list[str]:
    """Наборы слов: состав, дубли, частотность, запрещённое в search."""
    out = []
    spread: dict[str, Counter] = {lang: Counter() for lang in LANGS}
    for card in cards:
        for lang in LANGS:
            kw = [w.strip() for w in (card.get("keywords") or {}).get(lang, [])]
            se = [w.strip() for w in (card.get("search") or {}).get(lang, [])]
            if len(kw) != KEYWORDS_COUNT:
                out.append(f"{card['id']}.keywords.{lang}: {len(kw)} слов, норма {KEYWORDS_COUNT}")
            if not SEARCH_RANGE[0] <= len(se) <= SEARCH_RANGE[1]:
                out.append(f"{card['id']}.search.{lang}: {len(se)} слов, норма {SEARCH_RANGE[0]}–{SEARCH_RANGE[1]}")
            for word in kw:
                if lang == "ru" and word != word.lower():
                    out.append(f"{card['id']}.keywords.ru: «{word}» не строчными")
            dupes = {w for w in kw if w.lower() in {s.lower() for s in se}}
            if dupes:
                out.append(f"{card['id']}.{lang}: дубль витрины и поиска — {sorted(dupes)}")
            for bucket, name in ((kw, "keywords"), (se, "search")):
                repeated = [w for w, c in Counter(x.lower() for x in bucket).items() if c > 1]
                if repeated:
                    out.append(f"{card['id']}.{name}.{lang}: повтор внутри набора — {repeated}")
            banned = [w for w in se if re.search(SEARCH_BANNED, w, flags=re.IGNORECASE)]
            if banned:
                out.append(f"{card['id']}.search.{lang}: запрещённое — {banned}")
            for word in set(w.lower() for w in kw + se):
                spread[lang][word] += 1
    for lang in LANGS:
        for word, count in spread[lang].most_common():
            if count > SEARCH_SPREAD_MAX:
                out.append(f"[частотность] {lang}: «{word}» встречается у {count} карт (порог {SEARCH_SPREAD_MAX})")
    return out


CHECKS = [
    (1, "Лимиты длины блоков", check_1_limits),
    (2, "Рамка предсказания", check_2_prediction),
    (3, "Эзотерический жаргон", check_3_jargon),
    (4, "Медицина в блоках здоровья", check_4_medicine),
    (5, "Женский род читателя", check_5_gender),
    (6, "Канонический глоссарий", check_6_glossary),
    (7, "Однообразие зачинов", check_7_openings),
    (8, "Обороты-тики и кучность", check_8_tics),
    (9, "Рассинхрон ru↔en", check_9_ru_en),
    (10, "Наборы слов", check_10_words),
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Корпусная проверка контента карт (спека 31)")
    parser.add_argument("--only", nargs="*", type=int, help="номера проверок")
    parser.add_argument("--list", action="store_true", help="показать список проверок")
    args = parser.parse_args()

    if args.list:
        for number, title, _ in CHECKS:
            print(f"{number:>2}. {title}")
        return 0

    cards = load_cards()
    print(f"Корпус: {len(cards)} карт, {CARDS_PATH.relative_to(ROOT)}\n")

    total = 0
    for number, title, func in CHECKS:
        if args.only and number not in args.only:
            continue
        findings = func(cards)
        # Справочные строки (медиана длин) находками не считаются.
        real = [f for f in findings if not f.startswith("[справка]")]
        total += len(real)
        mark = "—" if not real else f"{len(real)}"
        print(f"=== {number}. {title}: {mark}")
        for line in findings:
            print(f"    {line}")
        print()

    print(f"Итого находок: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
