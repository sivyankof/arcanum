#!/usr/bin/env python3
"""
Сливает черновики викторин content/quiz-m1-m2.json в content/course.json (спека 08).

Правило то же, что у build_cards.py: слияние, не перезапись — у урока обновляются только
quiz и quizStatus, всё остальное (theory, title, cards) не трогается. Скрипт идемпотентен:
правки редактора вносим в quiz-файл и перезапускаем.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COURSE = ROOT / "content" / "course.json"
QUIZ = ROOT / "content" / "quiz-m1-m2.json"
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


def main() -> None:
    course = json.loads(COURSE.read_text(encoding="utf-8"))
    quiz = json.loads(QUIZ.read_text(encoding="utf-8"))
    card_ids = {c["id"] for c in json.loads(CARDS.read_text(encoding="utf-8"))["cards"]}

    lessons_by_id = {l["id"]: l for m in course["modules"] for l in m["lessons"]}
    status = quiz.get("status", "draft")

    for entry in quiz["lessons"]:
        lid = req(entry, "lessonId", "запись в quiz-m1-m2.json")
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

    COURSE.write_text(
        json.dumps(course, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n"
    )
    total = sum(len(e["questions"]) for e in quiz["lessons"])
    print(f"OK: {total} вопросов слиты в {len(quiz['lessons'])} уроков, статус {status}")


if __name__ == "__main__":
    main()
