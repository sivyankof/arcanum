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
COURSE_PATH = ROOT / "content" / "course.json"
PHRASES_PATH = ROOT / "content" / "phrases.json"

# --- пороги и словари (docs/content-guide.md) ---------------------------------

# Лимиты слов основных блоков. birth_path не нормирован — вычитан отдельно (задача 23).
# ⚠️ Границы РАЗНЫЕ для языков, и это не придирка: русский текст той же мысли короче
# английского на 20–25% (медиана career: ru 36 слов, en 45) — английский тратит слова
# на артикли и вспомогательные глаголы. Общая норма на два языка давала 100 «нарушений»,
# из которых 73 были просто русскими текстами нормальной длины (спека 31, 15.08).
WORD_LIMITS = {
    "general": {"ru": (40, 70), "en": (50, 85)},
    "reversed": {"ru": (30, 50), "en": (38, 62)},
    "love": {"ru": (30, 50), "en": (38, 60)},
    "career": {"ru": (28, 45), "en": (34, 56)},
    "day_card": {"ru": (28, 45), "en": (38, 56)},
    "finances": {"ru": (24, 38), "en": (28, 48)},
    "health": {"ru": (24, 40), "en": (30, 48)},
    "symbolism": {"ru": (40, 70), "en": (50, 85)},
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
    # ⚠️ Границы слова обязательны: без них «illness» ловился внутри «stillness».
    "en": r"diagnos|treatment|doctor|medication|\billness\b|symptom|therapy|prescription|clinic|disease",
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
    # Формы, которые первая редакция проверки пропустила, а вычитка нашла (спека 31, 15.08).
    # Все восемь классов ниже стоили корпусу 18 правок — проверка писалась по образцу шести
    # известных находок задачи 30 и потому видела только их форму.
    r"\bсам(?:ой|ому)\s+себ[ея]\b",              # «задолжали самой себе»
    r"\bвас\s+сам(?:ой|ого)\b",                  # «место для вас самой»
    r"\b(?:станьте|будьте)\s+(?:той|тем)\b",     # «станьте той, кто»
    r"\w+\(а\)",                                  # скобочная форма «понял(а)»
    r"\bя\s+(?:рада|рад)\b",                     # реплика, вложенная в уста читателя
    r"\b(?:хорошо|комфортно|спокойно)\s+(?:и\s+)?одн(?:ой|ому)\b",
    r"\b(?:подруг[еиу]|мамой|как\s+хозяин)\b",   # гендерная роль читателя или его окружения
    # Императив + прилагательное женского рода: «обнимите первой», «будьте любопытной»
    r"\b(?:будьте|станьте|обнимите|напишите|скажите|сделайте)\s+(?:\w+,?\s+){0,2}\w{4,}(?:ой|ей)\b",
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

# Указатели сферы в начале блока — конвенция корпуса (решение 15.08), не однообразие.
SPHERE_OPENERS = {
    "ru": ["в любви", "в отношениях", "в паре", "в работе", "в карьере", "в финансах",
           "в деньгах", "для самочувствия", "для здоровья", "сегодня", "ваш путь",
           "в перевёрнутом положении", "в перевёрнутом виде", "перевёрнутая", "перевёрнутый"],
    "en": ["in love", "in relationships", "at work", "in career", "financially",
           "with money", "for wellbeing", "for health", "today", "your path", "reversed"],
}

# Служебные слова: сами по себе зачином не являются, за ними идёт настоящее начало.
FUNCTION_WORDS = {"the", "a", "an", "is", "it", "this", "of", "это", "и", "а", "но"}

# Формула жанра «X — карта Y»: ею открывается почти каждый general, это не однообразие.
GENRE_FORMULAS = {"ru": ["карта", "это карта"], "en": ["card of", "card"]}

KEYWORDS_COUNT = 4
SEARCH_RANGE = (8, 12)
SEARCH_SPREAD_MAX = 8      # слово, подходящее больше чем 8 картам, поиску бесполезно
OPENING_MIN_REPEAT = 3     # порог однообразия зачинов (задача 25)
TIC_MIN_COUNT = 15         # оборот-тик по корпусу
TIC_CLUSTER_MIN = 3        # редкий оборот: кучность внутри карты имеет смысл считать от него
QUIZ_SPREAD_MAX = 0.33     # допустимый разброс длин вариантов внутри вопроса (задача 29)
QUIZ_LONGEST_PER_LESSON = 2  # сколько вопросов урока могут иметь самый длинный верный вариант
CLUSTER_BLOCKS = 3         # в скольких блоках одной карты оборот считается тиком автора
LEN_RATIO_TOLERANCE = 0.45 # допуск отклонения отношения длин en/ru от медианы корпуса
MIN_LEN_FOR_RATIO = 25     # короче этого отношение длин не информативно

LANGS = ("ru", "en")


# --- загрузка -----------------------------------------------------------------

def load_cards() -> list[dict]:
    data = json.loads(CARDS_PATH.read_text(encoding="utf-8"))
    return data["cards"] if isinstance(data, dict) else data


def load_course_units() -> list[dict]:
    """Уроки курса в форме «псевдокарт», чтобы текстовые проверки работали как есть.

    Курс и карты — разный контент, но проверяются одними правилами: рамка предсказания,
    род читателя, жаргон, глоссарий, однообразие зачинов. Приводим форму, а не копируем
    проверки — иначе они разъедутся при первой же правке (правило «повторяется 2+ раза»).
    """
    data = json.loads(COURSE_PATH.read_text(encoding="utf-8"))
    units = []
    for module in data["modules"]:
        for lesson in module["lessons"]:
            content: dict[str, dict[str, str]] = {}
            theory = lesson.get("theory")
            if theory:
                content["theory"] = theory
            for i, item in enumerate(lesson.get("quiz") or [], start=1):
                content[f"q{i}"] = item["q"]
                if item.get("explain"):
                    content[f"q{i}_explain"] = item["explain"]
                for j, option in enumerate(item["options"], start=1):
                    # ⚠️ Неверные варианты нарочно содержат то, что редполитика запрещает
                    # («точное предсказание», «higher powers») — в этом и состоит дидактика
                    # вопроса. Помечаем их, чтобы проверки тона и предсказания их пропускали.
                    wrong = "" if j - 1 == item["correct"] else "_wrong"
                    content[f"q{i}_opt{j}{wrong}"] = option
            if content:
                units.append({"id": lesson["id"], "name": lesson["title"], "content": content})
    return units


def load_quizzes() -> list[tuple[str, int, dict]]:
    """(id урока, номер вопроса, вопрос) по всем собранным викторинам курса."""
    data = json.loads(COURSE_PATH.read_text(encoding="utf-8"))
    out = []
    for module in data["modules"]:
        for lesson in module["lessons"]:
            for i, item in enumerate(lesson.get("quiz") or [], start=1):
                out.append((lesson["id"], i, item))
    return out


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


def strip_sphere_opener(text: str, lang: str, card_name: str = "") -> list[str]:
    """Слова текста без служебного начала: указателя сферы, имени карты и артиклей.

    Всё это законные зачины, повторять их обязано большинство блоков: «Туз Кубков — …»,
    «In love, …», «The Ace of Cups is …». Однообразие ищется в том, что идёт следом.
    """
    tokens = words(text)

    def drop_function_words():
        nonlocal tokens
        while tokens and tokens[0] in FUNCTION_WORDS:
            tokens = tokens[1:]

    def drop_prefix(prefix: list[str]):
        nonlocal tokens
        if prefix and tokens[:len(prefix)] == prefix:
            tokens = tokens[len(prefix):]
            return True
        return False

    for opener in SPHERE_OPENERS[lang]:
        if drop_prefix(opener.split()):
            break
    # Порядок важен: имя карты стоит ПОСЛЕ артикля («The Ace of Cups is…»),
    # а формула жанра — после имени («… is the card of beginnings»).
    drop_function_words()
    drop_prefix(words(card_name))
    drop_function_words()
    for formula in GENRE_FORMULAS[lang]:
        if drop_prefix(formula.split()):
            break
    drop_function_words()
    return tokens


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
                lo, hi = WORD_LIMITS[name][lang]
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


def _without_distractors(cards: list[dict]) -> list[dict]:
    """Копия без неверных вариантов викторины: в них запрещённая лексика — приём, а не дефект."""
    out = []
    for card in cards:
        content = {k: v for k, v in (card.get("content") or {}).items() if not k.endswith("_wrong")}
        out.append({**card, "content": content})
    return out


def check_2_prediction(cards: list[dict]) -> list[str]:
    """Рамка предсказания: «сбудется», «обещает», «вас ждёт»."""
    return _regex_check(_without_distractors(cards), PREDICTION)


def check_3_jargon(cards: list[dict]) -> list[str]:
    """Эзотерический жаргон, запрещённый тоном."""
    return _regex_check(_without_distractors(cards), JARGON)


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
    """Однообразие зачинов — отдельно по языку И типу блока (урок задачи 25).

    Указатель сферы («В любви…», «At work…») из зачина срезается: решением 15.08 это
    осознанная конвенция корпуса, а не однообразие. Считается то, что идёт ПОСЛЕ него —
    иначе проверка вечно показывала бы 76 из 78 и её перестали бы читать.
    """
    buckets: dict[tuple[str, str], Counter] = defaultdict(Counter)
    where: dict[tuple[str, str, str], list[str]] = defaultdict(list)
    for card in cards:
        for name, lang, text in blocks(card):
            opening = " ".join(strip_sphere_opener(text, lang, card["name"][lang])[:2])
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
            # На коротких строках («Да» → «Yes») отношение длин ничего не значит: три знака
            # против восьми дают «расхождение 267%», хотя перевод точен.
            if ru and en and len(ru) >= MIN_LEN_FOR_RATIO:
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


def check_11_quiz_options(_units: list[dict]) -> list[str]:
    """Длина вариантов викторины: верный не должен быть самым длинным (задача 29).

    Ученик, не знающий материала, выбирает самый развёрнутый вариант и попадает —
    вопрос перестаёт проверять знание. Порог: не больше 2 таких вопросов из 5 в уроке.
    """
    out = []
    per_lesson: dict[str, list[int]] = defaultdict(list)
    for lesson_id, number, item in load_quizzes():
        for lang in LANGS:
            lengths = [len(o[lang]) for o in item["options"]]
            correct = item["correct"]
            if lengths.index(max(lengths)) == correct and lengths.count(max(lengths)) == 1:
                if lang == "ru":
                    per_lesson[lesson_id].append(number)
                spread = (max(lengths) - min(lengths)) / max(lengths)
                if spread > QUIZ_SPREAD_MAX:
                    out.append(f"{lesson_id} в{number}.{lang}: верный самый длинный, "
                               f"разброс {spread:.0%} ({min(lengths)}→{max(lengths)} знаков)")
        texts = [o["ru"].strip().lower() for o in item["options"]]
        if len(set(texts)) != len(texts):
            out.append(f"{lesson_id} в{number}: варианты повторяются дословно")
    for lesson_id, numbers in sorted(per_lesson.items()):
        if len(numbers) > QUIZ_LONGEST_PER_LESSON:
            out.append(f"[урок] {lesson_id}: верный самый длинный в {len(numbers)} вопросах "
                       f"из 5 (порог {QUIZ_LONGEST_PER_LESSON}) — вопросы {numbers}")
    return out


CHECKS = [
    (1, "Лимиты длины блоков", check_1_limits, False),
    (2, "Рамка предсказания", check_2_prediction, True),
    (3, "Эзотерический жаргон", check_3_jargon, True),
    (4, "Медицина в блоках здоровья", check_4_medicine, False),
    (5, "Женский род читателя", check_5_gender, True),
    (6, "Канонический глоссарий", check_6_glossary, True),
    (7, "Однообразие зачинов", check_7_openings, True),
    (8, "Обороты-тики и кучность", check_8_tics, True),
    (9, "Рассинхрон ru↔en", check_9_ru_en, True),
    (10, "Наборы слов", check_10_words, False),
    (11, "Длина вариантов викторины", check_11_quiz_options, True),
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Корпусная проверка контента (спека 31)")
    parser.add_argument("--only", nargs="*", type=int, help="номера проверок")
    parser.add_argument("--scope", choices=("cards", "course"), default="cards",
                        help="что проверять: корпус карт или тексты курса")
    parser.add_argument("--list", action="store_true", help="показать список проверок")
    args = parser.parse_args()

    if args.list:
        for number, title, _, in_course in CHECKS:
            mark = "карты + курс" if in_course else "только карты"
            print(f"{number:>2}. {title} ({mark})")
        return 0

    if args.scope == "course":
        units = load_course_units()
        print(f"Курс: {len(units)} уроков с текстами, {COURSE_PATH.relative_to(ROOT)}\n")
    else:
        units = load_cards()
        print(f"Корпус: {len(units)} карт, {CARDS_PATH.relative_to(ROOT)}\n")

    total = 0
    for number, title, func, in_course in CHECKS:
        if args.only and number not in args.only:
            continue
        if args.scope == "course" and not in_course:
            continue
        if args.scope == "cards" and number == 11:
            continue
        findings = func(units)
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
