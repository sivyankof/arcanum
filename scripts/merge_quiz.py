#!/usr/bin/env python3
"""
Сливает черновики викторин content/quiz-*.json в content/course.json (спеки 08 и 26).

Staging-файлов несколько — по одному на порцию контента (quiz-m1-m2.json, quiz-m3.json…),
потому что статус у файла ОДИН на все его уроки: живи М1–М2 и М3 в одном файле, прогон
слияния откатывал бы reviewed обратно в draft. Правило то же, что у build_cards.py:
слияние, не перезапись — у урока обновляются только quiz и quizStatus, всё остальное
(theory, title, cards) не трогается. Скрипт идемпотентен: правки редактора вносим
в quiz-файл и перезапускаем.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COURSE = ROOT / "content" / "course.json"
CARDS = ROOT / "content" / "cards.json"


def fail(msg: str) -> None:
    print(f"ОШИБКА: {msg}")
    sys.exit(1)


def req(d: dict, key: str, where: str):
    """Безопасный доступ к обязательному полю словаря: пропавший ключ у редактора даёт то же
    русское сообщение с номером урока/вопроса, что и остальные проверки, а не голый KeyError."""
    if key not in d:
        fail(f"{where}: нет поля {key!r}")
    return d[key]


def merge_file(quiz_path: Path, lessons_by_id: dict, card_ids: set) -> int:
    """Сливает один staging-файл; возвращает число слитых вопросов."""
    quiz = json.loads(quiz_path.read_text(encoding="utf-8"))
    # статус файла — словарь по языкам (спека 28а). Файла без статуса быть не должно, но если он
    # есть — это «не готово ни на одном языке», то есть пустой словарь, а не draft на всех сразу.
    status = quiz.get("status") or {}
    # ⚠️ Строковый статус — форма ДО спеки 28а. Пропустить его молча нельзя: он доехал бы
    # до course.json и откатил схему у всех уроков файла (та самая ловушка двойного хранения),
    # а падать сырым AttributeError на sorted(status.items()) файл, который придирчиво
    # валидирует каждое поле вопроса, не имеет права.
    if not isinstance(status, dict):
        fail(f"{quiz_path.name}: статус старой формы {status!r} — ожидается словарь по языкам, "
             f"например {{\"ru\": \"reviewed\"}}; почини python scripts/migrate_status_lang.py")

    for entry in quiz["lessons"]:
        lid = req(entry, "lessonId", f"запись в {quiz_path.name}")
        lesson = lessons_by_id.get(lid)
        if lesson is None:
            fail(f"урок {lid} не найден в course.json")
        questions = req(entry, "questions", lid)
        if len(questions) != 5:
            fail(f"{lid}: вопросов {len(questions)}, ожидалось 5")
        for i, q in enumerate(questions):
            where = f"{lid}, вопрос {i + 1}"
            q_type = req(q, "type", where)
            if q_type not in ("single", "card"):
                fail(f"{where}: неизвестный type {q_type!r}")
            options = req(q, "options", where)
            if len(options) != 3:
                fail(f"{where}: вариантов {len(options)}, ожидалось 3")
            correct = req(q, "correct", where)
            if not (0 <= correct < 3):
                fail(f"{where}: correct {correct} вне диапазона 0..2")
            for field_name in ("q", "explain"):
                f_val = req(q, field_name, where)
                if not (f_val.get("ru") and f_val.get("en")):
                    fail(f"{where}: поле {field_name} не двуязычно")
            for o in options:
                if not (o.get("ru") and o.get("en")):
                    fail(f"{where}: вариант не двуязычен")
            if q_type == "card" and q.get("cardId") not in card_ids:
                fail(f"{where}: cardId {q.get('cardId')!r} нет в cards.json")
        lesson["quiz"] = questions
        lesson["quizStatus"] = status

    total = sum(len(e["questions"]) for e in quiz["lessons"])
    langs = ", ".join(f"{k}: {v}" for k, v in sorted(status.items())) or "нет статуса"
    print(f"{quiz_path.name}: {total} вопросов в {len(quiz['lessons'])} уроков, статус — {langs}")
    return total


def main() -> None:
    course = json.loads(COURSE.read_text(encoding="utf-8"))
    card_ids = {c["id"] for c in json.loads(CARDS.read_text(encoding="utf-8"))["cards"]}
    lessons_by_id = {l["id"]: l for m in course["modules"] for l in m["lessons"]}

    quiz_files = sorted((ROOT / "content").glob("quiz-*.json"))
    if not quiz_files:
        fail("не найдено ни одного content/quiz-*.json")

    grand_total = sum(merge_file(p, lessons_by_id, card_ids) for p in quiz_files)

    COURSE.write_text(
        json.dumps(course, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n"
    )
    print(f"OK: всего {grand_total} вопросов из {len(quiz_files)} файлов")


if __name__ == "__main__":
    main()
