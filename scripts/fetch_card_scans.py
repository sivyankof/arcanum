#!/usr/bin/env python3
"""
Заменяет исходники 78 карт в assets/cards/ на сканы Wikimedia Commons (public domain), спека 42.

Зачем: прежние сканы 300 px на карте дня (218 pt, 3x = 654 px) растягивались в 2.2 раза и мылили.
Сканы Commons ~1100x1920 — фотографии физических карт с кремовым полем и скруглёнными углами;
скрипт находит чёрную рамку рисунка, кадрирует с тонким полем, доводит кадр до пропорции
приложения и уменьшает до 900 px, записывая JPEG на прежние имена (cardImages.ts,
gen_card_images.py и поле image в cards.json не меняются).

Запуск из корня репозитория:
    python scripts/fetch_card_scans.py                 # все 78 карт
    python scripts/fetch_card_scans.py --only fool,c01 # только эти
    python scripts/fetch_card_scans.py --dry-run       # найти рамки, напечатать отчёт, ничего не писать

Три вещи, которые стоит знать про этот скрипт:

1. Оригиналы кэшируются в .cache/rws-commons/ (в .gitignore, ~70 МБ), повторный запуск не качает
   заново. Commons отдаёт 403 на дефолтный User-Agent Python и 429 при частых запросах (18.08 так
   и вышло: с паузой 0.3 с доехали 11 карт из 78, дальше Retry-After 600). Поэтому запросы идут
   последовательно с паузой, а ожидание дольше MAX_WAIT_S считается лимитом, а не сбоем: прогон
   останавливается с понятным сообщением, кэш остаётся, следующий запуск докачивает недостающее.

2. Проходов ТРИ, и порядок принципиален: (а) докачать в кэш ВСЁ; (б) проверить рамку у ВСЕХ карт;
   (в) только если ошибок ноль — писать assets/. Иначе обрыв сети или сбой детекта одной карты
   оставил бы колоду вразнобой: часть карт 900 px, часть 300 px.

3. ⚠️ Проверить кадр АВТОМАТИЧЕСКИ до конца нельзя. Пропорция кадра доводится до 1.72 расширением
   недостающей стороны, поэтому она сходится почти всегда — даже если рамка найдена неверно, и как
   страж пропорция кадра бесполезна. Стражи здесь: положение рамки (FRAME_MIN/MAX), пропорция САМОЙ
   рамки (FRAME_ASPECT) и симметрия полей (MARGIN_RATIO_MAX) — все три откалиброваны по 65 реальным
   сканам. Узкое место остаётся: последний судья кадра — контакт-лист
   docs/screenshots/42/contact-sheet.jpg, который смотрят глазами.

Страж на стороне тестов: src/lib/__tests__/cardAssets.test.ts (ширина ровно 900).
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CARDS = ROOT / "content" / "cards.json"
OUT_DIR = ROOT / "assets" / "cards"
CACHE = ROOT / ".cache" / "rws-commons"
SHEET = ROOT / "docs" / "screenshots" / "42" / "contact-sheet.jpg"

API = "https://commons.wikimedia.org/w/api.php"
UA = "arcanum-card-scans/1.0 (tarot learning app, asset pipeline)"
PAUSE_S = 1.2
RETRY_CODES = (429, 503)
RETRY_ATTEMPTS = 5
# ⚠️ поймав перебор, Commons отвечает Retry-After 600 — ждать столько внутри прогона бессмысленно
# (18.08: так и случилось дважды). Дольше этого не ждём: прогон останавливается с понятным
# сообщением, кэш остаётся, повторный запуск докачивает только недостающее
MAX_WAIT_S = 90

# имена файлов на Commons (без "File:" и ".jpg"): старшие — таблица, младшие — <Suit><NN>
MAJORS = {
    "fool": "RWS Tarot 00 Fool",
    "magician": "RWS Tarot 01 Magician",
    "high-priestess": "RWS Tarot 02 High Priestess",
    "empress": "RWS Tarot 03 Empress",
    "emperor": "RWS Tarot 04 Emperor",
    "hierophant": "RWS Tarot 05 Hierophant",
    "lovers": "RWS Tarot 06 Lovers",
    "chariot": "RWS Tarot 07 Chariot",
    "strength": "RWS Tarot 08 Strength",
    "hermit": "RWS Tarot 09 Hermit",
    "wheel-of-fortune": "RWS Tarot 10 Wheel of Fortune",
    "justice": "RWS Tarot 11 Justice",
    "hanged-man": "RWS Tarot 12 Hanged Man",
    "death": "RWS Tarot 13 Death",
    "temperance": "RWS Tarot 14 Temperance",
    "devil": "RWS Tarot 15 Devil",
    "tower": "RWS Tarot 16 Tower",
    "star": "RWS Tarot 17 Star",
    "moon": "RWS Tarot 18 Moon",
    "sun": "RWS Tarot 19 Sun",
    "judgement": "RWS Tarot 20 Judgement",
    "world": "RWS Tarot 21 World",
}
SUITS = {"c": "Cups", "w": "Wands", "s": "Swords", "p": "Pents"}

DARK = 110                # средняя яркость ниже — это чёрная рамка рисунка
BAND = (0.3, 0.7)         # центральная полоса, по которой усредняем столбцы/строки
# ⚠️ рамку ищем по СЕРИИ тёмных пикселей, а не по первому тёмному: у части сканов (Колесница,
# Отшельник, Маг, Тройка и Четвёрка Жезлов) по краю фотографии идёт тёмная линия в 1-4 px,
# и «первый тёмный столбец» цеплялся за неё — рамка не находилась вовсе. Настоящая рамка рисунка
# на скане ~1100 px имеет толщину 7-16 px, шум — 1-4 px, поэтому порог 5 разделяет их с запасом
# в обе стороны (замер 18.08 по 31 скану, подтверждён на 65)
MIN_RUN = 5               # минимальная толщина серии, которую считаем рамкой, px
# где рамке положено лежать (доля от размера скана). Нижняя граница мягкая: сканы кадрированы
# по-разному, у Туза Мечей рамка идёт в 1.0 % от верхнего края — и это настоящая рамка (серия
# 13 px), а не шум. От шума защищает MIN_RUN, а не этот порог
FRAME_MIN, FRAME_MAX = 0.005, 0.09
# пропорция САМОЙ рамки — страж правильности детекта. Пропорцию КАДРА проверять бессмысленно:
# её доводит до TARGET_ASPECT make_asset, то есть она сойдётся, даже если рамка найдена неверно.
# Замер по 65 скачанным сканам: 1.716-1.797, коридор взят с запасом
FRAME_ASPECT = (1.60, 1.85)
# симметрия полей: у настоящего скана поля с противоположных сторон отличаются не в разы.
# Замер по 65 сканам: по горизонтали максимум 2.35 (w10: 26 и 61 px), по вертикали 6.00
# (s01: 20 и 120 px — скан обрезан вплотную сверху). Пороги взяты выше замеров с запасом;
# горизонтальный ловит главный сценарий ложного детекта — тёмный артефакт вдоль бокового края
MARGIN_RATIO_MAX = (3.5, 8.0)
MARGIN = 0.012            # поле вокруг рамки, доля ширины скана
# приложение рисует карту ровно в этой пропорции (CARD_H = CARD_W * 1.72). Кадр доводится
# до неё РАСШИРЕНИЕМ недостающей стороны: тогда contentFit:'cover' не срезает ни пикселя.
# Без этого высокие кадры (замер: до 1.777) теряли сверху и снизу 1.6 % высоты — то есть
# всё поле и край самой рамки рисунка
TARGET_ASPECT = 1.72
ASPECT = (1.68, 1.76)     # коридор пропорции кадра ПОСЛЕ доводки: ловит только тот случай,
#                           когда расширение упёрлось в край скана и до 1.72 не дотянуло


def commons_title(card_id):
    if card_id in MAJORS:
        return MAJORS[card_id]
    suit, num = card_id[0], card_id[1:]
    return f"{SUITS[suit]}{int(num):02d}"


def _retry_after(headers, default):
    """Retry-After в секундах. RFC разрешает и HTTP-дату — на неё берём свой интервал,
    иначе прогон падал бы стектрейсом ValueError вместо понятного сообщения."""
    raw = headers.get("Retry-After")
    try:
        return int(raw) if raw else default
    except (TypeError, ValueError):
        return default


def _get(url, timeout):
    """GET с ретраями: Commons при частых запросах отвечает 429, иногда 503. Ждём столько,
    сколько просит Retry-After, иначе 5, 10, 20, 40 с. Молча сдаваться нельзя — карта уедет
    в FAIL, а половина заменённых ассетов хуже, чем ни одного."""
    delay = 5
    for attempt in range(RETRY_ATTEMPTS):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code not in RETRY_CODES or attempt == RETRY_ATTEMPTS - 1:
                raise
            wait = _retry_after(e.headers, delay)
            if wait > MAX_WAIT_S:
                raise RuntimeError(
                    f"Commons просит подождать {wait} с — это лимит на частоту, а не сбой. "
                    f"Прогон остановлен, скачанное осталось в кэше; запусти скрипт снова позже"
                ) from e
            print(f"    {e.code} от Commons, ждём {wait} с (попытка {attempt + 1})", flush=True)
            time.sleep(wait)
            delay = min(delay * 2, MAX_WAIT_S)
    raise RuntimeError("недостижимо")


def _norm(title):
    """Заголовок Commons к виду ключа: без префикса File:, без .jpg, подчёркивания — в пробелы."""
    t = title[len("File:"):] if title.startswith("File:") else title
    if t.endswith(".jpg"):
        t = t[:-len(".jpg")]
    return t.replace("_", " ")


def original_urls(titles):
    """{title: url} пакетами по 50 — API принимает список. Раньше на каждую карту уходило
    два запроса (URL + файл), и это удваивало шанс поймать 429."""
    out = {}
    for i in range(0, len(titles), 50):
        chunk = titles[i:i + 50]
        q = urllib.parse.urlencode({
            "action": "query", "prop": "imageinfo", "iiprop": "url", "format": "json",
            "titles": "|".join(f"File:{t}.jpg" for t in chunk),
        })
        data = json.loads(_get(f"{API}?{q}", 60))
        for page in data.get("query", {}).get("pages", {}).values():
            if "imageinfo" in page:
                out[_norm(page["title"])] = page["imageinfo"][0]["url"]
        time.sleep(PAUSE_S)
    return out


def cached_ok(path):
    """Годен ли файл в кэше. Проверяем не «существует и не пуст», а «открывается как JPEG»:
    оборвись запись посреди файла или отдай CDN страницу лимита с кодом 200 — в кэше остался бы
    огрызок, и каждый следующий прогон печатал бы по нему «cannot identify image file»,
    не подсказывая, что лечится это удалением. Битый файл удаляем сами."""
    if not path.exists() or path.stat().st_size < 10_000:
        return False
    try:
        with Image.open(path) as im:
            im.verify()
        return True
    except Exception:
        path.unlink(missing_ok=True)
        return False


def download(card_id, title, urls):
    CACHE.mkdir(parents=True, exist_ok=True)
    dst = CACHE / f"{card_id}.jpg"
    if cached_ok(dst):
        return dst
    if title not in urls:
        raise RuntimeError(f"на Commons нет файла File:{title}.jpg")
    tmp = dst.with_suffix(".part")
    tmp.write_bytes(_get(urls[title], 120))
    tmp.replace(dst)  # переименование атомарно: в кэше не бывает наполовину записанного файла
    time.sleep(PAUSE_S)
    return dst


def axis_means(gray, axis):
    """Средняя яркость каждого столбца (axis='x') или строки ('y') по центральной полосе.
    Считает Pillow (BOX-уменьшение до 1 px), а не цикл по пикселям — быстрее в сотни раз."""
    w, h = gray.size
    # tobytes, а не getdata(): у режима "L" это ровно один байт на пиксель, а getdata()
    # объявлен устаревшим в Pillow 12 и исчезнет в 14
    if axis == "x":
        band = gray.crop((0, int(h * BAND[0]), w, int(h * BAND[1])))
        return list(band.resize((w, 1), Image.BOX).tobytes())
    band = gray.crop((int(w * BAND[0]), 0, int(w * BAND[1]), h))
    return list(band.resize((1, h), Image.BOX).tobytes())


def dark_runs(vals):
    """Серии подряд идущих тёмных значений: [(начало, длина), ...]."""
    out, i = [], 0
    while i < len(vals):
        if vals[i] < DARK:
            j = i
            while j < len(vals) and vals[j] < DARK:
                j += 1
            out.append((i, j - i))
            i = j
        else:
            i += 1
    return out


def find_frame(im):
    """((l, t, r, b), "") чёрной рамки рисунка либо (None, причина отказа)."""
    gray = im.convert("L")
    w, h = gray.size
    cols, rows = axis_means(gray, "x"), axis_means(gray, "y")

    def first(vals):
        runs = [r for r in dark_runs(vals) if r[1] >= MIN_RUN]
        return runs[0][0] if runs else None

    def last(vals):
        runs = [r for r in dark_runs(vals) if r[1] >= MIN_RUN]
        return runs[-1][0] + runs[-1][1] - 1 if runs else None

    l, r, t, b = first(cols), last(cols), first(rows), last(rows)
    if None in (l, r, t, b):
        return None, "тёмной линии нужной толщины нет"

    left, right, top, bot = l, w - 1 - r, t, h - 1 - b
    for pos, size in ((left, w), (right, w), (top, h), (bot, h)):
        if not (FRAME_MIN * size <= pos <= FRAME_MAX * size):
            return None, f"рамка не на месте ({left},{top},{right},{bot} px)"

    frame_aspect = (b - t + 1) / (r - l + 1)
    if not (FRAME_ASPECT[0] <= frame_aspect <= FRAME_ASPECT[1]):
        return None, f"пропорция рамки {frame_aspect:.3f}"

    # ⚠️ главный сценарий ложного детекта: тёмный артефакт вдоль края скана толщиной >= MIN_RUN.
    # Пропорция рамки от такого сдвигается мало (~0.03) и коридор проходит, а пропорция КАДРА
    # ничего не покажет — её доводит make_asset. Ловится тем, что одно поле становится в разы
    # уже противоположного
    h_ratio = max(left, right) / max(1, min(left, right))
    v_ratio = max(top, bot) / max(1, min(top, bot))
    if h_ratio > MARGIN_RATIO_MAX[0] or v_ratio > MARGIN_RATIO_MAX[1]:
        return None, f"поля несимметричны ({left},{top},{right},{bot} px)"

    return (l, t, r, b), ""


def make_asset(im, frame, width):
    """Кадр = рамка + поле MARGIN, доведённый до TARGET_ASPECT и уменьшенный до width.
    Возвращает (картинка|None, пропорция, размер кадра)."""
    w, h = im.size
    l, t, r, b = frame
    m = round(w * MARGIN)
    x0, y0 = max(0, l - m), max(0, t - m)
    x1, y1 = min(w, r + 1 + m), min(h, b + 1 + m)

    # доводка до пропорции приложения: недостающую сторону РАСШИРЯЕМ (срезать нельзя — уйдёт
    # рамка рисунка). Упёрлись в край скана — расширение выйдет односторонним, а если не хватило
    # и этого, пропорция останется за коридором ASPECT и карта уедет в FAIL, что и требуется
    cw, ch = x1 - x0, y1 - y0
    if ch / cw > TARGET_ASPECT:
        add = (ch / TARGET_ASPECT - cw) / 2
        x0, x1 = max(0, x0 - int(add)), min(w, x1 + int(add + 0.999))
    else:
        add = (cw * TARGET_ASPECT - ch) / 2
        y0, y1 = max(0, y0 - int(add)), min(h, y1 + int(add + 0.999))

    crop = im.crop((x0, y0, x1, y1))
    cw, ch = crop.size
    aspect = ch / cw
    if not (ASPECT[0] <= aspect <= ASPECT[1]):
        return None, aspect, crop.size
    return crop.resize((width, round(ch * width / cw)), Image.LANCZOS), aspect, crop.size


def contact_sheet(ids):
    """Контакт-лист миниатюр — последний судья кадра: автоматика не отличает верную рамку
    от правдоподобной, а глаз на листе из 78 карт видит и срез рисунка, и лишнее поле сразу."""
    cols, tw = 13, 150
    th = round(tw * TARGET_ASPECT)
    rows = -(-len(ids) // cols)
    sheet = Image.new("RGB", (cols * tw, rows * th), (12, 15, 34))
    for i, cid in enumerate(ids):
        p = OUT_DIR / f"{cid}.jpg"
        if not p.exists():
            continue
        im = Image.open(p).convert("RGB")
        im.thumbnail((tw, th))
        sheet.paste(im, ((i % cols) * tw + (tw - im.width) // 2, (i // cols) * th + (th - im.height) // 2))
    SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(SHEET, "JPEG", quality=80, optimize=True)


def main():
    global PAUSE_S
    ap = argparse.ArgumentParser(description="сканы Commons -> assets/cards/*.jpg (спека 42)")
    ap.add_argument("--only", help="id карт через запятую, например fool,c01")
    ap.add_argument("--width", type=int, default=900)
    ap.add_argument("--quality", type=int, default=78)
    ap.add_argument("--pause", type=float, default=PAUSE_S,
                    help=f"пауза между сетевыми запросами, с (по умолчанию {PAUSE_S})")
    ap.add_argument("--dry-run", action="store_true", help="найти рамки и напечатать отчёт, ничего не писать")
    args = ap.parse_args()
    PAUSE_S = args.pause

    all_ids = [c["id"] for c in json.load(open(CARDS, encoding="utf-8"))["cards"]]
    ids = all_ids
    if args.only:
        wanted = [s.strip() for s in args.only.split(",") if s.strip()]
        unknown = [w for w in wanted if w not in all_ids]
        if unknown:
            sys.exit(f"неизвестные id: {unknown}")
        ids = [i for i in all_ids if i in wanted]

    # --- проход 1: докачать в кэш ВСЁ, чего не хватает (ассеты пока не трогаем) ---
    need = [c for c in ids if not cached_ok(CACHE / f"{c}.jpg")]
    if need:
        print(f"нет в кэше: {len(need)} карт, спрашиваю адреса на Commons", flush=True)
        urls = original_urls([commons_title(c) for c in need])
        for n, cid in enumerate(need, 1):
            try:
                download(cid, commons_title(cid), urls)
            except Exception as e:
                sys.exit(f"скачивание прервано на {cid} ({n} из {len(need)}): {e}")
            print(f"  скачано {n}/{len(need)}: {cid}", flush=True)

    # --- проход 2: проверить рамку у ВСЕХ карт, ничего не записывая ---
    # порядок принципиален: сбой детекта одной карты не должен оставить колоду наполовину
    # заменённой — сперва проверяем все, пишем только при нуле ошибок
    print(f"{'id':16} {'источник':11} {'рамка l,t,r,b':22} {'кадр':11} {'проп.':6}  статус", flush=True)
    plan, failed = [], []
    for cid in ids:
        try:
            im = Image.open(CACHE / f"{cid}.jpg").convert("RGB")
        except Exception as e:
            failed.append(cid)
            print(f"{cid:16} FAIL: {e} (удали .cache/rws-commons/{cid}.jpg и запусти снова)", flush=True)
            continue
        frame, why = find_frame(im)
        if frame is None:
            failed.append(cid)
            print(f"{cid:16} {im.width}x{im.height:<6} {why:22} {'':11} {'':6}  FAIL", flush=True)
            continue
        out, aspect, crop_size = make_asset(im, frame, args.width)
        if out is None:
            failed.append(cid)
            print(f"{cid:16} {im.width}x{im.height:<6} {str(frame):22} "
                  f"{crop_size[0]}x{crop_size[1]:<6} {aspect:<6.3f}  FAIL пропорция", flush=True)
            continue
        plan.append((cid, out))
        print(f"{cid:16} {im.width}x{im.height:<6} {str(frame):22} "
              f"{crop_size[0]}x{crop_size[1]:<6} {aspect:<6.3f}  ok", flush=True)

    if failed:
        print(f"\nкарт: {len(ids)}, ошибок: {len(failed)} — НИЧЕГО НЕ ЗАПИСАНО")
        print("FAIL:", ", ".join(failed))
        sys.exit(1)

    if args.dry_run:
        print(f"\nкарт: {len(ids)}, ошибок 0; сухой прогон — ассеты не тронуты")
        return

    # --- проход 3: запись ---
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    total_kb = 0
    for cid, out in plan:
        out.save(OUT_DIR / f"{cid}.jpg", "JPEG", quality=args.quality, optimize=True, progressive=True)
        total_kb += (OUT_DIR / f"{cid}.jpg").stat().st_size // 1024
    print(f"\nкарт: {len(ids)}, ошибок 0, записано: {total_kb / 1024:.1f} MB")

    # контакт-лист строим по ВСЕЙ колоде и после любой записи, в том числе после --only:
    # правишь одну карту — смотреть её надо рядом с остальными, а не отдельно
    contact_sheet(all_ids)
    print(f"контакт-лист: {SHEET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
