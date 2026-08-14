#!/usr/bin/env python3
"""
Переводит статусы контента на следующую ступень workflow: todo → draft → reviewed → final.

Зачем скрипт, а не правка руками: статусов больше шестисот, они лежат в трёх файлах,
и двигать их придётся каждый раз, когда редактор проходит очередной круг вычитки.

Запуск из корня репозитория:
    python scripts/set_status.py reviewed              # всё, что сейчас draft → reviewed
    python scripts/set_status.py final --from reviewed # всё, что reviewed → final
    python scripts/set_status.py reviewed --only cards # только значения карт
    python scripts/set_status.py reviewed --dry-run    # показать, ничего не записывая

Части контента (--only): cards — 8 блоков значений у каждой из 78 карт (cards.json);
theory — тексты теории уроков (course.json); quiz — викторины (все content/quiz-*.json
+ course.json; статус у каждого staging-файла свой, двигается только совпавший с исходным).
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
PARTS = ["cards", "theory", "quiz"]


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

    parts = [args.only] if args.only else PARTS
    changed = {p: 0 for p in parts}

    if "cards" in parts:
        cards = json.loads(CARDS.read_text(encoding="utf-8"))
        for card in cards["cards"]:
            for block in card["content"].values():
                if block.get("status") == args.src:
                    block["status"] = args.to
                    changed["cards"] += 1

    course = json.loads(COURSE.read_text(encoding="utf-8"))
    if "theory" in parts:
        for module in course["modules"]:
            for lesson in module["lessons"]:
                theory = lesson.get("theory")
                if theory and theory.get("status") == args.src:
                    theory["status"] = args.to
                    changed["theory"] += 1

    changed_quiz_files: list[tuple[Path, object]] = []
    if "quiz" in parts:
        # у викторин статус хранится дважды: в черновике редактора и в собранном course.json.
        # Правим оба, иначе следующий прогон merge_quiz.py откатит course.json назад.
        # Staging-файлов несколько (по порции контента), у каждого статус свой — переписываем
        # только те, чей статус совпал с исходным, остальные не трогаем даже форматированием.
        for quiz_path in sorted((ROOT / "content").glob("quiz-*.json")):
            quiz = json.loads(quiz_path.read_text(encoding="utf-8"))
            if quiz.get("status") == args.src:
                quiz["status"] = args.to
                changed_quiz_files.append((quiz_path, quiz))
        for module in course["modules"]:
            for lesson in module["lessons"]:
                if lesson.get("quizStatus") == args.src:
                    lesson["quizStatus"] = args.to
                    changed["quiz"] += 1

    total = sum(changed.values())
    report = ", ".join(f"{p}: {changed[p]}" for p in parts)
    if args.dry_run:
        print(f"СУХОЙ ПРОГОН {args.src} -> {args.to}: изменилось бы {total} ({report})")
        return
    if total == 0:
        print(f"Нечего менять: блоков со статусом {args.src} не найдено ({report})")
        return

    if "cards" in parts:
        dump(CARDS, cards)
    if "theory" in parts or "quiz" in parts:
        dump(COURSE, course)
    for quiz_path, quiz_data in changed_quiz_files:
        dump(quiz_path, quiz_data)

    print(f"OK: {args.src} -> {args.to}, изменено {total} ({report})")


if __name__ == "__main__":
    main()
