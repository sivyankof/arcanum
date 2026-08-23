#!/usr/bin/env python3
"""Применение правок дистракторов викторины из списка «было → стало» (задача 28р).

Родня `apply_canon_fixes.py`: тот применяет правки канона карт, этот — вариантов викторины.
Общее правило обоих: **блок ищется по точному тексту «было», а не по индексу** — совпадение
обязано быть ровно одно, иначе правка не применяется. Так закрыт класс «правка уехала не в тот
вариант»: индексы в списке предложений могли быть посчитаны от другой ревизии файла.

Формат входного файла (тот же, что читает `check_edits.py`, — `docs/specs/28r-changed-addresses.md`):

    ## m2l3-q1[1].ru
    - было: <точный текущий текст>
    - стало: <новый текст>

Адрес: урок, вопрос с ЕДИНИЦЫ, вариант в квадратных скобках с НУЛЯ, язык.

Что скрипт отказывается делать (это защита, а не ограничение):
  - править вариант с индексом `correct` — правится ТОЛЬКО дистрактор;
  - править, если «было» не найдено или найдено не в том варианте, что указан адресом;
  - трогать `es`/`pt` — переводы заливает Cowork с пары ru+en, правка по месту оставляет следы
    старой формулировки (правило задачи 28п);
  - трогать текст вопроса, `explain`, `correct` — их этот скрипт не умеет менять в принципе.

По умолчанию — сухой прогон. `--apply` записывает файлы (indent 1, ensure_ascii=False — формат
репозитория; PowerShell к этим файлам не подпускать, урок §12 lessons).
После записи ОБЯЗАТЕЛЬНЫ: `python scripts/merge_quiz.py`, затем
`python scripts/check_quiz_guess.py --against <ревизия до правок>` и
`python scripts/check_edits.py docs/specs/28r-changed-addresses.md`.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

CONTENT = Path("content")
ALLOWED_LANGS = ("ru", "en")
ADDR_RE = re.compile(r"^##\s+(m\d+l\d+)-q(\d+)\[(\d+)\]\.(\w+)\s*$")


def parse_edits(path: Path) -> list[dict]:
    """Список правок из markdown. Непонятая строка — находка, а не молчаливый пропуск."""
    edits: list[dict] = []
    current: dict | None = None
    problems: list[str] = []
    for n, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw.strip()
        if line.startswith("## "):
            m = ADDR_RE.match(line)
            if not m:
                problems.append(f"строка {n}: адрес не разобран — {line}")
                current = None
                continue
            current = {"lesson": m.group(1), "number": int(m.group(2)),
                       "index": int(m.group(3)), "lang": m.group(4), "line": n}
            edits.append(current)
        elif line.startswith("- было:") and current is not None:
            current["before"] = line[len("- было:"):].strip()
        elif line.startswith("- стало:") and current is not None:
            current["after"] = line[len("- стало:"):].strip()
    if problems:
        print("[ВХОД НЕ РАЗОБРАН]", file=sys.stderr)
        for p in problems:
            print(f"  {p}", file=sys.stderr)
        raise SystemExit(1)
    incomplete = [e for e in edits if "before" not in e or "after" not in e]
    if incomplete:
        for e in incomplete:
            print(f"[НЕПОЛНАЯ ЗАПИСЬ] строка {e['line']}: {e['lesson']}-q{e['number']}", file=sys.stderr)
        raise SystemExit(1)
    return edits


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("edits", type=Path, help="файл списка правок (docs/specs/28r-changed-addresses.md)")
    ap.add_argument("--apply", action="store_true", help="записать файлы (без флага — сухой прогон)")
    args = ap.parse_args()

    if not Path("app.json").exists():
        print("Запускать из корня репозитория", file=sys.stderr)
        return 1

    edits = parse_edits(args.edits)
    files = {p.name: json.loads(p.read_text(encoding="utf-8")) for p in sorted(CONTENT.glob("quiz-*.json"))}

    # индекс: (урок, номер вопроса) → (имя файла, объект вопроса)
    index: dict[tuple[str, int], tuple[str, dict]] = {}
    for name, data in files.items():
        for lesson in data["lessons"]:
            for i, item in enumerate(lesson["questions"], start=1):
                index[(lesson["lessonId"], i)] = (name, item)

    applied, refused = 0, []
    for e in edits:
        addr = f"{e['lesson']}-q{e['number']}[{e['index']}].{e['lang']}"
        if e["lang"] not in ALLOWED_LANGS:
            refused.append(f"{addr}: язык {e['lang']} — правятся только ru/en, переводы льёт Cowork")
            continue
        found = index.get((e["lesson"], e["number"]))
        if not found:
            refused.append(f"{addr}: вопроса нет в корпусе")
            continue
        name, item = found
        if e["index"] == item["correct"]:
            refused.append(f"{addr}: это ВЕРНЫЙ вариант (correct={item['correct']}) — правятся только дистракторы")
            continue
        if e["index"] >= len(item["options"]):
            refused.append(f"{addr}: варианта с таким индексом нет")
            continue
        # поиск по тексту «было»: совпадение обязано быть ровно одно и ровно на своём месте
        matches = [i for i, o in enumerate(item["options"]) if o[e["lang"]] == e["before"]]
        if len(matches) != 1:
            refused.append(f"{addr}: текст «было» найден {len(matches)} раз — правка не применяется")
            continue
        if matches[0] != e["index"]:
            refused.append(f"{addr}: текст «было» стоит в варианте [{matches[0]}], а адрес указывает [{e['index']}]")
            continue
        if item["options"][e["index"]][e["lang"]] == e["after"]:
            refused.append(f"{addr}: текст уже равен «стало» — правка применена ранее")
            continue
        item["options"][e["index"]][e["lang"]] = e["after"]
        applied += 1
        print(f"  ✓ {addr}")

    print(f"\nПрименимо: {applied} из {len(edits)}")
    if refused:
        print(f"ОТКАЗАНО: {len(refused)}")
        for r in refused:
            print(f"  ✗ {r}")

    if args.apply and applied:
        for name, data in files.items():
            path = CONTENT / name
            path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"\nЗаписано файлов: {len(files)}. Дальше обязательны merge_quiz.py и оба прогона проверок.")
    elif applied:
        print("\nСухой прогон. Записать — с флагом --apply.")

    return 1 if refused else 0


if __name__ == "__main__":
    raise SystemExit(main())
