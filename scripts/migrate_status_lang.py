#!/usr/bin/env python3
"""
Одноразовая идемпотентная миграция статусов контента на пер-языковую схему (спека 28а).

Было:  "status": "reviewed"
Стало: "status": {"ru": "reviewed", "en": "reviewed"}

Трогает все четыре хранилища статуса СРАЗУ — блоки значений карт, теорию и quizStatus уроков,
файловый статус staging-викторин, — потому что рассинхрон между ними молчалив: оставь мы
staging-файлы в старой форме, следующий прогон merge_quiz.py просто перенёс бы строку обратно
в course.json и откатил схему.

Заодно заводит wordsStatus у карты — один статус на name + keywords + search (решение 4а спеки:
эти три поля переводятся атомарно, потому что источник поиска выбирается по языку названия).

es/pt не создаются вовсе: отсутствие ключа и есть todo. Пустая строка значила бы другое —
«язык есть, и он пустой», и presentLang показал бы пустоту вместо готового английского.

Запуск из корня:  python scripts/migrate_status_lang.py [--dry-run]
Повторный прогон ничего не меняет: то, что уже словарь, пропускается.
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CARDS = ROOT / "content" / "cards.json"
COURSE = ROOT / "content" / "course.json"

# Языки канона: только на них контент написан руками (см. CanonLang в src/lib/lang.ts).
CANON = ("ru", "en")
# Слов витрины и поиска в workflow не было вовсе — заводим сразу вычитанными (решение 4 спеки).
WORDS_START = "reviewed"


def to_map(value):
    """Строка -> словарь по языкам канона. Уже словарь (или пусто) -> отдаём как есть."""
    if isinstance(value, str):
        return {lang: value for lang in CANON}
    return value


def dump(path: Path, data: object) -> None:
    """Запись в том же формате, что и остальные скрипты конвейера (иначе дифф на весь файл)."""
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="Миграция статусов контента на пер-языковую схему")
    ap.add_argument("--dry-run", action="store_true", help="показать счётчики, ничего не записывая")
    args = ap.parse_args()

    changed = {
        "блоки карт": 0,
        "wordsStatus": 0,
        "теория": 0,
        "викторины уроков": 0,
        "staging-файлы": 0,
    }

    cards = json.loads(CARDS.read_text(encoding="utf-8"))
    for card in cards["cards"]:
        for block in card["content"].values():
            if isinstance(block.get("status"), str):
                block["status"] = to_map(block["status"])
                changed["блоки карт"] += 1
        if "wordsStatus" not in card:
            # Ключ ставится ровно туда, куда его кладёт build_cards.py — сразу после search.
            # Дописать в конец было бы соблазнительно и незаметно: содержимое то же, а следующая
            # пересборка колоды выдала бы дифф на 312 строк чистой перестановки.
            words = {lang: WORDS_START for lang in CANON}
            items = list(card.items())
            card.clear()
            for key, value in items:
                card[key] = value
                if key == "search":
                    card["wordsStatus"] = words
            card.setdefault("wordsStatus", words)
            changed["wordsStatus"] += 1

    course = json.loads(COURSE.read_text(encoding="utf-8"))
    for module in course["modules"]:
        for lesson in module["lessons"]:
            theory = lesson.get("theory")
            if theory and isinstance(theory.get("status"), str):
                theory["status"] = to_map(theory["status"])
                changed["теория"] += 1
            if isinstance(lesson.get("quizStatus"), str):
                lesson["quizStatus"] = to_map(lesson["quizStatus"])
                changed["викторины уроков"] += 1

    staging = []
    for path in sorted((ROOT / "content").glob("quiz-*.json")):
        quiz = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(quiz.get("status"), str):
            quiz["status"] = to_map(quiz["status"])
            staging.append((path, quiz))
            changed["staging-файлы"] += 1

    report = ", ".join(f"{k}: {v}" for k, v in changed.items())
    if args.dry_run:
        print(f"СУХОЙ ПРОГОН: изменилось бы — {report}")
        return
    if sum(changed.values()) == 0:
        print(f"Нечего мигрировать: схема уже пер-языковая ({report})")
        return

    dump(CARDS, cards)
    dump(COURSE, course)
    for path, data in staging:
        dump(path, data)
    print(f"OK: {report}")


if __name__ == "__main__":
    main()
