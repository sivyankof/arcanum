#!/usr/bin/env python3
"""
Переводит статусы контента на следующую ступень workflow: todo → draft → reviewed → final.

Зачем скрипт, а не правка руками: статусов больше шестисот, они лежат в трёх файлах,
и двигать их придётся каждый раз, когда редактор проходит очередной круг вычитки.

Запуск из корня репозитория:
    python scripts/set_status.py reviewed              # всё, что сейчас draft → reviewed
    python scripts/set_status.py final --from reviewed # всё, что reviewed → final
    python scripts/set_status.py reviewed --only cards # только значения карт
    python scripts/set_status.py reviewed --lang es    # только испанский (спека 28а)
    python scripts/set_status.py reviewed --only words # слова витрины и поиска карты
    python scripts/set_status.py reviewed --dry-run    # показать, ничего не записывая

Части контента (--only): cards — блоки значений у каждой из 78 карт (cards.json);
words — слова витрины и поиска карты (name + keywords + search, один статус на три поля);
theory — тексты теории уроков (course.json); quiz — викторины (все content/quiz-*.json
+ course.json; статус у каждого staging-файла свой, двигается только совпавший с исходным).

Статус живёт ПО ЯЗЫКАМ (спека 28а): {"ru": "reviewed", "en": "draft"}. Двигаются только языки,
перечисленные в --lang (по умолчанию канон ru,en), и только те из них, чей статус совпал
с исходным, — иначе «русский вычитан, испанский черновик» схлопнулось бы в одно значение.
Отсутствующий у блока язык считается todo.
Формат файлов сохраняется тот же, что пишут build_cards.py и merge_quiz.py (indent=1, LF).
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CARDS = ROOT / "content" / "cards.json"
COURSE = ROOT / "content" / "course.json"

ORDER = ["todo", "draft", "reviewed", "final"]
PARTS = ["cards", "words", "theory", "quiz"]
LANGS = ["ru", "en", "es", "pt"]
CANON = ["ru", "en"]


def bump(holder: dict, key: str, src: str, dst: str, langs: list[str]) -> int:
    """Двигает статус у перечисленных языков; отсутствующий язык считается todo.
    Возвращает, сколько языков сдвинулось. Языки, чей статус не совпал с исходным, не трогает."""
    status = holder.get(key)
    if not isinstance(status, dict):
        return 0
    moved = 0
    for lang in langs:
        if status.get(lang, "todo") == src:
            status[lang] = dst
            moved += 1
    return moved


def dump(path: Path, data: object) -> None:
    """Запись в том же формате, что и остальные скрипты конвейера."""
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="Перевод статусов контента на следующую ступень")
    ap.add_argument("to", choices=ORDER, help="целевой статус")
    ap.add_argument("--from", dest="src", choices=ORDER, help="исходный статус (по умолчанию — предыдущая ступень)")
    ap.add_argument("--only", choices=PARTS, help="ограничить одной частью контента")
    ap.add_argument("--lang", help=f"языки через запятую, по умолчанию канон {','.join(CANON)}")
    ap.add_argument("--dry-run", action="store_true", help="показать, что изменится, и выйти")
    args = ap.parse_args()

    if args.src is None:
        idx = ORDER.index(args.to)
        if idx == 0:
            print("ОШИБКА: у todo нет предыдущей ступени — укажите --from явно")
            sys.exit(1)
        args.src = ORDER[idx - 1]
    if ORDER.index(args.to) <= ORDER.index(args.src):
        print(f"ОШИБКА: {args.src} -> {args.to} не движение вперёд по workflow")
        sys.exit(1)

    langs = [l.strip() for l in args.lang.split(",")] if args.lang else list(CANON)
    bad = [l for l in langs if l not in LANGS]
    if bad:
        print(f"ОШИБКА: неизвестный язык {', '.join(bad)}; допустимы {', '.join(LANGS)}")
        sys.exit(1)

    parts = [args.only] if args.only else PARTS
    changed = {p: 0 for p in parts}

    touch_cards = "cards" in parts or "words" in parts
    if touch_cards:
        cards = json.loads(CARDS.read_text(encoding="utf-8"))
        for card in cards["cards"]:
            if "cards" in parts:
                for block in card["content"].values():
                    changed["cards"] += bump(block, "status", args.src, args.to, langs)
            if "words" in parts:
                changed["words"] += bump(card, "wordsStatus", args.src, args.to, langs)

    course = json.loads(COURSE.read_text(encoding="utf-8"))
    if "theory" in parts:
        for module in course["modules"]:
            for lesson in module["lessons"]:
                theory = lesson.get("theory")
                if theory:
                    changed["theory"] += bump(theory, "status", args.src, args.to, langs)

    changed_quiz_files: list[tuple[Path, object]] = []
    if "quiz" in parts:
        # у викторин статус хранится дважды: в черновике редактора и в собранном course.json.
        # Правим оба, иначе следующий прогон merge_quiz.py откатит course.json назад.
        # Staging-файлов несколько (по порции контента), у каждого статус свой — переписываем
        # только те, чей статус совпал с исходным, остальные не трогаем даже форматированием.
        for quiz_path in sorted((ROOT / "content").glob("quiz-*.json")):
            quiz = json.loads(quiz_path.read_text(encoding="utf-8"))
            if bump(quiz, "status", args.src, args.to, langs):
                changed_quiz_files.append((quiz_path, quiz))
        for module in course["modules"]:
            for lesson in module["lessons"]:
                changed["quiz"] += bump(lesson, "quizStatus", args.src, args.to, langs)

    total = sum(changed.values())
    report = ", ".join(f"{p}: {changed[p]}" for p in parts)
    langs_note = ", ".join(langs)
    if args.dry_run:
        print(f"СУХОЙ ПРОГОН {args.src} -> {args.to} [{langs_note}]: изменилось бы {total} ({report})")
        return
    if total == 0:
        print(f"Нечего менять: блоков со статусом {args.src} не найдено ({report})")
        return

    if touch_cards:
        dump(CARDS, cards)
    if "theory" in parts or "quiz" in parts:
        dump(COURSE, course)
    for quiz_path, quiz_data in changed_quiz_files:
        dump(quiz_path, quiz_data)

    print(f"OK: {args.src} -> {args.to} [{langs_note}], изменено {total} ({report})")


if __name__ == "__main__":
    main()
