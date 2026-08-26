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
# бюджет строки подписи при кеглях frame.html (72 / 34 px на холсте 1080): измерено в задаче 4
# рендером frame.html в браузере — ширина зоны под текст 936 px (1080 − 72*2 паддинга #canvas),
# делённая на худшее по плотности пикселей-на-символ среди 28 реальных подписей captions.json
# (заголовок «Карта дня» ru/today — 37 px/симв, подпись «Интервальные повторения» ru/trainer —
# 20.3 px/симв); округлено вниз, поэтому это гарантированный, а не оптимистичный потолок
TITLE_MAX, SUB_MAX = 25, 46


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


# ── feature ─────────────────────────────────────────────────────────────────────────────

def strip_feature_alpha() -> int:
    """Баннеры из Playwright — RGBA; Play требует 24-bit PNG без альфы. Перезаписать в RGB."""
    files = sorted(FEATURE_DIR.glob("*.png"))
    if not files:
        return fail(f"нет баннеров в {FEATURE_DIR} — сначала node scripts/shoot_63.js")
    for f in files:
        with Image.open(f) as im:
            im.convert("RGB").save(f, "PNG")
    errors = verify_feature()
    if errors:
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return fail("баннеры")
    print(f"[OK] баннеры без альфы: {', '.join(f.name for f in files)}")
    return 0


def verify_feature() -> list[str]:
    errors: list[str] = []
    for lang in LANGS:
        f = FEATURE_DIR / f"{lang}.png"
        if not f.exists():
            errors.append(f"нет баннера {f}")
            continue
        with Image.open(f) as im:
            if im.size != FEATURE:
                errors.append(f"{f.name}: размер {im.size}, ожидается {FEATURE}")
            if im.mode != "RGB":
                errors.append(f"{f.name}: режим {im.mode}, ожидается RGB (24-bit без альфы)")
    return errors


# ── verify ──────────────────────────────────────────────────────────────────────────────

def verify_shots(root: Path, size: tuple[int, int], lo: int, hi: int) -> list[str]:
    errors: list[str] = []
    for lang in LANGS:
        d = root / lang
        files = sorted(d.glob("*.jpg")) if d.exists() else []
        if not lo <= len(files) <= hi:
            errors.append(f"{root.name}/{lang}: кадров {len(files)}, допустимо {lo}–{hi}")
        for f in files:
            with Image.open(f) as im:
                if im.format != "JPEG":
                    errors.append(f"{f}: формат {im.format}, ожидается JPEG")
                if im.size != size:
                    errors.append(f"{f}: размер {im.size}, ожидается {size}")
                if im.mode != "RGB":
                    errors.append(f"{f}: режим {im.mode}, ожидается RGB")
            if f.stat().st_size > 8 * 1024 * 1024:
                errors.append(f"{f}: больше 8 МБ")
    return errors


def verify_captions() -> list[str]:
    errors: list[str] = []
    if not CAPTIONS.exists():
        return [f"нет {CAPTIONS}"]
    try:
        data = json.loads(CAPTIONS.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return [f"{CAPTIONS}: битый JSON ({e})"]
    for lang in LANGS:
        if lang not in data.get("tagline", {}):
            errors.append(f"tagline: нет языка {lang}")
    for sid, by_lang in data.get("screens", {}).items():
        for lang in LANGS:
            pair = by_lang.get(lang)
            if not (isinstance(pair, list) and len(pair) == 2):
                errors.append(f"{sid}: нет подписи для {lang}")
                continue
            if len(pair[0]) > TITLE_MAX or len(pair[1]) > SUB_MAX:
                errors.append(f"{sid}/{lang}: подпись длиннее бюджета {TITLE_MAX}/{SUB_MAX}")
    return errors


def verify_all() -> int:
    errors = verify_icon() + verify_feature() + verify_captions()
    errors += verify_shots(GOOGLE_DIR, GOOGLE_SHOT, SHOTS_MIN, SHOTS_MAX)
    if APPLE_DIR.exists():
        errors += verify_shots(APPLE_DIR, APPLE_SHOT, 1, 10)
    if errors:
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return fail(f"находок: {len(errors)}")
    n = sum(len(list((GOOGLE_DIR / l).glob("*.jpg"))) for l in LANGS)
    print(f"[OK] витрина: иконка, {len(LANGS)} баннера, {n} кадров Google, подписи полны")
    return 0


def main(argv: list[str]) -> int:
    if not Path("app.json").exists():
        print("Запускать из корня репозитория (рядом с app.json)", file=sys.stderr)
        return 1
    cmd = argv[1] if len(argv) > 1 else ""
    if cmd == "icon":
        return make_icon()
    if cmd == "feature":
        return strip_feature_alpha()
    if cmd == "verify":
        return verify_all()
    print(__doc__)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
