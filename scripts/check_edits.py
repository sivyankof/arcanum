"""Проверка внесённых правок «было → стало» (спека 35).

Дополняет `check_canon.py`, а не повторяет его. Разница в предмете:
check_canon смотрит на КОРПУС в его текущем виде («нет ли дефекта сейчас»),
а этот скрипт — на САМУ ПРАВКУ («не сломала ли она то, что было целым»).
Второе первым не ловится: текст после правки может проходить все корпусные
проверки и при этом быть хуже прежнего — тавтология, повтор с соседним блоком,
уехавший смысл, парный язык, оставшийся со старой мыслью.

Повод — урок задачи 31: замену «напишите первой» → «напишите первым делом»
в цитате видно верной, а в абзаце («Сделайте шаг навстречу: напишите первым
делом») смысл уехал с «первым из двоих» на «сначала».

Запуск из корня репозитория:
    python scripts/check_edits.py docs/specs/31-changed-addresses.md
    python scripts/check_edits.py docs/specs/28p-changed-addresses.md --only 9 10
    python scripts/check_edits.py <файл> --only 3 4
    python scripts/check_edits.py --list

Формат входного файла — тот же, каким задача 31 отдала список редактору, но адрес
бывает ДВУХ видов:

    ## <card>.<block>.<lang>              — блок карты (content/cards.json)
    - было: <текст>
    - стало: <текст>

    ## <lessonId>-q<N>[<опция>].<lang>    — дистрактор викторины (content/quiz-*.json)
    - было: <текст>
    - стало: <текст>

Второй вид — например `m1l1-q2[1].es`: `m1l1` — id урока, `q2` — второй вопрос
урока (счёт с единицы), `[1]` — второй вариант ответа (счёт с нуля), `es` — язык.
До 23.08 такой адрес парсер молча пропускал (понимал только три части через точку),
из-за чего обе волны правок дистракторов (28е — 121 адрес, 28п — 122 адреса) прошли
приёмку этим скриптом как «0 записей, 0 находок» — ложно-зелёный отчёт при
непроверенном контенте.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

from check_canon import (
    CHAR_LIMITS,
    LANGS,
    WORD_LIMITS,
    load_cards,
    words,
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent

# Адрес дистрактора викторины: m1l1-q2[1].es — урок, вопрос по порядку (с единицы),
# вариант (с нуля), язык. Границы диапазонов (реальные ли урок/вопрос/вариант)
# регулярка не проверяет — это дело проверки 1 («нет урока/вопроса/варианта»),
# у регулярки задача одна: отличить этот вид адреса от карточного и от мусора.
QUIZ_ADDR_RE = re.compile(
    r"^(?P<lesson>[a-z0-9]+)-q(?P<qnum>\d+)\[(?P<opt>\d+)\]\.(?P<lang>ru|en|es|pt)$"
)

# Доля общих слов «было»/«стало» ниже порога = правка сменила мысль, а не формулировку.
# Такие места читаются глазами: часть из них законна (снятие рамки предсказания требует
# другой фразы), часть — замена темы блока, которой редактор не видел.
MEANING_DRIFT = 0.55

# Слова короче этого в проверке тавтологии не участвуют: «себя», «вам», «это»
# законно повторяются в любом тексте.
STEM_MIN = 6
STEM_LEN = 5

# Служебные слова: повторяются всегда, тавтологией не являются.
STOPWORDS = {
    "ru": {"который", "которая", "которые", "которое", "которого", "которых", "которым",
           "когда", "чтобы", "сейчас", "может", "можно", "нужно", "просто", "больше",
           "меньше", "будет", "будут", "своей", "своих", "своего", "своим", "этого",
           "этому", "этой", "того", "тому", "если", "чтото", "человек", "человека"},
    "en": {"which", "there", "their", "these", "those", "about", "would", "could", "should",
           "where", "while", "yourself", "something", "someone", "anything", "really",
           "you're", "you'll", "yours", "other", "another", "through"},
    # es/pt заведены при приёмке L-5: до неё скрипт падал на них KeyError прямо в проверке
    # тавтологий, то есть правки в переводах не проверялись вовсе — а их в одной волне 216.
    # Состав тот же по смыслу, что у ru/en: частотные служебные и связочные слова, которые
    # повторяются в любом тексте и без снятия дают сплошной шум.
    "es": {"cuando", "porque", "aunque", "donde", "mientras", "ahora", "puede", "puedes",
           "quiere", "quieres", "tiene", "tienes", "hacer", "hace", "haces", "estar",
           "estás", "está", "están", "algo", "alguien", "sobre", "entre", "desde", "hasta",
           "para", "pero", "como", "eso", "esto", "esta", "este", "otro", "otra", "más",
           "muy", "también", "siempre", "nunca", "todo", "toda", "todos", "todas"},
    "pt": {"quando", "porque", "embora", "onde", "enquanto", "agora", "pode", "podes",
           "quer", "quere", "tem", "tens", "fazer", "faz", "estar", "está", "estão",
           "algo", "alguém", "sobre", "entre", "desde", "até", "para", "mas", "como",
           "isso", "isto", "essa", "esse", "outro", "outra", "mais", "muito", "também",
           "sempre", "nunca", "tudo", "toda", "todos", "todas", "você"},
}

# Общая часть пары: одна и та же мысль на двух языках. Если правка сменила мысль
# в одном языке, а парный остался прежним, языки разъехались — класс дефекта,
# который задача 25 нашла на «At work» и который построчная вычитка не показывает.
PAIRED_BLOCKS = tuple(WORD_LIMITS) + tuple(CHAR_LIMITS)

WORD_SET_FIELDS = ("keywords", "search")


# --- разбор входного файла ----------------------------------------------------

def parse_edits(path: Path) -> tuple[list[dict], list[str]]:
    """Записи «было → стало» из md-файла списка адресов + список нераспознанных.

    Каждая запись помечена полем `kind`: `"card"` (`<карта>.<блок>.<язык>`, три
    части через точку) или `"quiz"` (`QUIZ_ADDR_RE`). Раньше адрес, не подошедший
    под три-через-точку, просто пропускался (`continue`) — и заодно НЕ сбрасывал
    `current`, так что следующие строки «было:»/«стало:» тихо приписывались
    предыдущей распознанной записи. Теперь нераспознанный адрес обнуляет `current`
    (его тело никуда не приписывается) и попадает в отдельный список — вызывающий
    код обязан его показать, а не проглотить молча.
    """
    edits: list[dict] = []
    unparsed: list[str] = []
    current: dict | None = None
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()
        if line.startswith("## "):
            address = line[3:].strip()
            quiz_match = QUIZ_ADDR_RE.match(address)
            if quiz_match:
                current = {
                    "addr": address,
                    "kind": "quiz",
                    "lesson": quiz_match["lesson"],
                    "qnum": int(quiz_match["qnum"]),
                    "opt": int(quiz_match["opt"]),
                    "lang": quiz_match["lang"],
                }
                edits.append(current)
                continue
            parts = address.split(".")
            if len(parts) == 3:
                current = {"addr": address, "kind": "card",
                           "card": parts[0], "block": parts[1], "lang": parts[2]}
                edits.append(current)
                continue
            current = None
            unparsed.append(address)
        elif current is not None and line.startswith("- было: "):
            current["before"] = line[len("- было: "):].strip()
        elif current is not None and line.startswith("- стало: "):
            current["after"] = line[len("- стало: "):].strip()
    edits = [e for e in edits if "before" in e and "after" in e]
    return edits, unparsed


def load_quiz_lessons() -> dict[str, dict]:
    """lessonId → урок из ЧЕРНОВИКОВ викторины (content/quiz-*.json).

    Списки правок (28е, 28п) писались по черновикам редактора — там дистракторы
    правятся ДО сборки. `content/course.json` — уже собранный `merge_quiz.py`
    результат; сверяться с ним значило бы проверять не тот файл, который редактор
    держал перед глазами.
    """
    lessons: dict[str, dict] = {}
    for path in sorted((ROOT / "content").glob("quiz-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        for lesson in data.get("lessons") or []:
            lessons[lesson["lessonId"]] = lesson
    return lessons


def quiz_question(lessons: dict[str, dict], lesson_id: str, qnum: int) -> dict | None:
    """Вопрос урока по 1-based номеру адреса (q2 → questions[1]), или None."""
    lesson = lessons.get(lesson_id)
    if lesson is None:
        return None
    questions = lesson.get("questions") or []
    if not (1 <= qnum <= len(questions)):
        return None
    return questions[qnum - 1]


def group_key(edit: dict) -> tuple:
    """Ключ группировки правок по «одному месту, разным языкам» (проверки 5 и 8).

    У карты место — (id карты, блок); у викторины — (урок, номер вопроса, номер
    варианта). Вынесено сюда, а не продублировано в обеих проверках: правило
    проекта «повторяется 2+ раза — выносится».
    """
    if edit["kind"] == "quiz":
        return (edit["lesson"], edit["qnum"], edit["opt"])
    return (edit["card"], edit["block"])


def place_label(kind: str, place: tuple) -> str:
    """Читаемая подпись места для находок проверок 5/8 — без языка на конце."""
    if kind == "quiz":
        lesson_id, qnum, opt = place
        return f"{lesson_id}-q{qnum}[{opt}]"
    card_id, block = place
    return f"{card_id}.{block}"


def place_text(cards: dict[str, dict], lessons: dict[str, dict], kind: str,
                place: tuple, lang: str) -> str | None:
    """Текущий текст «места» на языке lang — общий читатель для проверок 8 и 10.

    Карта смотрит в content/cards.json (через block_text), викторина — в черновики
    content/quiz-*.json (через quiz_question). Обе ветки уже существовали порознь
    (в check_8, в check_1) — здесь общий фасад, чтобы не заводить третью копию.
    """
    if kind == "quiz":
        lesson_id, qnum, opt = place
        question = quiz_question(lessons, lesson_id, qnum)
        if question is None:
            return None
        options = question.get("options") or []
        if not (0 <= opt < len(options)):
            return None
        return (options[opt].get(lang) or "").strip() or None
    card_id, block = place
    card = cards.get(card_id)
    if card is None:
        return None
    return block_text(card, block, lang)


def family_of(lang: str) -> tuple[str, str]:
    """Языковая семья: канон (ru, en) или переводы (es, pt) — общая для проверок 5 и 8.

    Канон и переводы живут своей жизнью: правка ОБОИХ переводов при нетронутом
    каноне — норма волны локализации, а не сигнал (см. калибровку в check_5_pair
    и check_8_unpaired). Раньше это условие уже стояло внутри check_8; чтобы не
    завести его копию в check_5, вынесено сюда — правило проекта «повторяется
    2+ раза».
    """
    return ("ru", "en") if lang in ("ru", "en") else ("es", "pt")


def family_partner(lang: str) -> str:
    """Второй язык той же семьи, что lang, независимо от того, тронут он правкой."""
    family = family_of(lang)
    return family[1] if lang == family[0] else family[0]


def family_complete(langs: dict[str, dict], lang: str) -> bool:
    """True, если ОБА языка семьи lang присутствуют среди правок этого места."""
    return all(l in langs for l in family_of(lang))


def parse_word_list(value: str) -> list[str]:
    """['слово', 'другое'] → список. Наборы слов в файле записаны в питоновском виде."""
    return re.findall(r"'([^']*)'", value)


# --- вспомогательное ----------------------------------------------------------

def is_significant(word: str, lang: str) -> bool:
    """Слово достаточно длинное и не служебное, чтобы участвовать в сравнении смысла.

    Общий предикат для тавтологии (`stems`/`stem_counts`) и калибровки проверки 10
    (значимые слова дистрактора и верного ответа) — раньше условие `len(word) <
    STEM_MIN or word in STOPWORDS[lang]` было продублировано в двух местах.
    """
    return len(word) >= STEM_MIN and word not in STOPWORDS[lang]


def stems(text: str, lang: str) -> set[str]:
    out = set()
    for word in words(text):
        if not is_significant(word, lang):
            continue
        out.add(word[:STEM_LEN])
    return out


def stem_counts(text: str, lang: str) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for word in words(text):
        if not is_significant(word, lang):
            continue
        counts[word[:STEM_LEN]] += 1
    return counts


def overlap(before: str, after: str) -> float:
    """Доля общих слов: 1.0 — тексты совпали, 0.0 — ничего общего."""
    a, b = set(words(before)), set(words(after))
    if not a or not b:
        return 0.0
    return len(a & b) / max(len(a), len(b))


def significant_text(text: str, lang: str, question_words: set[str]) -> str:
    """Текст, очищенный до значимых слов — для сравнения СУТИ, а не каркаса вопроса.

    Проверке 10 нужна не форма (общий шаблон вопроса вроде «what do i need... today»
    достаётся всем трём вариантам одинаково), а совпадение содержания дистрактора
    с верным ответом. Убирает слова самого вопроса, служебные (`STOPWORDS`) и
    короткие (`is_significant`) — калибровка 23.08, см. комментарий в check_10.
    """
    return " ".join(w for w in words(text)
                     if w not in question_words and is_significant(w, lang))


def ngrams(text: str, n: int) -> set[tuple[str, ...]]:
    tokens = words(text)
    return {tuple(tokens[i:i + n]) for i in range(len(tokens) - n + 1)}


def cards_by_id() -> dict[str, dict]:
    return {card["id"]: card for card in load_cards()}


def block_text(card: dict, block: str, lang: str) -> str | None:
    if block in WORD_SET_FIELDS:
        value = (card.get(block) or {}).get(lang)
        return ", ".join(value) if value else None
    content = (card.get("content") or {}).get(block)
    if not content:
        return None
    return (content.get(lang) or "").strip() or None


def size_of(text: str, block: str, lang: str) -> tuple[int, tuple[int, int] | None, str]:
    if block in WORD_LIMITS:
        return len(words(text)), WORD_LIMITS[block][lang], "слов"
    if block in CHAR_LIMITS:
        return len(text), CHAR_LIMITS[block][lang], "знаков"
    return len(words(text)), None, "слов"


def last_records(edits: list[dict]) -> list[dict]:
    """Последняя запись каждого адреса — для проверки 1 (спека 28п, 23.08).

    Адрес в списке может повториться: сначала волна перезалила текст, потом хвост
    приёмки поправил его же (задача 28л — тот же случай на карточных адресах,
    где 28б уже правила блок раньше). Порядок записей — история изменений, а не
    независимые правки одного текста; с КОРПУСОМ имеет смысл сверять только
    последнюю (текущую) — устаревшая промежуточная запись обязана «разойтись»
    с сегодняшним текстом, это не дефект, а нормальный ход истории. Порядок
    появления адреса в файле сохраняется (естественный порядок вывода отчёта).
    """
    seen_order: list[str] = []
    latest: dict[str, dict] = {}
    for edit in edits:
        if edit["addr"] not in latest:
            seen_order.append(edit["addr"])
        latest[edit["addr"]] = edit
    return [latest[addr] for addr in seen_order]


# --- проверки -----------------------------------------------------------------
# Каждая возвращает список строк-находок. Пустой список = проверка чиста.
# ⚠️ Все проверки, кроме 1, смотрят на КАЖДУЮ запись (даже если адрес повторился) —
# они про саму правку, и промежуточная правка тоже могла внести дефект. Только
# проверка 1 (сверка с корпусом) и проверка 11 (связность цепочки) знают про
# повторы адреса — это единственные две, для кого важен ИТОГ, а не транзит.

def check_1_applied(edits: list[dict], cards: dict[str, dict],
                     lessons: dict[str, dict]) -> list[str]:
    """«Стало» совпадает с корпусом (карта) или с черновиком викторины (quiz).

    Список адресов — обещание редактору «вот что изменилось». Если корпус с тех пор
    уехал, точечная перечитка проверяет не тот текст, и об этом надо знать до вычитки,
    а не после.

    ⚠️ Смотрит только на ПОСЛЕДНЮЮ запись каждого адреса (`last_records`) — иначе
    устаревшая промежуточная запись повторного адреса (хвост приёмки 28п, 23.08)
    красит отчёт навсегда: её «стало» и есть то самое «было» следующей записи,
    а не текущий корпус. За саму цепочку истории отвечает проверка 11.
    """
    out = []
    for edit in last_records(edits):
        if edit["kind"] == "quiz":
            if edit["lesson"] not in lessons:
                out.append(f"[нет урока] {edit['addr']}")
                continue
            question = quiz_question(lessons, edit["lesson"], edit["qnum"])
            if question is None:
                out.append(f"[нет вопроса] {edit['addr']}")
                continue
            options = question.get("options") or []
            if not (0 <= edit["opt"] < len(options)):
                out.append(f"[нет варианта] {edit['addr']}")
                continue
            current = (options[edit["opt"]].get(edit["lang"]) or "").strip()
            expected = edit["after"]
            if current != expected:
                out.append(f"[разошлось] {edit['addr']}: корпус ≠ «стало»\n"
                           f"    корпус: {current}\n"
                           f"    список: {expected}")
            continue
        card = cards.get(edit["card"])
        if card is None:
            out.append(f"[нет карты] {edit['addr']}")
            continue
        current = block_text(card, edit["block"], edit["lang"])
        if current is None:
            out.append(f"[нет блока] {edit['addr']}")
            continue
        expected = edit["after"]
        if edit["block"] in WORD_SET_FIELDS:
            if parse_word_list(expected) != [w.strip() for w in current.split(",")]:
                out.append(f"[разошлось] {edit['addr']}: корпус ≠ «стало»")
        elif current != expected:
            out.append(f"[разошлось] {edit['addr']}: корпус ≠ «стало»\n"
                       f"    корпус: {current}\n"
                       f"    список: {expected}")
    return out


def check_2_limits(edits: list[dict], _cards: dict[str, dict],
                    _lessons: dict[str, dict]) -> list[str]:
    """Правка вывела блок за норму длины (был внутри — стал снаружи).

    Печатается только регрессия: блок, который и до правки был вне нормы, — предмет
    отдельной волны (49 таких осталось от задачи 31), а не этой.
    Только карточные записи: у нормы длины викторины нет — там своя мера
    (`QUIZ_SPREAD_MAX` в check_canon), проверка 2 её не заменяет.
    """
    out = []
    for edit in edits:
        if edit["kind"] != "card" or edit["block"] in WORD_SET_FIELDS:
            continue
        n_before, limits, unit = size_of(edit["before"], edit["block"], edit["lang"])
        if limits is None:
            continue
        n_after, _, _ = size_of(edit["after"], edit["block"], edit["lang"])
        lo, hi = limits
        was_ok = lo <= n_before <= hi
        now_ok = lo <= n_after <= hi
        if was_ok and not now_ok:
            out.append(f"[вышел за норму] {edit['addr']}: {n_before} → {n_after} {unit}, "
                       f"норма {lo}–{hi}")
    return out


def check_3_tautology(edits: list[dict], _cards: dict[str, dict],
                       _lessons: dict[str, dict]) -> list[str]:
    """Правка внесла повтор основы внутри блока (карта) или варианта (викторина).

    Пример класса: «Гонорары и повышение приходят следом за ростом — если вы
    продолжаете расти» (рост/расти в одной фразе). Механика не знает про вид
    записи — работает по before/after текста независимо от того, откуда он взят.
    """
    out = []
    for edit in edits:
        if edit["kind"] == "card" and edit["block"] in WORD_SET_FIELDS:
            continue
        lang = edit["lang"]
        before, after = stem_counts(edit["before"], lang), stem_counts(edit["after"], lang)
        for stem, count in sorted(after.items()):
            if count >= 2 and before.get(stem, 0) < count:
                sample = [w for w in words(edit["after"]) if w[:STEM_LEN] == stem]
                out.append(f"[повтор основы] {edit['addr']}: {count}× {'/'.join(sorted(set(sample)))}")
    return out


def check_4_neighbour(edits: list[dict], cards: dict[str, dict],
                       _lessons: dict[str, dict]) -> list[str]:
    """Внесённая фраза повторяет соседний блок той же карты.

    Пользователь листает блоки одной карты подряд, поэтому повтор между ними виден
    сразу — это находка задачи 25 («две сферы об одном»), перенесённая на правки.
    Только карточные записи: у викторины «соседний блок» не существует — там
    соседи это варианты того же вопроса, и для них своя проверка 9.
    """
    out = []
    for edit in edits:
        if edit["kind"] != "card" or edit["block"] in WORD_SET_FIELDS:
            continue
        card = cards.get(edit["card"])
        if card is None:
            continue
        added = ngrams(edit["after"], 3) - ngrams(edit["before"], 3)
        # Имя карты обязано повторяться во всех её блоках — это не повтор, а предмет.
        # Без этого «The Last Judgment» даёт 12 находок на одной карте и топит остальные.
        name = " ".join(words((card.get("name") or {}).get(edit["lang"], "")))
        if name:
            added = {g for g in added if " ".join(g) not in name}
        if not added:
            continue
        for name, block in (card.get("content") or {}).items():
            if name == edit["block"]:
                continue
            other = (block.get(edit["lang"]) or "").strip()
            if not other:
                continue
            shared = added & ngrams(other, 3)
            if shared:
                phrases = "; ".join(" ".join(g) for g in sorted(shared)[:3])
                out.append(f"[повтор с соседним] {edit['addr']} ↔ {name}: {phrases}")
    return out


def check_5_pair(edits: list[dict], _cards: dict[str, dict],
                  _lessons: dict[str, dict]) -> list[str]:
    """Смысловая правка сделана в одном языке СЕМЬИ, парный остался прежним.

    Грамматическая правка (род читателя, согласование) парного языка не требует —
    поэтому смотрим только на правки, сменившие мысль: доля общих слов ниже порога.
    Место группировки — карта.блок ИЛИ урок-вопрос[вариант] (`group_key`).

    ⚠️ Калибровка 23.08: сравнение — внутри ЯЗЫКОВОЙ СЕМЬИ (`family_of`/
    `family_complete`, тот же хелпер, что в check_8_unpaired), а не по всем
    четырём языкам разом, как было раньше (та версия писалась ещё на двух языках,
    и «не все четыре тронуты» ошибочно значило «есть находка»). Канон (ru, en) и
    переводы (es, pt) живут своей жизнью: правка ОБОИХ переводов при нетронутом
    каноне — норма волны локализации, а не сигнал. БЕЗ семейной логики проверка
    красила ЛЮБУЮ переводческую волну целиком: на 28п (61 дистрактор × оба
    перевода) это 85 находок, ВСЕ ложные — смысл менялся в es и pt синхронно,
    «непарной» её делало только сравнение с нетронутыми ru/en, которых волна и
    не должна была трогать. Настоящий дефект этого класса («правку сделали в es,
    а pt забыли») тонул в шуме одной из 85 одинаковых строк — теперь он
    единственная находка на своём месте.
    """
    by_place: dict[tuple, dict[str, dict]] = defaultdict(dict)
    for edit in edits:
        by_place[group_key(edit)][edit["lang"]] = edit
    out = []
    for place, langs in sorted(by_place.items(), key=lambda kv: tuple(str(x) for x in kv[0])):
        kind = next(iter(langs.values()))["kind"]
        if kind == "card" and place[1] not in PAIRED_BLOCKS:
            continue
        if len(langs) == len(LANGS):
            continue
        label = place_label(kind, place)
        for lang, edit in sorted(langs.items()):
            if family_complete(langs, lang):
                continue
            drift = overlap(edit["before"], edit["after"])
            if drift < MEANING_DRIFT:
                out.append(f"[язык без пары] {label}: правка в {lang} "
                           f"(общих слов {drift:.0%}), не тронут: {family_partner(lang)}")
    return out


def check_6_drift(edits: list[dict], _cards: dict[str, dict],
                   _lessons: dict[str, dict]) -> list[str]:
    """Правка сменила мысль, а не формулировку — список для чтения глазами.

    Не дефект сам по себе: снятие рамки предсказания обычно требует другой фразы.
    Но именно здесь живёт «замена темы блока», которой редактор не видел ни в каком
    виде, — поэтому список печатается целиком и разбирается вручную. Применяется
    и к дистракторам викторины: там смена мысли опаснее вдвойне — дистрактор либо
    перестаёт быть тем, что задумал автор вопроса, либо (см. проверку 10) вообще
    подъезжает к верному ответу.
    """
    out = []
    for edit in edits:
        if edit["kind"] == "card" and edit["block"] in WORD_SET_FIELDS:
            continue
        drift = overlap(edit["before"], edit["after"])
        if drift < MEANING_DRIFT:
            out.append(f"[сменилась мысль] {edit['addr']}: общих слов {drift:.0%}\n"
                       f"    было:  {edit['before']}\n"
                       f"    стало: {edit['after']}")
    return sorted(out)


def check_7_words(edits: list[dict], cards: dict[str, dict],
                   _lessons: dict[str, dict]) -> list[str]:
    """Замена в keywords/search: формат, дубли внутри набора и между наборами карты.

    Только карточные записи — у викторины нет полей keywords/search.
    """
    out = []
    for edit in edits:
        if edit["kind"] != "card" or edit["block"] not in WORD_SET_FIELDS:
            continue
        card = cards.get(edit["card"])
        if card is None:
            continue
        lang = edit["lang"]
        after = parse_word_list(edit["after"])
        before = parse_word_list(edit["before"])
        added = [w for w in after if w not in before]
        if len(after) != len(set(after)):
            out.append(f"[дубль в наборе] {edit['addr']}")
        other_field = "search" if edit["block"] == "keywords" else "keywords"
        other = set((card.get(other_field) or {}).get(lang) or [])
        for word in added:
            if word in other:
                out.append(f"[есть в {other_field}] {edit['addr']}: «{word}»")
            for existing in after:
                if existing != word and (word in existing or existing in word):
                    out.append(f"[пересекается] {edit['addr']}: «{word}» и «{existing}»")
    return out


def check_8_unpaired(edits: list[dict], cards: dict[str, dict],
                      lessons: dict[str, dict]) -> list[str]:
    """Одноязычная правка — парный текст рядом, для сверки глазами.

    Не автонаходка, а материал: половина правок задачи 31 (39 блоков из 77) сделана
    в одном языке, и проверить парный автоматически нельзя — словари двух языков
    разной полноты. Пример, который это подтвердил: правка сняла гарантию исхода
    в ru («обязательно вернётся» → «имеет свойство возвращаться»), а en остался
    с «will come back to you» — регулярка рамки предсказания такого не ловит,
    потому что «will + глагол» слишком общая конструкция, чтобы класть её в словарь.
    Нашли агенты-редакторы; скрипт лишь показывает, ГДЕ смотреть.
    Место группировки — карта.блок ИЛИ урок-вопрос[вариант] (`group_key`), парный
    текст читается тем же фасадом `place_text`, что использует проверка 10.
    """
    by_place: dict[tuple, dict[str, dict]] = defaultdict(dict)
    for edit in edits:
        by_place[group_key(edit)][edit["lang"]] = edit
    out = []
    for place, langs in sorted(by_place.items(), key=lambda kv: tuple(str(x) for x in kv[0])):
        kind = next(iter(langs.values()))["kind"]
        if kind == "card" and place[1] not in PAIRED_BLOCKS:
            continue
        if len(langs) == len(LANGS):
            continue
        if kind == "card" and cards.get(place[0]) is None:
            continue
        label = place_label(kind, place)
        # ⚠️ Пара считается внутри СЕМЬИ (`family_complete`/`family_partner`, общие
        # хелперы с check_5_pair), а не по всему набору из четырёх языков: канон
        # (ru, en) и переводы (es, pt) живут своей жизнью, и правка ОБОИХ переводов
        # при нетронутом каноне — норма волны локализации, а не находка. Без этого
        # проверка выдавала по строке на каждую правку перевода: 216 «находок» на
        # волне, где дефектов нет. Для викторины действует тот же принцип:
        # перезалитые es+pt при нетронутых ru/en — обычный ход волны 28п, не сигнал.
        for lang, edit in sorted(langs.items()):
            if family_complete(langs, lang):
                continue
            other = family_partner(lang)
            pair = place_text(cards, lessons, kind, place, other) or "—"
            dropped = [w for w in words(edit["before"]) if w not in set(words(edit["after"]))]
            out.append(f"[сверить] {label}: правка в {lang}\n"
                       f"    убрано: {' '.join(dropped) or '—'}\n"
                       f"    {other}: {pair}")
    return out


def check_9_quiz_sibling(edits: list[dict], _cards: dict[str, dict],
                          lessons: dict[str, dict]) -> list[str]:
    """Правленый дистрактор начал повторять СОСЕДНИЙ вариант того же вопроса.

    Аналог проверки 4 для викторины: там соседи — блоки одной карты, здесь —
    варианты одного вопроса, которые пользователь читает подряд секунда в секунду.
    Смотрим только фразы, ДОБАВЛЕННЫЕ правкой (before не в счёт — то, что уже
    повторялось до правки, не её вина).

    ⚠️ Калибровка 23.08 по разбору находок 28п/28е: текст вопроса вычитается из
    added теми же 3-граммами — тот же приём, что в check_4_neighbour для имени
    карты («имя карты обязано повторяться во всех её блоках — это не повтор, а
    предмет»). Здесь предмет — сам вопрос: название карты в вопросе-сравнении
    («El Ermitaño y El Ocho de Espadas»), формула «Maior + Menor», задание вопроса
    как таковое — не может быть находкой, это то, о чём спрашивают. БЕЗ вычитания
    вопроса проверка давала 8 находок на 28п и 3 на 28е — ВСЕ ложные (проверено
    ручным разбором каждой). Часть находок (общий каркас вопроса у всех трёх
    вариантов, вроде «what do I need... today») текст вопроса не покрывает и
    после калибровки остаётся видна — это стилистика, её видно глазами.
    """
    out = []
    for edit in edits:
        if edit["kind"] != "quiz":
            continue
        question = quiz_question(lessons, edit["lesson"], edit["qnum"])
        if question is None:
            continue
        options = question.get("options") or []
        if not (0 <= edit["opt"] < len(options)):
            continue
        added = ngrams(edit["after"], 3) - ngrams(edit["before"], 3)
        if not added:
            continue
        q_text = (question.get("q") or {}).get(edit["lang"], "")
        added -= ngrams(q_text, 3)
        if not added:
            continue
        for i, option in enumerate(options):
            if i == edit["opt"]:
                continue
            other = (option.get(edit["lang"]) or "").strip()
            if not other:
                continue
            shared = added & ngrams(other, 3)
            if shared:
                phrases = "; ".join(" ".join(g) for g in sorted(shared)[:3])
                out.append(f"[повтор с вариантом {i}] {edit['addr']}: {phrases}")
    return out


def check_10_quiz_close_to_correct(edits: list[dict], _cards: dict[str, dict],
                                    lessons: dict[str, dict]) -> list[str]:
    """Дистрактор сблизился с ВЕРНЫМ вариантом того же вопроса.

    Главный риск этого класса правок: дистрактор чинят, чтобы он перестал выдавать
    себя формой (штампом, длиной), а получается перефразировка правильного ответа —
    тогда у вопроса становится два верных варианта, и это не ловит ни одна другая
    проверка в этом файле. Смотрим рост доли общих слов с верным вариантом
    (`overlap`) до и после правки; находка только если ПОСЛЕ правки доля выросла
    И перевалила порог `MEANING_DRIFT`-совместимый уровень 0.5 — малый рост около
    низкой базы (5% → 12%) значения не имеет. Правки самого верного варианта
    (opt == correct) пропускаются — там сближаться не с чем.

    ⚠️ Калибровка 23.08: overlap считается по ЗНАЧИМЫМ словам (`significant_text`),
    а не по сырому тексту — голый overlap() ловил не суть ответа, а общий каркас
    вопроса (все варианты одного вопроса законно перефразируют его условие) и
    служебные слова. БЕЗ этой калибровки проверка давала 2 находки на реальных
    списках, ОБЕ ложные: общими были «qué, me, hoy» (испанские частицы) и разделяемый
    всеми тремя вариантами шаблон «what do I need ... today» — не сама суть ответа.
    """
    out = []
    for edit in edits:
        if edit["kind"] != "quiz":
            continue
        question = quiz_question(lessons, edit["lesson"], edit["qnum"])
        if question is None:
            continue
        correct = question.get("correct")
        if correct is None or edit["opt"] == correct:
            continue
        options = question.get("options") or []
        if not (0 <= correct < len(options)):
            continue
        correct_text = (options[correct].get(edit["lang"]) or "").strip()
        if not correct_text:
            continue
        q_words = set(words((question.get("q") or {}).get(edit["lang"], "")))
        lang = edit["lang"]
        sig_correct = significant_text(correct_text, lang, q_words)
        before_overlap = overlap(significant_text(edit["before"], lang, q_words), sig_correct)
        after_overlap = overlap(significant_text(edit["after"], lang, q_words), sig_correct)
        if after_overlap > before_overlap and after_overlap >= 0.5:
            out.append(f"[сблизился с верным] {edit['addr']}: "
                       f"{before_overlap:.0%} → {after_overlap:.0%}")
    return out


def check_11_chain(edits: list[dict], _cards: dict[str, dict],
                    _lessons: dict[str, dict]) -> list[str]:
    """Адрес встретился больше одного раза — цепочка правок обязана быть связной.

    Список адресов документирует ИСТОРИЮ текста, а не только сегодняшний итог:
    волна перезаливает текст, потом хвост приёмки правит её же результат (28п,
    23.08). «Стало» записи N обязано дословно совпасть с «было» записи N+1 — иначе
    между двумя записями текст менял кто-то в обход списка, и «было» второй записи
    взято не из реального предыдущего состояния. Проверка 1 теперь смотрит только
    на последнюю запись (см. её докстроку) — эта проверка стережёт ровно то, что
    проверка 1 больше не видит: саму последовательность истории.
    """
    by_addr: dict[str, list[dict]] = defaultdict(list)
    for edit in edits:
        by_addr[edit["addr"]].append(edit)
    out = []
    for addr, records in by_addr.items():
        for i in range(len(records) - 1):
            cur, nxt = records[i], records[i + 1]
            if cur["after"] != nxt["before"]:
                out.append(f"[цепочка разорвана] {addr}: «стало» правки {i + 1} ≠ «было» правки {i + 2}\n"
                           f"    стало (#{i + 1}): {cur['after']}\n"
                           f"    было (#{i + 2}): {nxt['before']}")
    return out


CHECKS = [
    ("правка применена в корпусе", check_1_applied),
    ("длина вышла за норму", check_2_limits),
    ("тавтология внутри блока", check_3_tautology),
    ("повтор с соседним блоком", check_4_neighbour),
    ("язык без парной правки", check_5_pair),
    ("сменилась мысль (читать глазами)", check_6_drift),
    ("наборы слов", check_7_words),
    ("одноязычные правки — сверить парный текст", check_8_unpaired),
    ("дистрактор повторяет другой вариант вопроса", check_9_quiz_sibling),
    ("дистрактор сблизился с верным ответом", check_10_quiz_close_to_correct),
    ("цепочка правок разорвана", check_11_chain),
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Проверка правок «было → стало» (спека 35)")
    parser.add_argument("file", nargs="?", help="md-файл списка адресов")
    parser.add_argument("--only", nargs="*", type=int, help="номера проверок")
    parser.add_argument("--list", action="store_true", help="список проверок")
    args = parser.parse_args()

    if args.list:
        for i, (title, _) in enumerate(CHECKS, start=1):
            print(f"{i}. {title}")
        return 0

    if not args.file:
        parser.error("нужен путь к файлу списка адресов")

    path = Path(args.file)
    if not path.is_absolute():
        path = ROOT / path
    edits, unparsed = parse_edits(path)
    cards = cards_by_id()
    lessons = load_quiz_lessons()

    # Адрес, не подошедший ни под карточный, ни под викторинный формат, раньше исчезал
    # молча (см. docstring parse_edits) — печатаем его отдельной строкой ПЕРЕД сводкой,
    # чтобы дефект списка правок был виден до того, как читатель посмотрит на итоги.
    print(f"[адрес не разобран] {len(unparsed)}"
          + (f": {', '.join(unparsed)}" if unparsed else "") + "\n")

    n_cards = len({e["card"] for e in edits if e["kind"] == "card"})
    n_lessons = len({e["lesson"] for e in edits if e["kind"] == "quiz"})
    places = []
    if n_cards:
        places.append(f"{n_cards} картах")
    if n_lessons:
        places.append(f"{n_lessons} уроках викторины")
    # Адрес может повториться (волна + хвост приёмки по тому же тексту, 28п) — печатаем
    # ОБА числа: без этого «записей 125» при «уникальных адресов 122» выглядит багом
    # парсера, а не законным устройством списка (проверка 11 её и стережёт).
    n_addrs = len({e["addr"] for e in edits})
    print(f"Записей «было → стало»: {len(edits)} (уникальных адресов: {n_addrs}) "
          f"в {' и '.join(places) or '—'}\n")

    total = 0
    for i, (title, check) in enumerate(CHECKS, start=1):
        if args.only and i not in args.only:
            continue
        findings = check(edits, cards, lessons)
        total += len(findings)
        print(f"--- {i}. {title}: {len(findings)}")
        for line in findings:
            print(f"  {line}")
        print()
    print(f"Всего находок: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
