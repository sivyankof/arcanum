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
    python scripts/check_edits.py <файл> --only 3 4
    python scripts/check_edits.py --list

Формат входного файла — тот же, каким задача 31 отдала список редактору:
    ## <card>.<block>.<lang>
    - было: <текст>
    - стало: <текст>
"""

from __future__ import annotations

import argparse
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
}

# Общая часть пары: одна и та же мысль на двух языках. Если правка сменила мысль
# в одном языке, а парный остался прежним, языки разъехались — класс дефекта,
# который задача 25 нашла на «At work» и который построчная вычитка не показывает.
PAIRED_BLOCKS = tuple(WORD_LIMITS) + tuple(CHAR_LIMITS)

WORD_SET_FIELDS = ("keywords", "search")


# --- разбор входного файла ----------------------------------------------------

def parse_edits(path: Path) -> list[dict]:
    """Записи «было → стало» из md-файла списка адресов."""
    edits: list[dict] = []
    current: dict | None = None
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()
        if line.startswith("## "):
            address = line[3:].strip()
            parts = address.split(".")
            if len(parts) != 3:
                continue
            current = {"addr": address, "card": parts[0], "block": parts[1], "lang": parts[2]}
            edits.append(current)
        elif current is not None and line.startswith("- было: "):
            current["before"] = line[len("- было: "):].strip()
        elif current is not None and line.startswith("- стало: "):
            current["after"] = line[len("- стало: "):].strip()
    return [e for e in edits if "before" in e and "after" in e]


def parse_word_list(value: str) -> list[str]:
    """['слово', 'другое'] → список. Наборы слов в файле записаны в питоновском виде."""
    return re.findall(r"'([^']*)'", value)


# --- вспомогательное ----------------------------------------------------------

def stems(text: str, lang: str) -> set[str]:
    out = set()
    for word in words(text):
        if len(word) < STEM_MIN or word in STOPWORDS[lang]:
            continue
        out.add(word[:STEM_LEN])
    return out


def stem_counts(text: str, lang: str) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for word in words(text):
        if len(word) < STEM_MIN or word in STOPWORDS[lang]:
            continue
        counts[word[:STEM_LEN]] += 1
    return counts


def overlap(before: str, after: str) -> float:
    """Доля общих слов: 1.0 — тексты совпали, 0.0 — ничего общего."""
    a, b = set(words(before)), set(words(after))
    if not a or not b:
        return 0.0
    return len(a & b) / max(len(a), len(b))


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


# --- проверки -----------------------------------------------------------------
# Каждая возвращает список строк-находок. Пустой список = проверка чиста.

def check_1_applied(edits: list[dict], cards: dict[str, dict]) -> list[str]:
    """«Стало» совпадает с корпусом.

    Список адресов — обещание редактору «вот что изменилось». Если корпус с тех пор
    уехал, точечная перечитка проверяет не тот текст, и об этом надо знать до вычитки,
    а не после.
    """
    out = []
    for edit in edits:
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


def check_2_limits(edits: list[dict], _cards: dict[str, dict]) -> list[str]:
    """Правка вывела блок за норму длины (был внутри — стал снаружи).

    Печатается только регрессия: блок, который и до правки был вне нормы, — предмет
    отдельной волны (49 таких осталось от задачи 31), а не этой.
    """
    out = []
    for edit in edits:
        if edit["block"] in WORD_SET_FIELDS:
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


def check_3_tautology(edits: list[dict], _cards: dict[str, dict]) -> list[str]:
    """Правка внесла повтор основы внутри блока, которого до неё не было.

    Пример класса: «Гонорары и повышение приходят следом за ростом — если вы
    продолжаете расти» (рост/расти в одной фразе).
    """
    out = []
    for edit in edits:
        if edit["block"] in WORD_SET_FIELDS:
            continue
        lang = edit["lang"]
        before, after = stem_counts(edit["before"], lang), stem_counts(edit["after"], lang)
        for stem, count in sorted(after.items()):
            if count >= 2 and before.get(stem, 0) < count:
                sample = [w for w in words(edit["after"]) if w[:STEM_LEN] == stem]
                out.append(f"[повтор основы] {edit['addr']}: {count}× {'/'.join(sorted(set(sample)))}")
    return out


def check_4_neighbour(edits: list[dict], cards: dict[str, dict]) -> list[str]:
    """Внесённая фраза повторяет соседний блок той же карты.

    Пользователь листает блоки одной карты подряд, поэтому повтор между ними виден
    сразу — это находка задачи 25 («две сферы об одном»), перенесённая на правки.
    """
    out = []
    for edit in edits:
        if edit["block"] in WORD_SET_FIELDS:
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


def check_5_pair(edits: list[dict], _cards: dict[str, dict]) -> list[str]:
    """Смысловая правка сделана в одном языке, парный остался прежним.

    Грамматическая правка (род читателя, согласование) парного языка не требует —
    поэтому смотрим только на правки, сменившие мысль: доля общих слов ниже порога.
    """
    by_block: dict[tuple[str, str], dict[str, dict]] = defaultdict(dict)
    for edit in edits:
        by_block[(edit["card"], edit["block"])][edit["lang"]] = edit
    out = []
    for (card_id, block), langs in sorted(by_block.items()):
        if block not in PAIRED_BLOCKS:
            continue
        if len(langs) == len(LANGS):
            continue
        (lang, edit), = langs.items()
        other = "en" if lang == "ru" else "ru"
        drift = overlap(edit["before"], edit["after"])
        if drift < MEANING_DRIFT:
            out.append(f"[язык без пары] {card_id}.{block}: правка в {lang} "
                       f"(общих слов {drift:.0%}), {other} не тронут")
    return out


def check_6_drift(edits: list[dict], _cards: dict[str, dict]) -> list[str]:
    """Правка сменила мысль, а не формулировку — список для чтения глазами.

    Не дефект сам по себе: снятие рамки предсказания обычно требует другой фразы.
    Но именно здесь живёт «замена темы блока», которой редактор не видел ни в каком
    виде, — поэтому список печатается целиком и разбирается вручную.
    """
    out = []
    for edit in edits:
        if edit["block"] in WORD_SET_FIELDS:
            continue
        drift = overlap(edit["before"], edit["after"])
        if drift < MEANING_DRIFT:
            out.append(f"[сменилась мысль] {edit['addr']}: общих слов {drift:.0%}\n"
                       f"    было:  {edit['before']}\n"
                       f"    стало: {edit['after']}")
    return sorted(out)


def check_7_words(edits: list[dict], cards: dict[str, dict]) -> list[str]:
    """Замена в keywords/search: формат, дубли внутри набора и между наборами карты."""
    out = []
    for edit in edits:
        if edit["block"] not in WORD_SET_FIELDS:
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


def check_8_unpaired(edits: list[dict], cards: dict[str, dict]) -> list[str]:
    """Одноязычная правка — парный текст рядом, для сверки глазами.

    Не автонаходка, а материал: половина правок задачи 31 (39 блоков из 77) сделана
    в одном языке, и проверить парный автоматически нельзя — словари двух языков
    разной полноты. Пример, который это подтвердил: правка сняла гарантию исхода
    в ru («обязательно вернётся» → «имеет свойство возвращаться»), а en остался
    с «will come back to you» — регулярка рамки предсказания такого не ловит,
    потому что «will + глагол» слишком общая конструкция, чтобы класть её в словарь.
    Нашли агенты-редакторы; скрипт лишь показывает, ГДЕ смотреть.
    """
    by_block: dict[tuple[str, str], dict[str, dict]] = defaultdict(dict)
    for edit in edits:
        by_block[(edit["card"], edit["block"])][edit["lang"]] = edit
    out = []
    for (card_id, block), langs in sorted(by_block.items()):
        if block not in PAIRED_BLOCKS or len(langs) == len(LANGS):
            continue
        (lang, edit), = langs.items()
        other = "en" if lang == "ru" else "ru"
        card = cards.get(card_id)
        if card is None:
            continue
        pair = block_text(card, block, other) or "—"
        dropped = [w for w in words(edit["before"]) if w not in set(words(edit["after"]))]
        out.append(f"[сверить] {card_id}.{block}: правка в {lang}\n"
                   f"    убрано: {' '.join(dropped) or '—'}\n"
                   f"    {other}: {pair}")
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
    edits = parse_edits(path)
    cards = cards_by_id()
    print(f"Записей «было → стало»: {len(edits)} "
          f"в {len({e['card'] for e in edits})} картах\n")

    total = 0
    for i, (title, check) in enumerate(CHECKS, start=1):
        if args.only and i not in args.only:
            continue
        findings = check(edits, cards)
        total += len(findings)
        print(f"--- {i}. {title}: {len(findings)}")
        for line in findings:
            print(f"  {line}")
        print()
    print(f"Всего находок: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
