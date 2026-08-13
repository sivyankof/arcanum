#!/usr/bin/env python3
"""Вставляет блок birth_path (фразы «ваш путь» онбординга, спека 09) в content/cards.json.

22 фразы — по одной на старший аркан, черновики (status: draft); вычитка редактором —
отдельная задача бэклога. Идемпотентен: СУЩЕСТВУЮЩИЙ блок не перезаписывает, чтобы повторный
прогон после вычитки не откатил правки редактора к черновику.
Формат записи — как у остального конвейера (ensure_ascii=False, indent=1, LF).
Запуск из корня: python scripts/add_birth_path.py
"""
import json
from pathlib import Path

CARDS = Path(__file__).resolve().parent.parent / "content" / "cards.json"

# Тон — content-guide: про характер пути, без предсказаний и обещаний, без медицины.
# Образец Силы (8) — дословно из макета design-reference.html (#ob3).
PHRASES = {
    0: {"ru": "Ваш путь — доверие к началу: вы умеете шагать в новое налегке, и мир отвечает вам дорогой.",
        "en": "Your path is trust in beginnings: you step into the new travelling light, and the road rises to meet you."},
    1: {"ru": "Ваш путь — воплощение: у вас под рукой всегда есть всё, чтобы замысел стал делом.",
        "en": "Your path is manifestation: you always have everything at hand to turn an idea into reality."},
    2: {"ru": "Ваш путь — внутренний голос: вы слышите то, что ещё не сказано вслух, и редко ошибаетесь, доверяя тишине.",
        "en": "Your path is the inner voice: you hear what has not yet been said aloud, and silence rarely misleads you."},
    3: {"ru": "Ваш путь — взращивание: рядом с вами люди и замыслы расцветают, как сад в заботливых руках.",
        "en": "Your path is nurturing: people and plans blossom around you like a well-tended garden."},
    4: {"ru": "Ваш путь — опора: вы строите порядок, на который могут положиться другие.",
        "en": "Your path is foundation: you build an order others can lean on."},
    5: {"ru": "Ваш путь — передача смысла: вы соединяете опыт поколений с собственной мудростью и делитесь ею просто.",
        "en": "Your path is passing on meaning: you join the wisdom of generations with your own and share it simply."},
    6: {"ru": "Ваш путь — выбор сердцем: вы умеете находить своё среди множества дорог и хранить верность выбранному.",
        "en": "Your path is choosing with the heart: you find what is truly yours among many roads and stay faithful to it."},
    7: {"ru": "Ваш путь — движение: воля и собранность несут вас туда, куда другие лишь смотрят.",
        "en": "Your path is motion: will and focus carry you where others only look."},
    8: {"ru": "Ваш путь — мягкая смелость: вы приручаете бури терпением там, где другие ломают двери.",
        "en": "Your path is gentle courage: you tame storms with patience where others break down doors."},
    9: {"ru": "Ваш путь — глубина: вы находите ответы наедине с собой и возвращаетесь к людям со светом.",
        "en": "Your path is depth: you find answers alone with yourself and return to people carrying light."},
    10: {"ru": "Ваш путь — чувство поворота: вы умеете ловить момент, когда жизнь меняет курс, и разворачиваться вместе с ней.",
         "en": "Your path is sensing the turn: you catch the moment life changes course and turn with it."},
    11: {"ru": "Ваш путь — ясность и честность: вы видите суть и умеете называть вещи своими именами.",
         "en": "Your path is clarity and honesty: you see the essence and call things by their names."},
    12: {"ru": "Ваш путь — иной взгляд: там, где все видят тупик, вы находите смысл, просто посмотрев с другой стороны.",
         "en": "Your path is another angle: where everyone sees a dead end, you find meaning simply by looking differently."},
    13: {"ru": "Ваш путь — обновление: вы не боитесь завершать отжившее, и потому новое приходит к вам легче, чем к другим.",
         "en": "Your path is renewal: you are not afraid to end what is over, so the new comes to you more easily."},
    14: {"ru": "Ваш путь — соразмерность: вы соединяете противоположности в живое равновесие.",
         "en": "Your path is balance: you blend opposites into living harmony."},
    15: {"ru": "Ваш путь — честность с собственными желаниями: вы видите свои привязанности в лицо, и в этом ваша свобода.",
         "en": "Your path is honesty with your own desires: you look your attachments in the eye, and that is your freedom."},
    16: {"ru": "Ваш путь — правда: вы умеете отпускать шаткое, чтобы строить на настоящем.",
         "en": "Your path is truth: you can let go of the shaky to build on what is real."},
    17: {"ru": "Ваш путь — тихая надежда: вы умеете видеть свет впереди и вести к нему других.",
         "en": "Your path is quiet hope: you see the light ahead and lead others toward it."},
    18: {"ru": "Ваш путь — чуткость: вы читаете полутона и сны там, где другие видят только темноту.",
         "en": "Your path is sensitivity: you read the half-tones and dreams where others see only darkness."},
    19: {"ru": "Ваш путь — ясная радость: ваше тепло освещает и вас, и тех, кто рядом.",
         "en": "Your path is clear joy: your warmth lights up both you and those around you."},
    20: {"ru": "Ваш путь — пробуждение: вы умеете слышать зов перемен и отвечать на него всей жизнью.",
         "en": "Your path is awakening: you hear the call of change and answer it with your whole life."},
    21: {"ru": "Ваш путь — целостность: вы доводите начатое до полноты и умеете праздновать завершение.",
         "en": "Your path is wholeness: you carry what you began to completion and know how to celebrate it."},
}


def main() -> None:
    data = json.loads(CARDS.read_text(encoding="utf-8"))
    added = skipped = 0
    for card in data["cards"]:
        if card["arcana"] != "major":
            continue
        if "birth_path" in card["content"]:
            skipped += 1
            continue
        phrase = PHRASES[card["number"]]
        card["content"]["birth_path"] = {"ru": phrase["ru"], "en": phrase["en"], "status": "draft"}
        added += 1
    CARDS.write_text(
        json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n"
    )
    print(f"OK: birth_path добавлен {added}, уже был {skipped}")


if __name__ == "__main__":
    main()
