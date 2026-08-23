#!/usr/bin/env python3
"""Механический слой замера «вопрос решается без знания таро» (задачи 28е/28р).

Зачем отдельный инструмент. В задаче 28е (21.08) этот счётчик существовал только внутри сессии
и в репозиторий не попал — вместе с ним пропал и страж «правится ТОЛЬКО неверный вариант».
Из-за этого повторить замер задачи 28е нельзя было ничем, кроме как написать его заново.
Здесь он оформлен как инструмент: его прогон — часть приёмки любой правки викторины.

Что он ловит (и чего НЕ ловит). Дефект живёт не в отдельном варианте, а в РАСКЛАДКЕ вариантов
вопроса: если неверные ответы отличаются от верного формой, а не содержанием, ученик выбирает
верный, не зная предмета. Две объективные формы:

  1. КАТЕГОРИЧНОСТЬ — абсолютные слова («всегда», «никогда», «полностью») стоят в дистракторах
     и отсутствуют в верном. Тогда работает школьная эвристика «выбирай самый осторожный вариант».
  2. ДЛИНА — верный вариант заметно длиннее прочих: авторы пишут его точной формулировкой
     с уточнением, а неверные — короткими отговорками (класс дефекта задачи 29).

Смысловые дефекты (дистрактор не отвечает на вопрос, нелеп, отрицает посылку) механика не видит
в принципе — это работа слепого решателя и разбора по одному (раздел C списка 28е).

Третья функция — СТРАЖ ПРАВКИ (`--against`): сверяет с указанной ревизией то, что правка трогать
не имеет права, — текст верного варианта, индекс `correct`, текст вопроса и пояснение. Волна правок
дистракторов обязана заканчиваться этим прогоном: проект дважды платил за переставленные варианты
при нетронутом `correct` (задачи 29 и 31), и ни схема, ни контракт-тест этого не видят.

Запуск (из корня репозитория):
    python scripts/check_quiz_guess.py                 # маркеры + длины
    python scripts/check_quiz_guess.py --against HEAD  # + страж «верный не тронут»
    python scripts/check_quiz_guess.py --only m3       # один модуль
Код возврата 1, если есть находки или расхождения со стражем.

⚠️ КАЛИБРОВКА (правило проекта: число ложных срабатываний записывается рядом с правилом).
Замер 23.08 на корпусе ПОСЛЕ правок 28е — 160 вопросов, ru+en:

  - ABSOLUTE (находки): **18** — 13 категоричности + 5 длин. Спека 28р ждала здесь нуля («28е
    довела метрику до нуля»), и это ожидание оказалось НЕВЕРНЫМ. Разбивка объясняет почему:
    категоричность ru — 1, en — 12; длины ru — 0, en — 5. То есть замер 28е считался по РУССКОМУ
    корпусу, английские варианты правились «синхронно по смыслу», но метрикой не проверялись.
    Ноль в отчёте 28е был честным для того, что там мерили, и слепым к половине корпуса.
    Вывод для будущих замеров: язык, на котором метрика не считалась, не «в порядке», а не измерен.

  - QUANTIFIER (отчёт, НЕ находки): 86 строк (37 вопросов ru + 37 en, часть в обоих языках).
    Слова «все», «всё», «каждый», «только»,
    «ничего» в живой речи не тотализируют правило: «спросить всех вокруг» (m5l4-q4), «всех трёх
    карт» (m6l3-q3), «которая всё расставит по местам» (m6l4-q5), «дальше только восстановление»
    (m6l1-q5) — выборочная проверка четырёх мест дала 4 ложных из 4. Держать их в находках значило
    бы утопить 18 настоящих сигналов в 74 строках шума, поэтому они печатаются отдельным отчётом:
    при разборе вопроса по одному это полезная наводка, для правки списком — нет.
    ⚠️ Не переносить их в находки «для полноты»: правило проекта — ложные лечатся точностью
    правила, а не порогом, а точного правила для квантификаторов не существует, они контекстны.

  - LEN_RATIO 1.3 — из задачи 29. Порог «в 1.3 раза» НЕ видит превышения в 2–7 знаков, за которое
    краснеет contract-тест courseContent.test.ts, поэтому счёт «единственный самый длинный»
    (LONGEST_PER_LESSON) ведётся БЕЗ запаса — так же, как в тесте.
  - `card`-вопросы выведены из правила длин (задача 29: варианты — имена карт, подогнать нельзя),
    КРОМЕ модуля М6, где карточные вопросы спрашивают чтение в контексте и варианты там —
    полные трактовки (урок задачи 26).

⚠️ Мутации, которыми проверена НЕ-слепота (повторять при каждой правке этого файла):
    --mutate absolute   подсаживает «всегда» в дистрактор и обязан быть пойман поимённо
    --mutate longest    удлиняет верный вариант и обязан покраснеть по длине
    --mutate correct    сдвигает индекс верного — обязан покраснеть СТРАЖ (с --against)
Мутации работают на копии в памяти, файлы не трогают.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

CONTENT = Path("content")
LANGS = ("ru", "en")  # канон: правки волн 28е/28р идут только сюда, переводы льёт Cowork

# Сильные абсолюты — ФИНДИНГИ. Списки ru и en держатся ЭКВИВАЛЕНТНЫМИ намеренно: перекос
# в одну сторону — это и есть то, чем болел замер 28е (см. калибровку в докстроке).
ABSOLUTE = {
    "ru": r"\b(всегда|никогда|полностью|целиком|абсолютн\w*|обязательно|непременно|наверняка|"
          r"стопроцентн\w*|гарантир\w+|гаранти[яию]|без исключений)\b",
    "en": r"\b(always|never|completely|entirely|totally|absolutely|guarantee[sd]?|certainly|"
          r"definitely|no exceptions)\b",
}
# Квантификаторы — НЕ находки, а [ОТЧЁТ]: материал для глаз при разборе вопроса.
# Приём взят у check_edits.py (проверка 6) и check_translation.py: метрика информативна как
# наводка, но её выход нельзя править списком.
QUANTIFIER = {
    "ru": r"\b(все[йхм]?|всё|весь|вся|любо\w+|кажд\w+|ничего|никто|никак\w*|только|"
          r"исключительно|единственн\w+)\b",
    "en": r"\b(all|every|everything|nothing|none|nobody|only|solely|must)\b",
}
LEN_RATIO = 1.3           # верный длиннее второго по длине во столько раз (задача 29)
LONGEST_PER_LESSON = 2    # сколько вопросов урока могут иметь единственный самый длинный верный


def load_quizzes(path_reader=None) -> list[dict]:
    """Вопросы из черновиков content/quiz-*.json — источника правок редактора.

    Возвращает плоский список: файл, урок, номер вопроса (с единицы), сам вопрос.
    path_reader — функция чтения файла (подменяется для чтения из git-ревизии).
    """
    read = path_reader or (lambda p: p.read_text(encoding="utf-8"))
    out: list[dict] = []
    for path in sorted(CONTENT.glob("quiz-*.json")):
        data = json.loads(read(path))
        for lesson in data["lessons"]:
            for i, item in enumerate(lesson["questions"], start=1):
                out.append({
                    "file": path.name,
                    "lesson": lesson["lessonId"],
                    "number": i,
                    "item": item,
                })
    return out


def module_of(lesson_id: str) -> str:
    """m3l4 → m3."""
    return lesson_id.split("l")[0]


def marker_hits(text: str, lang: str, table=ABSOLUTE) -> set[str]:
    return {m.group(0).lower() for m in re.finditer(table[lang], text, re.IGNORECASE)}


def check_absolutes(quizzes: list[dict]) -> list[str]:
    """Маркеры категоричности стоят в дистракторах и отсутствуют в верном."""
    out = []
    for q in quizzes:
        item = q["item"]
        correct = item["correct"]
        for lang in LANGS:
            options = [o[lang] for o in item["options"]]
            in_correct = marker_hits(options[correct], lang)
            wrong_hits = {
                i: marker_hits(o, lang) - in_correct
                for i, o in enumerate(options) if i != correct
            }
            # сигнал: маркеры есть НЕ МЕНЬШЕ чем у одного дистрактора и ни одного у верного
            loud = {i: h for i, h in wrong_hits.items() if h}
            if loud and not in_correct:
                words = ", ".join(sorted({w for h in loud.values() for w in h}))
                out.append(
                    f"{q['lesson']}-q{q['number']}.{lang}: категоричность только в дистракторах "
                    f"[{words}] — верный узнаётся по осторожности (варианты {sorted(loud)})"
                )
    return out


def report_quantifiers(quizzes: list[dict]) -> list[str]:
    """[ОТЧЁТ] Квантификаторы («все», «только», «ничего») в дистракторах и не в верном.

    НЕ находки: в живой речи это обычные слова («спросить всех вокруг», «всех трёх карт»,
    «которая всё расставит по местам»), а не тотализация правила. Выборочная проверка четырёх
    мест 23.08 дала 4 ложных из 4 — поэтому список выведен из находок и печатается наводкой
    для разбора вопроса по одному.
    """
    out = []
    for q in quizzes:
        item = q["item"]
        correct = item["correct"]
        for lang in LANGS:
            options = [o[lang] for o in item["options"]]
            in_correct = marker_hits(options[correct], lang, QUANTIFIER)
            loud = {
                i: marker_hits(o, lang, QUANTIFIER) - in_correct
                for i, o in enumerate(options) if i != correct
            }
            loud = {i: h for i, h in loud.items() if h}
            if loud and not in_correct:
                words = ", ".join(sorted({w for h in loud.values() for w in h}))
                out.append(f"{q['lesson']}-q{q['number']}.{lang}: [{words}] в вариантах {sorted(loud)}")
    return out


def check_lengths(quizzes: list[dict]) -> list[str]:
    """Верный вариант выдаёт себя длиной — по вопросу и по уроку."""
    out = []
    per_lesson: dict[str, list[int]] = {}
    for q in quizzes:
        item = q["item"]
        correct = item["correct"]
        # card-вопросы вне правила длин: их варианты — имена карт (задача 29).
        # Исключение из исключения — М6: там карточные вопросы спрашивают чтение,
        # и варианты у них полные трактовки (урок задачи 26)
        skip_len = item.get("type") == "card" and module_of(q["lesson"]) != "m6"
        for lang in LANGS:
            lengths = [len(o[lang]) for o in item["options"]]
            longest = max(lengths)
            single_longest = lengths[correct] == longest and lengths.count(longest) == 1
            if single_longest and lang == "ru" and not skip_len:
                per_lesson.setdefault(q["lesson"], []).append(q["number"])
            if skip_len:
                continue
            others = sorted((l for i, l in enumerate(lengths) if i != correct), reverse=True)
            if single_longest and lengths[correct] >= others[0] * LEN_RATIO:
                out.append(
                    f"{q['lesson']}-q{q['number']}.{lang}: верный длиннее второго в "
                    f"{lengths[correct] / others[0]:.2f} раза ({others[0]}→{lengths[correct]} знаков)"
                )
    for lesson, numbers in sorted(per_lesson.items()):
        if len(numbers) > LONGEST_PER_LESSON:
            out.append(
                f"[урок] {lesson}: верный — единственный самый длинный в {len(numbers)} вопросах "
                f"из 5 (порог {LONGEST_PER_LESSON}, счёт без запаса) — вопросы {numbers}"
            )
    return out


def check_guard(quizzes: list[dict], rev: str) -> list[str]:
    """Страж: правка не имеет права трогать верный вариант, correct, вопрос и пояснение."""
    def from_git(path: Path) -> str:
        git_path = path.as_posix()
        return subprocess.run(
            ["git", "show", f"{rev}:{git_path}"],
            capture_output=True, check=True, text=True, encoding="utf-8",
        ).stdout

    try:
        before = {(q["lesson"], q["number"]): q["item"] for q in load_quizzes(from_git)}
    except subprocess.CalledProcessError as e:
        return [f"[страж] не удалось прочитать ревизию {rev}: {e.stderr.strip()}"]

    out = []
    for q in quizzes:
        key = (q["lesson"], q["number"])
        old = before.get(key)
        if old is None:
            out.append(f"[страж] {key[0]}-q{key[1]}: вопроса не было в {rev} — правка добавила вопрос")
            continue
        item = q["item"]
        if old["correct"] != item["correct"]:
            out.append(f"[страж] {q['lesson']}-q{q['number']}: correct {old['correct']} → {item['correct']}")
        if len(old["options"]) != len(item["options"]):
            out.append(f"[страж] {q['lesson']}-q{q['number']}: число вариантов изменилось")
            continue
        for lang in LANGS:
            if old["q"][lang] != item["q"][lang]:
                out.append(f"[страж] {q['lesson']}-q{q['number']}.{lang}: изменён ТЕКСТ ВОПРОСА")
            # верный сверяется по ТЕКСТУ на своём индексе в каждой ревизии: так ловится и правка
            # верного, и перестановка вариантов при нетронутом correct
            if old["options"][old["correct"]][lang] != item["options"][item["correct"]][lang]:
                out.append(f"[страж] {q['lesson']}-q{q['number']}.{lang}: изменён ВЕРНЫЙ вариант")
            if old.get("explain", {}).get(lang) != item.get("explain", {}).get(lang):
                out.append(f"[страж] {q['lesson']}-q{q['number']}.{lang}: изменено пояснение")
    return out


def mutate(quizzes: list[dict], kind: str) -> str:
    """Порча копии в памяти — приёмка самой проверки (правило «тест обязан краснеть»)."""
    target = quizzes[0]
    item = target["item"]
    wrong = next(i for i in range(len(item["options"])) if i != item["correct"])
    addr = f"{target['lesson']}-q{target['number']}"
    if kind == "absolute":
        item["options"][wrong] = {**item["options"][wrong],
                                  "ru": "Это всегда работает без исключений",
                                  "en": "This always works, no exceptions"}
        return f"{addr}[{wrong}] — подсажена категоричность"
    if kind == "longest":
        c = item["correct"]
        item["options"][c] = {lang: item["options"][c][lang] + " " + "и".join(["очень"] * 30)
                              for lang in item["options"][c]}
        return f"{addr}[{c}] — верный вариант удлинён"
    if kind == "correct":
        item["correct"] = wrong
        return f"{addr} — индекс верного сдвинут на {wrong}"
    raise SystemExit(f"неизвестная мутация: {kind}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--against", metavar="REV", help="сверить неприкосновенное с ревизией git (обычно HEAD)")
    ap.add_argument("--only", metavar="MOD", help="только один модуль, например m3")
    ap.add_argument("--mutate", choices=("absolute", "longest", "correct"),
                    help="испортить копию в памяти — приёмка самой проверки")
    args = ap.parse_args()

    if not Path("app.json").exists():
        print("Запускать из корня репозитория", file=sys.stderr)
        return 1

    quizzes = load_quizzes()
    if args.only:
        quizzes = [q for q in quizzes if module_of(q["lesson"]) == args.only]
        if not quizzes:
            print(f"Модуль {args.only} не найден", file=sys.stderr)
            return 1

    if args.mutate:
        print(f"[МУТАЦИЯ] {mutate(quizzes, args.mutate)}\n")

    print(f"Вопросов в периметре: {len(quizzes)} (языки: {', '.join(LANGS)})\n")

    absolutes = check_absolutes(quizzes)
    lengths = check_lengths(quizzes)
    guard = check_guard(quizzes, args.against) if args.against else []

    for title, found in (("1. Категоричность только в дистракторах", absolutes),
                         ("2. Верный выдаёт себя длиной", lengths),
                         (f"3. Страж «верный не тронут» (против {args.against})", guard)):
        if not args.against and title.startswith("3."):
            continue
        print(f"=== {title}: {len(found)} ===")
        for line in found:
            print(f"  {line}")
        print()

    quant = report_quantifiers(quizzes)
    print(f"=== [ОТЧЁТ] Квантификаторы — НЕ находки, наводка для разбора: {len(quant)} ===")
    for line in quant:
        print(f"  {line}")
    print()

    total = len(absolutes) + len(lengths) + len(guard)
    print(f"ИТОГО находок: {total} (плюс {len(quant)} строк отчёта, они находками не считаются)")
    if total == 0:
        print("Ноль — убедиться, что проверка не слепа, можно прогоном")
        print("с --mutate absolute / --mutate longest / --mutate correct.")
    return 1 if total else 0


if __name__ == "__main__":
    raise SystemExit(main())
