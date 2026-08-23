#!/usr/bin/env python3
"""Иконка пуш-уведомления для Android (спека 55) — assets/images/notification-icon.png.

Зачем нужна: Android рисует в статус-баре СИЛУЭТ иконки, а не саму иконку приложения.
Требование Google — «all-white design with a transparent background» (docs.expo.dev,
expo-notifications → Custom notification icon and colors): любой цветной пиксель система
превращает в белый квадрат. Без своей иконки Android ставит серый кружок по умолчанию.
На iOS иконка пуша не настраивается вовсе — там всегда иконка приложения.

Геометрия взята из src/components/Emblem.tsx (тот же рисунок, что на рубашке карты дня
и на шаге 1 онбординга), viewBox 100×100 → 96 px:
  - внешнее кольцо r=33 (у Emblem есть ещё пунктирное r=41 — в 96 px оно превращается
    в кашу из точек, поэтому не рисуем);
  - звезда по тому же пути, что в Emblem (четыре длинных луча и четыре коротких плеча
    между ними — вершины пути чередуют радиусы 23/77 и 43/57);
  - центральный кружок r=7 — вырезан «дыркой» (прозрачным), иначе звезда в мелком размере
    читается сплошным пятном.
Рендер идёт в 4× и уменьшается LANCZOS: у PIL нет сглаживания на тонких линиях,
без даунскейла края кольца рвутся.

Скрипт идемпотентен, запускается из корня репозитория без аргументов:
    python scripts/gen_notification_icon.py

После записи файл ПЕРЕЧИТЫВАЕТСЯ и проверяется (см. verify): 96×96 RGBA, каждый непрозрачный
пиксель белый, доля непрозрачных в коридоре 8–40 %. Не сошлось — файл остаётся, но код 1
и текст ошибки: неверную иконку лучше увидеть здесь, чем на сборке, где её вообще не видно
до установки на телефон. Форму этой самопроверки держит контракт-тест
src/lib/__tests__/notificationIcon.test.ts (он проверяет размер и формат, но не декодирует
пиксели — unfilter PNG в jest без зависимостей не окупается).
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

# консоль Windows по умолчанию cp1251 и падает на символах вне неё (первым поймали '×'
# в строке «96x96»). Родня правила про PowerShell и UTF-8 из AGENTS.md: оболочка портит вывод
# в обе стороны, поэтому поток настраиваем сами, а не подбираем «безопасные» символы
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):  # поток подменён или уже настроен
        pass

OUT = Path("assets/images/notification-icon.png")
SIZE = 96
SCALE = 4  # рендерим в 384 px и уменьшаем — иначе кольцо рвётся
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)

# путь звезды из Emblem.tsx, координаты в системе viewBox 100×100
STAR = [
    (50, 23), (57, 43), (77, 50), (57, 57),
    (50, 77), (43, 57), (23, 50), (43, 43),
]
RING_R = 33.0      # Circle r=33 из Emblem
RING_W = 5.5       # толщина кольца в единицах viewBox (у Emblem strokeWidth 0.9 — в 96 px не видно)
HOLE_R = 7.0       # Circle r=7 — центр вырезаем, чтобы звезда не слиплась в пятно

# доля непрозрачных пикселей: ниже — иконка почти пустая (силуэт не читается),
# выше — залитое пятно вместо рисунка. Коридор снят с этого же рисунка (факт 25.7 %)
FILL_MIN, FILL_MAX = 0.08, 0.40


def draw_icon() -> Image.Image:
    """Белый силуэт на прозрачном фоне в размере SIZE×SIZE."""
    big = SIZE * SCALE
    k = big / 100.0  # единица viewBox → пиксели большого холста
    im = Image.new("RGBA", (big, big), CLEAR)
    d = ImageDraw.Draw(im)

    def box(cx: float, cy: float, r: float) -> list[float]:
        return [(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k]

    # кольцо: окружность контуром нужной толщины
    d.ellipse(box(50, 50, RING_R), outline=WHITE, width=max(1, round(RING_W * k)))
    # звезда сплошной заливкой
    d.polygon([(x * k, y * k) for x, y in STAR], fill=WHITE)
    # центральная «дырка» — рисуем прозрачным поверх звезды
    d.ellipse(box(50, 50, HOLE_R), fill=CLEAR)

    return im.resize((SIZE, SIZE), Image.LANCZOS)


def verify(path: Path) -> list[str]:
    """Перечитать записанный файл и проверить требования Android. Возвращает список ошибок."""
    errors: list[str] = []
    with Image.open(path) as im:
        rgba = im.convert("RGBA")
        if rgba.size != (SIZE, SIZE):
            errors.append(f"размер {rgba.size}, ожидается ({SIZE}, {SIZE})")
        raw = rgba.tobytes()  # не getdata(): он устарел в Pillow 14
    px = [tuple(raw[i : i + 4]) for i in range(0, len(raw), 4)]

    opaque = [p for p in px if p[3] > 0]
    if not opaque:
        errors.append("непрозрачных пикселей нет вовсе — иконка пустая")
        return errors

    # «all-white»: непрозрачный пиксель обязан быть белым. Замер 23.08 на этом рисунке:
    # 2366 непрозрачных, из них 1734 полупрозрачных края LANCZOS — и у ВСЕХ RGB ровно
    # (255,255,255), отличается только альфа, поэтому правило их не задевает. Проверка не
    # тривиальна: мутация «рисовать золотом #caa45a» даёт 2352 небелых пикселя и роняет прогон
    colored = [p for p in opaque if not (p[0] == p[1] == p[2] == 255)]
    if colored:
        errors.append(f"непрозрачных небелых пикселей: {len(colored)} (первый {colored[0]})")

    fill = len(opaque) / len(px)
    if not (FILL_MIN <= fill <= FILL_MAX):
        errors.append(f"доля непрозрачных {fill:.1%} вне коридора {FILL_MIN:.0%}–{FILL_MAX:.0%}")
    return errors


def main() -> int:
    if not Path("app.json").exists():
        print("Запускать из корня репозитория (рядом с app.json)", file=sys.stderr)
        return 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    draw_icon().save(OUT, "PNG")

    errors = verify(OUT)
    if errors:
        print(f"[FAIL] {OUT}:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1

    with Image.open(OUT) as im:
        raw = im.convert("RGBA").tobytes()
    opaque = sum(1 for i in range(3, len(raw), 4) if raw[i] > 0)
    print(f"[OK] {OUT} — {SIZE}×{SIZE} RGBA, непрозрачных {opaque / (SIZE * SIZE):.1%}, только белый")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
