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


# адреса единиц со статусом СТАРОЙ, доязыковой формы (строка вместо словаря)
legacy: list[str] = []


def add(counts: dict, part: str, status_map, where: str) -> None:
    """Считает одну единицу контента по каждому языку. Нет ключа языка — значит todo.

    ⚠️ Статус старой формы (строка) не пропускаем молча и не падаем трейсбеком: считаем такую
    единицу невычитанной ни на одном языке и жалуемся адресами в конце отчёта. Промолчать нельзя —
    отчёт готовности единственный, кто отвечает на вопрос «сколько готово», и он обязан
    отличать «не готово» от «я не понял, что тут написано»."""
    if not isinstance(status_map, dict):
        if status_map is not None:
            legacy.append(where)
        status_map = {}
    for lang in LANGS:
        counts[part][lang][status_map.get(lang, "todo")] += 1


def main() -> None:
    counts = {p: {l: Counter() for l in LANGS} for p in PARTS}

    cards = json.loads((ROOT / "content/cards.json").read_text(encoding="utf-8"))["cards"]
    for card in cards:
        for key, block in card["content"].items():
            add(counts, "значения карт", block.get("status"), f"{card['id']}.{key}")
        add(counts, "слова карт", card.get("wordsStatus"), f"{card['id']}.wordsStatus")

    course = json.loads((ROOT / "content/course.json").read_text(encoding="utf-8"))
    for module in course["modules"]:
        for lesson in module["lessons"]:
            if lesson.get("theory"):
                add(counts, "теория", lesson["theory"].get("status"), f"{lesson['id']}.theory")
            if lesson.get("quizStatus") is not None:
                add(counts, "викторины", lesson["quizStatus"], f"{lesson['id']}.quizStatus")

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
            # ⚠️ Округление вниз, а не по правилам: обычное :.0% печатало «готово 100%» уже
            # при 954 из 958, и приёмка по Definition of Done («100% блоков имеют es/pt»)
            # прошла бы с четырьмя недописанными блоками. 100% печатается, только когда 100%.
            pct = 100 if ready == total else int(ready * 100 // total)
            # неизвестный статус (опечатка при ручной правке) не попадает ни в один столбец
            # ORDER, но остаётся в знаменателе — столбцы молча перестают сходиться с total
            other = total - sum(per_lang[lang].get(s, 0) for s in ORDER)
            tail = f"   ⚠️ вне workflow: {other}" if other else ""
            print(f"  {lang}:  {row}   готово {pct}%{tail}")

    print("\nStaging-викторины (статус файла):")
    for path in sorted((ROOT / "content").glob("quiz-*.json")):
        status = json.loads(path.read_text(encoding="utf-8")).get("status") or {}
        if not isinstance(status, dict):
            legacy.append(f"{path.name} (статус файла)")
            line = f"СТАРАЯ ФОРМА: {status!r}"
        else:
            line = ", ".join(f"{k}: {v}" for k, v in sorted(status.items())) or "нет статуса"
        print(f"  {path.name:18s} {line}")

    if legacy:
        print(f"\n⚠️ Статус СТАРОЙ формы (строка вместо словаря) у {len(legacy)} единиц: "
              f"{', '.join(legacy[:5])}{' …' if len(legacy) > 5 else ''}")
        print("   Они посчитаны как todo. Почини: python scripts/migrate_status_lang.py")

    print("\nКарты с недописанным каноном:")
    unfinished = []
    for card in cards:
        gaps = [
            f"{key}.{lang}"
            for key, block in card["content"].items()
            for lang in ("ru", "en")
            if (block["status"] if isinstance(block.get("status"), dict) else {})
            .get(lang, "todo") == "todo"
        ]
        if gaps:
            unfinished.append((card["id"], card["name"]["ru"], len(gaps)))
    if not unfinished:
        print("  нет — канон ru/en заполнен во всех блоках")
    for cid, name, gaps in unfinished:
        print(f"  {cid:16s} {name:20s} незаполненных блоко-языков: {gaps}")


if __name__ == "__main__":
    main()
