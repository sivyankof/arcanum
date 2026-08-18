#!/usr/bin/env python3
"""Отчёт о готовности контента ПО ЯЗЫКАМ: сколько единиц в каком статусе (спека 28а).

Единица — то, у чего есть свой статус: блок значений карты, слова карты (name + keywords +
search одним куском), теория урока, викторина урока. Отсутствующий у единицы язык считается
todo, поэтому непереведённый испанский виден столбцом чисел, а не отсутствием строки —
до 19.08 статус был один на все языки, и «сколько готово по-испански» спросить было негде.

Курс сюда добавлен той же задачей: раньше скрипт считал только cards.json и молчал про
32 теории и 32 викторины.

Запуск из корня:  python scripts/content_stats.py
"""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LANGS = ("ru", "en", "es", "pt")
ORDER = ("final", "reviewed", "draft", "todo")
PARTS = ("значения карт", "слова карт", "теория", "викторины")


def add(counts: dict, part: str, status_map: dict | None) -> None:
    """Считает одну единицу контента по каждому языку. Нет ключа языка — значит todo."""
    for lang in LANGS:
        counts[part][lang][(status_map or {}).get(lang, "todo")] += 1


def main() -> None:
    counts = {p: {l: Counter() for l in LANGS} for p in PARTS}

    cards = json.loads((ROOT / "content/cards.json").read_text(encoding="utf-8"))["cards"]
    for card in cards:
        for block in card["content"].values():
            add(counts, "значения карт", block.get("status"))
        add(counts, "слова карт", card.get("wordsStatus"))

    course = json.loads((ROOT / "content/course.json").read_text(encoding="utf-8"))
    for module in course["modules"]:
        for lesson in module["lessons"]:
            if lesson.get("theory"):
                add(counts, "теория", lesson["theory"].get("status"))
            if lesson.get("quizStatus") is not None:
                add(counts, "викторины", lesson["quizStatus"])

    for part in PARTS:
        per_lang = counts[part]
        total = sum(per_lang["ru"].values())
        if not total:
            print(f"\n{part}: единиц нет")
            continue
        print(f"\n{part} — {total} единиц на язык")
        for lang in LANGS:
            row = "  ".join(f"{s}: {per_lang[lang].get(s, 0):4d}" for s in ORDER)
            ready = per_lang[lang].get("reviewed", 0) + per_lang[lang].get("final", 0)
            print(f"  {lang}:  {row}   готово {ready / total:.0%}")

    print("\nStaging-викторины (статус файла):")
    for path in sorted((ROOT / "content").glob("quiz-*.json")):
        status = json.loads(path.read_text(encoding="utf-8")).get("status") or {}
        line = ", ".join(f"{k}: {v}" for k, v in sorted(status.items())) or "нет статуса"
        print(f"  {path.name:18s} {line}")

    print("\nКарты с недописанным каноном:")
    unfinished = []
    for card in cards:
        gaps = [
            f"{key}.{lang}"
            for key, block in card["content"].items()
            for lang in ("ru", "en")
            if (block.get("status") or {}).get(lang, "todo") == "todo"
        ]
        if gaps:
            unfinished.append((card["id"], card["name"]["ru"], len(gaps)))
    if not unfinished:
        print("  нет — канон ru/en заполнен во всех блоках")
    for cid, name, gaps in unfinished:
        print(f"  {cid:16s} {name:20s} незаполненных блоко-языков: {gaps}")


if __name__ == "__main__":
    main()
