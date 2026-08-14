#!/usr/bin/env python3
"""
Конвейер контента: собирает content/cards.json из открытого источника
(tarot-api, MIT — текст A.E. Waite "The Pictorial Key to the Tarot", 1911,
общественное достояние).

Схема каждой карты:
  id            — стабильный ключ (fool, magician, w01..w14, c.., s.., p..)
  arcana        — major | minor
  suit          — wands | cups | swords | pentacles | null
  number        — 0..21 для старших, 1..14 для младших
  name          — {ru, en}
  keywords      — {ru: [...], en: [...]} — витрина, 4 слова (чипы на странице карты)
  search        — {ru: [...], en: [...]} — скрытые поисковые синонимы, 8-12 (спека 04г)
  image         — имя файла в assets/cards/
  source        — {waite_upright, waite_reversed, waite_description} (EN, public domain)
  content       — 6 блоков × 2 языка, каждый блок {ru, en, status}
                  status: todo | draft | reviewed | final
Блоки: general, reversed, love, career, finances, health, day_card, symbolism
"""
import json, re, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = Path("/tmp/tarot-api/static/card_data.json")

RU_MAJOR = {
    0: "Дурак", 1: "Маг", 2: "Верховная Жрица", 3: "Императрица", 4: "Император",
    5: "Иерофант", 6: "Влюблённые", 7: "Колесница", 8: "Сила", 9: "Отшельник",
    10: "Колесо Фортуны", 11: "Справедливость", 12: "Повешенный", 13: "Смерть",
    14: "Умеренность", 15: "Дьявол", 16: "Башня", 17: "Звезда", 18: "Луна",
    19: "Солнце", 20: "Суд", 21: "Мир",
}
MAJOR_IDS = {
    0: "fool", 1: "magician", 2: "high-priestess", 3: "empress", 4: "emperor",
    5: "hierophant", 6: "lovers", 7: "chariot", 8: "strength", 9: "hermit",
    10: "wheel-of-fortune", 11: "justice", 12: "hanged-man", 13: "death",
    14: "temperance", 15: "devil", 16: "tower", 17: "star", 18: "moon",
    19: "sun", 20: "judgement", 21: "world",
}
SUITS_RU = {"wands": "Жезлов", "cups": "Кубков", "swords": "Мечей", "pentacles": "Пентаклей"}
SUITS_EN = {"wands": "Wands", "cups": "Cups", "swords": "Swords", "pentacles": "Pentacles"}
RANKS_RU = {1: "Туз", 2: "Двойка", 3: "Тройка", 4: "Четвёрка", 5: "Пятёрка", 6: "Шестёрка",
            7: "Семёрка", 8: "Восьмёрка", 9: "Девятка", 10: "Десятка",
            11: "Паж", 12: "Рыцарь", 13: "Королева", 14: "Король"}
RANKS_EN = {1: "Ace", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven",
            8: "Eight", 9: "Nine", 10: "Ten", 11: "Page", 12: "Knight", 13: "Queen", 14: "King"}

# Ключевые слова (классическая школа Уэйта) — старшие арканы
KW = {
    "fool": (["новое начало", "спонтанность", "вера в жизнь", "свобода"],
             ["new beginnings", "spontaneity", "leap of faith", "freedom"]),
    "magician": (["воля", "мастерство", "проявление", "ресурсы"],
                 ["willpower", "skill", "manifestation", "resources"]),
    "high-priestess": (["интуиция", "тайна", "внутреннее знание", "пауза"],
                       ["intuition", "mystery", "inner knowing", "stillness"]),
    "empress": (["изобилие", "забота", "творчество", "природа"],
                ["abundance", "nurturing", "creativity", "nature"]),
    "emperor": (["порядок", "власть", "стабильность", "границы"],
                ["structure", "authority", "stability", "boundaries"]),
    "hierophant": (["традиция", "обучение", "наставник", "правила"],
                   ["tradition", "learning", "mentorship", "convention"]),
    "lovers": (["выбор", "союз", "ценности", "гармония"],
               ["choice", "union", "values", "harmony"]),
    "chariot": (["победа", "контроль", "движение", "решимость"],
                ["victory", "control", "momentum", "determination"]),
    "strength": (["внутренняя сила", "мягкость", "терпение", "смелость"],
                 ["inner strength", "gentleness", "patience", "courage"]),
    "hermit": (["поиск себя", "уединение", "мудрость", "внутренний свет"],
               ["soul-searching", "solitude", "wisdom", "inner guidance"]),
    "wheel-of-fortune": (["перемены", "циклы", "судьба", "поворот"],
                         ["change", "cycles", "destiny", "turning point"]),
    "justice": (["справедливость", "правда", "причина и следствие", "баланс"],
                ["justice", "truth", "cause and effect", "balance"]),
    "hanged-man": (["пауза", "новый взгляд", "жертва", "отпускание"],
                   ["pause", "new perspective", "surrender", "letting go"]),
    "death": (["завершение", "трансформация", "переход", "обновление"],
              ["endings", "transformation", "transition", "renewal"]),
    "temperance": (["умеренность", "баланс", "терпение", "синтез"],
                   ["moderation", "balance", "patience", "blending"]),
    "devil": (["зависимость", "привязанность", "теневая сторона", "искушение"],
              ["attachment", "addiction", "shadow self", "temptation"]),
    "tower": (["внезапные перемены", "разрушение", "откровение", "освобождение"],
              ["sudden change", "upheaval", "revelation", "liberation"]),
    "star": (["надежда", "вдохновение", "исцеление", "вера"],
             ["hope", "inspiration", "healing", "faith"]),
    "moon": (["иллюзии", "страхи", "подсознание", "неясность"],
             ["illusion", "fear", "subconscious", "uncertainty"]),
    "sun": (["радость", "успех", "ясность", "жизненная сила"],
            ["joy", "success", "clarity", "vitality"]),
    "judgement": (["пробуждение", "переоценка", "призвание", "второй шанс"],
                  ["awakening", "reckoning", "calling", "second chance"]),
    "world": (["завершение цикла", "целостность", "достижение", "путешествие"],
              ["completion", "wholeness", "achievement", "travel"]),
}

BLOCKS = ["general", "reversed", "love", "career", "finances", "health", "day_card", "symbolism",
          "love_reversed", "career_reversed", "finances_reversed", "health_reversed"]

def clean(s: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", s or "")).strip()

def main():
    data = json.loads(SRC.read_text(encoding="utf-8"))
    cards_src = data["cards"] if isinstance(data, dict) else data
    # Уже написанный контент переносим в новую сборку: keywords, search и тексты блоков —
    # это работа редактора, источник tarot-api про них ничего не знает. Из источника
    # обновляются только name/image/source. Без этого один прогон стирал 624 блока.
    dst_path = ROOT / "content" / "cards.json"
    existing = {}
    if dst_path.exists():
        existing = {c["id"]: c for c in json.loads(dst_path.read_text(encoding="utf-8"))["cards"]}
    out = []
    for c in cards_src:
        if c["type"] == "major":
            n = c["value_int"]
            cid = MAJOR_IDS[n]
            card = {
                "id": cid, "arcana": "major", "suit": None, "number": n,
                "name": {"ru": RU_MAJOR[n], "en": c["name"]},
                "keywords": {"ru": KW[cid][0], "en": KW[cid][1]},
            }
        else:
            suit = c["suit"]
            n = c["value_int"]
            cid = f"{suit[0]}{n:02d}"
            card = {
                "id": cid, "arcana": "minor", "suit": suit, "number": n,
                "name": {"ru": f"{RANKS_RU[n]} {SUITS_RU[suit]}",
                         "en": f"{RANKS_EN[n]} of {SUITS_EN[suit]}"},
                "keywords": {"ru": [], "en": []},  # заполняются в работе над контентом
            }
        prev = existing.get(card["id"])
        if prev:
            card["keywords"] = prev.get("keywords", card["keywords"])
        card["search"] = (prev or {}).get("search", {"ru": [], "en": []})
        card["image"] = f"{card['id']}.jpg"
        card["source"] = {
            "waite_upright": clean(c.get("meaning_up")),
            "waite_reversed": clean(c.get("meaning_rev")),
            "waite_description": clean(c.get("desc")),
            "attribution": "A.E. Waite, The Pictorial Key to the Tarot (1911), public domain; via tarot-api (MIT)",
        }
        content = dict((prev or {}).get("content", {}))
        # спека 25: недостающие ключи BLOCKS дописываются пустыми todo-блоками —
        # схема сама чинится при будущих пересборках (например, когда в BLOCKS добавят новый блок)
        for b in BLOCKS:
            content.setdefault(b, {"ru": "", "en": "", "status": "todo"})
        card["content"] = content
        out.append(card)

    order = {"major": 0, "wands": 1, "cups": 2, "swords": 3, "pentacles": 4}
    out.sort(key=lambda x: (order[x["suit"] or "major"] if x["arcana"] == "minor" else 0,
                            0 if x["arcana"] == "major" else 1, x["number"]))
    dst_path.write_text(json.dumps({"version": 1, "deck": "rider-waite-smith-1909",
                                    "cards": out}, ensure_ascii=False, indent=1) + "\n",
                        encoding="utf-8", newline="\n")
    majors = sum(1 for x in out if x["arcana"] == "major")
    kept = sum(1 for x in out if any(b["status"] != "todo" for b in x["content"].values()))
    print(f"OK: {len(out)} карт ({majors} старших, {len(out)-majors} младших) -> {dst_path}")
    print(f"перенесено из прежней сборки: {len(existing)} карт, из них с готовым текстом {kept}")

if __name__ == "__main__":
    main()
