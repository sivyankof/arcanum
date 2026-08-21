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
    python scripts/set_status.py draft --from reviewed --only words --lang en --allow-back

Движение НАЗАД (последняя строка) требует явного --allow-back: workflow идёт вперёд, и откат —
исключение, а не опечатка. Нужен он ровно тогда, когда редактор отзывает вычитку: «эти слова
на самом деле не вычитаны».

Части контента (--only): cards — блоки значений у каждой из 78 карт (cards.json);
words — слова витрины и поиска карты (name + keywords + search, один статус на три поля);
theory — тексты теории уроков (course.json); quiz — викторины (все content/quiz-*.json
+ course.json; статус у каждого staging-файла свой, двигается только совпавший с исходным).

Статус живёт ПО ЯЗЫКАМ (спека 28а): {"ru": "reviewed", "en": "draft"}. Двигаются только языки,
перечисленные в --lang (по умолчанию канон ru,en), и только те из них, чей статус совпал
с исходным, — иначе «русский вычитан, испанский черновик» схлопнулось бы в одно значение.
Отсутствующий у блока язык считается todo.
Формат файлов сохраняется тот же, что пишут build_cards.py и merge_quiz.py (indent=1), и
переводы строк — те, что уже стоят в конкретном файле на диске (LF у cards.json, CRLF
у course.json и quiz-*.json на 21.08), а не единый стиль на весь репозиторий.
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


# сколько единиц пропущено, потому что у языка нет текста (печатается в отчёте)
skipped_empty = 0
# адреса единиц со статусом СТАРОЙ формы (строка вместо словаря) — молча пропускать нельзя
legacy: list[str] = []


def bump(holder: dict, key: str, src: str, dst: str, langs: list[str],
         has_text, where: str) -> int:
    """Двигает статус у перечисленных языков; отсутствующий язык считается todo.
    Возвращает, сколько языков сдвинулось. Языки, чей статус не совпал с исходным, не трогает —
    поэтому «русский вычитан, испанский черновик» не схлопывается в одно значение.

    ⚠️ Статус НЕ выдаётся языку, у которого нет ни знака текста (`has_text(lang)` ложна).
    Без этой защиты `set_status.py draft --lang es` на непереведённом корпусе проставил бы
    испанский статус всем 1100 единицам, а `content_stats.py` отрапортовал бы «готово 100%»
    при нуле переведённых строк — ровно тот класс, ради снятия которого задача 28а и делалась
    (в задаче 31 `reviewed` от русского так же молча накрыл английский).

    ⚠️ Статус старой, доязыковой формы (строка) — не «нечего двигать», а сломанные данные:
    такая единица навсегда выпала бы из workflow молча. Собираем адреса и жалуемся в конце."""
    global skipped_empty
    status = holder.get(key)
    if isinstance(status, str):
        legacy.append(where)
        return 0
    if not isinstance(status, dict):
        return 0
    moved = 0
    for lang in langs:
        if status.get(lang, "todo") != src:
            continue
        if not has_text(lang):
            skipped_empty += 1
            continue
        status[lang] = dst
        moved += 1
    return moved


def text_in(rec, lang: str) -> bool:
    """Есть ли у многоязычной записи непустое содержимое на языке (строка или список слов)."""
    value = (rec or {}).get(lang)
    if isinstance(value, str):
        return value.strip() != ""
    return bool(value)


def quiz_text(questions, lang: str) -> bool:
    """У викторины язык считается написанным, когда он есть у КАЖДОГО вопроса целиком:
    сам вопрос, все три варианта и пояснение. Половина переведённой викторины — не викторина."""
    if not questions:
        return False
    for q in questions:
        if not (text_in(q.get("q"), lang) and text_in(q.get("explain"), lang)):
            return False
        if not all(text_in(o, lang) for o in q.get("options", [])):
            return False
    return True


def detect_newline(path: Path) -> str:
    """Определяет фактический стиль переводов строк файла НА ДИСКЕ, не полагаясь на
    core.autocrlf (git может как раз держать рабочее дерево не в том стиле, что в блобе).
    У каждого файла контента свой сложившийся стиль — cards.json чистый LF, а course.json
    и все content/quiz-*.json на 21.08 лежат в CRLF — берём тот, что преобладает."""
    raw = path.read_bytes()
    crlf = raw.count(b"\r\n")
    lf_only = raw.count(b"\n") - crlf
    return "\r\n" if crlf > lf_only else "\n"


def dump(path: Path, data: object) -> None:
    """Запись в том же формате, что и остальные скрипты конвейера, но БЕЗ навязывания
    своего стиля переводов строк: пишем тем же стилем, что уже стоит в файле (см.
    detect_newline). Раньше запись всегда форсировала LF — на CRLF-файлах (course.json,
    quiz-*.json) это меняло КАЖДУЮ строку и раздувало diff на весь файл ради одной правки
    статуса (хвост 28к)."""
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
        newline=detect_newline(path),
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="Перевод статусов контента на следующую ступень")
    ap.add_argument("to", choices=ORDER, help="целевой статус")
    ap.add_argument("--from", dest="src", choices=ORDER, help="исходный статус (по умолчанию — предыдущая ступень)")
    ap.add_argument("--only", choices=PARTS, help="ограничить одной частью контента")
    ap.add_argument("--lang", help=f"языки через запятую, по умолчанию канон {','.join(CANON)}")
    ap.add_argument("--allow-back", action="store_true",
                    help="разрешить движение НАЗАД по workflow (редактор отозвал вычитку)")
    ap.add_argument("--dry-run", action="store_true", help="показать, что изменится, и выйти")
    args = ap.parse_args()

    if args.src is None:
        idx = ORDER.index(args.to)
        if idx == 0:
            print("ОШИБКА: у todo нет предыдущей ступени — укажите --from явно")
            sys.exit(1)
        args.src = ORDER[idx - 1]
    if ORDER.index(args.to) <= ORDER.index(args.src) and not args.allow_back:
        print(f"ОШИБКА: {args.src} -> {args.to} не движение вперёд по workflow")
        print("  Если вычитку действительно отозвали — повторите с --allow-back.")
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
                for key, block in card["content"].items():
                    changed["cards"] += bump(
                        block, "status", args.src, args.to, langs,
                        lambda lang, b=block: text_in(b, lang), f"{card['id']}.{key}")
            if "words" in parts:
                # слова карты — единица из ТРЁХ полей (решение 4а спеки 28а): язык считается
                # написанным, только когда есть и название, и витрина, и поисковые синонимы
                changed["words"] += bump(
                    card, "wordsStatus", args.src, args.to, langs,
                    lambda lang, c=card: (text_in(c.get("name"), lang)
                                          and text_in(c.get("keywords"), lang)
                                          and text_in(c.get("search"), lang)),
                    f"{card['id']}.wordsStatus")

    course = json.loads(COURSE.read_text(encoding="utf-8"))
    if "theory" in parts:
        for module in course["modules"]:
            for lesson in module["lessons"]:
                theory = lesson.get("theory")
                if theory:
                    changed["theory"] += bump(
                        theory, "status", args.src, args.to, langs,
                        lambda lang, th=theory: text_in(th, lang), f"{lesson['id']}.theory")

    changed_quiz_files: list[tuple[Path, object]] = []
    if "quiz" in parts:
        # у викторин статус хранится дважды: в черновике редактора и в собранном course.json.
        # Правим оба, иначе следующий прогон merge_quiz.py откатит course.json назад.
        # Staging-файлов несколько (по порции контента), у каждого статус свой — переписываем
        # только те, чей статус совпал с исходным, остальные не трогаем даже форматированием.
        for quiz_path in sorted((ROOT / "content").glob("quiz-*.json")):
            quiz = json.loads(quiz_path.read_text(encoding="utf-8"))
            questions = [q for e in quiz.get("lessons", []) for q in e.get("questions", [])]
            if bump(quiz, "status", args.src, args.to, langs,
                    lambda lang, qs=questions: quiz_text(qs, lang), quiz_path.name):
                changed_quiz_files.append((quiz_path, quiz))
        for module in course["modules"]:
            for lesson in module["lessons"]:
                changed["quiz"] += bump(
                    lesson, "quizStatus", args.src, args.to, langs,
                    lambda lang, ls=lesson: quiz_text(ls.get("quiz"), lang),
                    f"{lesson['id']}.quizStatus")

    # ⚠️ staging-файлы обязаны входить в total: иначе при сдвиге ТОЛЬКО их (course.json уже
    # на целевом статусе — ровно тот рассинхрон, ради которого периметр расширяли) срабатывал бы
    # ранний выход ниже, файлы не записывались бы на диск, а следующий merge_quiz.py откатил бы
    # course.json назад, то есть обещание «правится в ДВУХ местах» не выполнялось бы молча.
    total = sum(changed.values()) + len(changed_quiz_files)
    report = ", ".join(f"{p}: {changed[p]}" for p in parts)
    if changed_quiz_files:
        report += f", staging-файлов: {len(changed_quiz_files)}"
    langs_note = ", ".join(langs)
    if legacy:
        print(f"ВНИМАНИЕ: статус СТАРОЙ формы (строка вместо словаря) у {len(legacy)} единиц — "
              f"они пропущены: {', '.join(legacy[:5])}{' …' if len(legacy) > 5 else ''}")
        print("  Почини форму (python scripts/migrate_status_lang.py) — иначе они вне workflow.")
    if skipped_empty:
        print(f"Пропущено {skipped_empty} единиц: у языка нет текста, статус ему не выдаётся")
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
