#!/usr/bin/env python3
"""Материалы витрины Google Play (спека 63): иконка 512, баннеры, проверка всего набора.

    python scripts/store_assets.py icon      — docs/store/icon-512.png из assets/images/icon.png
    python scripts/store_assets.py feature   — снять альфу с docs/store/feature/<lang>.png (24-bit)
    python scripts/store_assets.py verify    — проверить иконку, баннеры, скриншоты, captions.json

Требования магазина (сверено 26.08 со справкой Play Console): иконка 512×512, 32-bit PNG, ≤ 1024 KB,
полный квадрат без скругления и тени (Play сам режет углы радиусом 30 % и кладёт тень), прозрачность
не рекомендована; баннер 1024×500 JPEG или 24-bit PNG БЕЗ альфы; скриншоты телефона 2–8 штук,
JPEG/24-bit PNG, длинная сторона ≤ 2× короткой, для подборок ≥ 4 кадра 1080×1920.

Приём спеки 55: генератор ПЕРЕЧИТЫВАЕТ записанный файл и падает с кодом 1, если требование
нарушено, — увидеть материал до загрузки в консоль негде, кроме как здесь. Jest-контракт
src/lib/__tests__/storeAssets.test.ts держит форматы и размеры по заголовкам файлов (без Pillow);
пиксели (альфа, полнота) проверяет только этот скрипт.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

# консоль Windows в cp1251 роняет print на «×» (урок 55) — потоки настраиваем сами
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

STORE = Path("docs/store")
ICON_SRC = Path("assets/images/icon.png")
ICON = STORE / "icon-512.png"
FEATURE_DIR = STORE / "feature"
GOOGLE_DIR = STORE / "google"
APPLE_DIR = STORE / "apple"
CAPTIONS = STORE / "captions.json"
LANGS = ("ru", "en", "es", "pt")
ICON_SIZE = 512
ICON_MAX_BYTES = 1024 * 1024
FEATURE = (1024, 500)
GOOGLE_SHOT = (1080, 1920)
APPLE_SHOT = (1290, 2796)
SHOTS_MIN, SHOTS_MAX = 2, 8
# бюджет строки подписи при кеглях frame.html (72 / 34 px на холсте 1080) — калибровка в задаче 4
TITLE_MAX, SUB_MAX = 26, 48


def fail(msg: str) -> int:
    print(f"[FAIL] {msg}", file=sys.stderr)
    return 1


# ── icon ────────────────────────────────────────────────────────────────────────────────

def make_icon() -> int:
    if not ICON_SRC.exists():
        return fail(f"нет исходника {ICON_SRC}")
    with Image.open(ICON_SRC) as src:
        if src.size[0] != src.size[1]:
            return fail(f"исходник не квадратный: {src.size}")
        if src.mode not in ("RGB", "RGBA"):
            return fail(f"исходник в режиме {src.mode}, ожидается RGB/RGBA")
        if src.mode == "RGBA" and src.getchannel("A").getextrema()[0] < 255:
            return fail("в исходнике есть прозрачность — Play покажет под ней свой фон")
        small = src.convert("RGB").resize((ICON_SIZE, ICON_SIZE), Image.LANCZOS).convert("RGBA")
    ICON.parent.mkdir(parents=True, exist_ok=True)
    small.save(ICON, "PNG")
    errors = verify_icon()
    if errors:
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return fail(str(ICON))
    print(f"[OK] {ICON} — {ICON_SIZE}×{ICON_SIZE} RGBA, непрозрачных 100 %, {ICON.stat().st_size // 1024} KB")
    return 0


def verify_icon() -> list[str]:
    """Перечитать записанную иконку: размер, 32-bit, полная непрозрачность, вес."""
    errors: list[str] = []
    if not ICON.exists():
        return [f"нет файла {ICON}"]
    if ICON.stat().st_size > ICON_MAX_BYTES:
        errors.append(f"вес {ICON.stat().st_size} байт > {ICON_MAX_BYTES}")
    with Image.open(ICON) as im:
        if im.size != (ICON_SIZE, ICON_SIZE):
            errors.append(f"размер {im.size}, ожидается ({ICON_SIZE}, {ICON_SIZE})")
        if im.mode != "RGBA":
            errors.append(f"режим {im.mode}, ожидается RGBA (32-bit PNG по требованию Play)")
        else:
            lo, _hi = im.getchannel("A").getextrema()
            if lo < 255:
                errors.append(f"есть прозрачные пиксели (минимальная альфа {lo}) — Play покажет под ними свой фон")
    return errors


def main(argv: list[str]) -> int:
    if not Path("app.json").exists():
        print("Запускать из корня репозитория (рядом с app.json)", file=sys.stderr)
        return 1
    cmd = argv[1] if len(argv) > 1 else ""
    if cmd == "icon":
        return make_icon()
    print(__doc__)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
