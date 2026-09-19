#!/usr/bin/env python3
"""Контакт-лист фрагментов игры «Угадай карту по фрагменту» (спека 72) —
docs/screenshots/72/fragments-sheet.jpg.

Читает content/fragments.json (разметка: cx/cy — центр квадрата в долях ширины/высоты
скана, size — сторона квадрата в долях ШИРИНЫ) и content/cards.json (список старших
арканов, имя файла скана). Для каждого фрагмента вырезает квадрат из assets/cards/<файл>,
масштабирует до 300×300 (LANCZOS), подписывает «id #n · cx cy size» и складывает сеткой
6 в ряд в один JPEG. Только читает контент, ничего не пишет обратно в JSON.

Геометрия и допуски — те же, что в src/lib/fragmentGame.ts (FRAGMENT_TOP/BOTTOM,
FRAGMENT_SIZE_MIN/MAX) и в контракт-тесте src/lib/__tests__/fragments.test.ts: значения
продублированы здесь константами, а не импортированы (Python не читает TypeScript),
поэтому при правке порогов в fragmentGame.ts поправь и здесь.

Запуск из корня репозитория, без аргументов:
    python scripts/fragment_sheet.py

Сам проверяет ошибками (код 1, лист всё равно записывается — дефект виднее глазами):
  - квадрат вылезает за скан (left/top < 0 или right/bottom > ширины/высоты);
  - верх квадрата выше 10 % высоты ИЛИ низ ниже 90 % (это полосы номера аркана и подписи
    имени карты — дефект задачи 58, ответ не должен быть виден в кадре фрагмента);
  - size вне 0.22–0.45;
  - id фрагмента не входит в 22 старших аркана колоды.
Печатает итог «фрагментов N, карт M из 22». Дальше смотреть лист ГЛАЗАМИ: каждый квадрат
обязан быть узнаваемым, без надписей/номеров/имени карты в кадре и без наготы.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# консоль Windows в cp1251 роняет print на «·»/«×» (урок 55/63) — настраиваем потоки сами
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

CONTENT = Path("content")
CARDS_DIR = Path("assets/cards")
OUT = Path("docs/screenshots/72/fragments-sheet.jpg")

# зеркало src/lib/fragmentGame.ts
FRAGMENT_TOP = 0.10
FRAGMENT_BOTTOM = 0.10
FRAGMENT_SIZE_MIN = 0.22
FRAGMENT_SIZE_MAX = 0.45

TILE = 300           # сторона превью фрагмента
LABEL_H = 34          # полоса подписи под тайлом
PAD = 10              # отступ между тайлами и по краям
COLS = 6
FONT_PATH = "C:/Windows/Fonts/arial.ttf"
FONT_SIZE = 13


def load_font() -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype(FONT_PATH, FONT_SIZE)
    except OSError:
        return ImageFont.load_default()


def main() -> int:
    if not Path("app.json").exists():
        print("Запускать из корня репозитория (рядом с app.json)", file=sys.stderr)
        return 1

    with open(CONTENT / "fragments.json", encoding="utf-8") as f:
        fragments: dict[str, list[dict[str, float]]] = json.load(f)
    with open(CONTENT / "cards.json", encoding="utf-8") as f:
        cards = json.load(f)["cards"]

    majors = {c["id"]: c for c in cards if c["arcana"] == "major"}
    errors: list[str] = []
    tiles: list[Image.Image] = []
    font = load_font()
    total_fragments = 0

    for card_id, boxes in fragments.items():
        card = majors.get(card_id)
        if card is None:
            errors.append(f"{card_id}: id нет в колоде старших арканов")
            continue
        img_path = CARDS_DIR / card["image"]
        with Image.open(img_path) as scan:
            scan = scan.convert("RGB")
            W, H = scan.size
            for i, box in enumerate(boxes):
                total_fragments += 1
                cx, cy, size = box["cx"], box["cy"], box["size"]
                side = size * W
                left = cx * W - side / 2
                top = cy * H - side / 2
                right = left + side
                bottom = top + side

                if not (FRAGMENT_SIZE_MIN <= size <= FRAGMENT_SIZE_MAX):
                    errors.append(f"{card_id}#{i}: size {size} вне {FRAGMENT_SIZE_MIN}-{FRAGMENT_SIZE_MAX}")
                if left < 0 or top < 0 or right > W or bottom > H:
                    errors.append(f"{card_id}#{i}: квадрат вылез за скан ({W}x{H})")
                if top / H < FRAGMENT_TOP:
                    errors.append(f"{card_id}#{i}: верх {top / H:.3f} < {FRAGMENT_TOP} (полоса номера)")
                if bottom / H > 1 - FRAGMENT_BOTTOM:
                    errors.append(f"{card_id}#{i}: низ {bottom / H:.3f} > {1 - FRAGMENT_BOTTOM} (полоса имени)")

                crop = scan.crop((round(left), round(top), round(right), round(bottom)))
                crop = crop.resize((TILE, TILE), Image.LANCZOS)

                tile = Image.new("RGB", (TILE, TILE + LABEL_H), (20, 20, 26))
                tile.paste(crop, (0, 0))
                d = ImageDraw.Draw(tile)
                d.text((4, TILE + 3), f"{card_id} #{i}", fill=(255, 255, 255), font=font)
                d.text((4, TILE + 17), f"{cx:.3f} {cy:.3f} {size:.3f}", fill=(200, 200, 210), font=font)
                tiles.append(tile)

    cards_present = len(set(fragments.keys()) & set(majors.keys()))

    if tiles:
        rows = (len(tiles) + COLS - 1) // COLS
        tile_w, tile_h = TILE, TILE + LABEL_H
        sheet_w = COLS * tile_w + (COLS + 1) * PAD
        sheet_h = rows * tile_h + (rows + 1) * PAD
        sheet = Image.new("RGB", (sheet_w, sheet_h), (10, 10, 14))
        for idx, tile in enumerate(tiles):
            col = idx % COLS
            row = idx // COLS
            x = PAD + col * (tile_w + PAD)
            y = PAD + row * (tile_h + PAD)
            sheet.paste(tile, (x, y))
        OUT.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(OUT, "JPEG", quality=88)

    print(f"фрагментов {total_fragments}, карт {cards_present} из 22")

    if errors:
        print(f"[FAIL] {len(errors)} ошибок:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1

    print(f"[OK] {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
