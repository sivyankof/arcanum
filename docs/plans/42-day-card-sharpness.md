# План 42 · Карта дня: резкость после переворота + золочёные уголки (задача 40)

> **Для исполнителя (Opus 5):** выполнять по задачам через superpowers:subagent-driven-development
> (рекомендуется) или superpowers:executing-plans. Чекбоксы `- [ ]` — трекинг шагов.
> Сабагентам ВСЕГДА указывать модель явно: реализация по готовому коду задач 1–5 — `sonnet`;
> ревью между задачами, веб-проверка (задача 6) и финальное ревью ветки — Opus.

**Цель:** карта дня чёткая сразу после переворота и при холодном старте (снят осиротевший 3D-слой
лица), все 78 исходников карт заменены на сканы Commons 900 px (растяжения ×2.2 больше нет),
на обеих гранях карты дня — золочёные уголки по макету, ярлычок «увеличить» вложен в уголок.

**Архитектура:** (А1) в `app/(tabs)/index.tsx` — shared value `settledSV`, воркл `frontStyle` после
переворота перезаписывает 3D-пропы нейтральными (приём `SpreadCard.tsx`); (А2) новый скрипт
`scripts/fetch_card_scans.py` качает 78 сканов Wikimedia Commons, кадрирует по чёрной рамке рисунка,
уменьшает до 900 px и пишет `assets/cards/<id>.jpg` на прежние имена — код приложения картинок
не меняется; страж — контракт-тест `cardAssets.test.ts`; (Б) новый `CardCorners` ставится в
`CardBack` (проп `corners`) и на лицо карты дня, `CornerBadge` там уезжает на инсет 9/9.

**Стек:** Expo SDK 54 (НЕ обновлять), react-native-reanimated (воркл), react-native-svg (уголки),
expo-image, Python 3 + Pillow (скрипт конвейера; Pillow 12 уже стоит), jest-expo. Новых пакетов НЕТ,
`package.json`/`app.json` не трогаются.

**Спека:** `docs/specs/42-day-card-sharpness.md` — «Решения» и «Что делаем» читать перед работой.

## Глобальные ограничения

- Ветка `feat/42-day-card-sharpness` от `main`; merge только после лайв-проверки Артёма.
- После КАЖДОГО шага с правкой кода — `npx tsc --noEmit` чист. `npm test` зелёный перед каждым
  коммитом (на старте ветки: 840 тестов в 30 сьютах; после задачи 3 — 840 + 79).
- Комментарии в коде и сообщения коммитов — русские, без упоминаний ИИ и без трейлеров.
- Цвета ТОЛЬКО из `useTheme()`; хардкод запрещён. Значения из спеки (20×20, инсет 4, обводка 1.1,
  инсет ярлычка 9, ширина 900, поле 1.2 %, q78) — буквально.
- `pointerEvents` — только внутри стиля (правило спеки 07).
- Уголки — РОВНО в двух местах (рубашка и лицо карты дня); `CardLightbox`, `EmptyState`, герой,
  сетка, расклады — без уголков (design-system §5).
- Файлы ассетов: те же имена `assets/cards/<id>.jpg`; `src/lib/cardImages.ts`,
  `scripts/gen_card_images.py`, поле `image` в `content/cards.json` НЕ меняются.
- Персист не трогается (version остаётся 9).
- Скрипт скачивает с Commons ТОЛЬКО с явным `User-Agent` (иначе 403), последовательно, с паузой.

---

### Задача 0: ветка и `.gitignore`

**Файлы:** Modify `.gitignore`.

- [x] **Шаг 1: ветка** (сделано 18.08 в сессии планирования)

```bash
git checkout main && git pull
git checkout -b feat/42-day-card-sharpness
```

- [x] **Шаг 2: `.gitignore` — кэш оригиналов сканов** (сделано 18.08)

В конец `.gitignore` (после блока про Python-кэш):

```
# кэш оригиналов сканов Commons (scripts/fetch_card_scans.py, спека 42) — 70 МБ, в репо не нужны
.cache/
```

- [x] **Шаг 3: коммит** (сделано 18.08)

```bash
git add .gitignore docs/specs/42-day-card-sharpness.md docs/plans/42-day-card-sharpness.md
git commit -m "docs: спека и план задачи 42 (резкость карты дня + уголки, задача 40)"
```

---

### Задача 1: снять осиротевший 3D-слой лица карты дня (часть А1)

**Файлы:** Modify `app/(tabs)/index.tsx` (объявление shared values ~строка 222, эффект сброса
~232, `frontStyle` ~271, `onDraw` ~309).

**Интерфейсы:** ничего наружу; внутри экрана — `settledSV: SharedValue<boolean>`.

Юнит-теста нет и быть не может: свойство наложено на нативное представление UI-потоком, веб и jest
этот класс не воспроизводят (спека 36). Проверка — `tsc`, веб (ничего не сломалось), устройство
(задача 6).

- [ ] **Шаг 1: объявить `settledSV` рядом с `flip`**

Найти:

```ts
  const flip = useSharedValue(drawn ? 1 : 0);
  const bob = useSharedValue(0);
```

Заменить на:

```ts
  const flip = useSharedValue(drawn ? 1 : 0);
  // доехал ли переворот (спека 42, приём SpreadCard): после него воркл frontStyle снимает с лица
  // 3D-пропы тем же каналом, которым их наложил. Стартуем «доехавшими», если карта уже открыта:
  // flip=1 без этого держал бы лицо в 3D-контексте с первого кадра — то же мыло, только без
  // анимации перед ним. Убрать стиль недостаточно — reanimated накладывает свойства императивно
  // со стороны UI-потока, и не переданный стиль их не отменяет (лайв-проверка задачи 36)
  const settledSV = useSharedValue(!!drawn);
  const bob = useSharedValue(0);
```

- [ ] **Шаг 2: эффект сброса — гасить и `settledSV`**

Найти:

```ts
  React.useEffect(() => {
    if (!drawn) {
      flip.value = 0;
      plateIn.value = 0;
      meanIn.value = 0;
    }
  }, [drawn, flip, plateIn, meanIn]);
```

Заменить на:

```ts
  React.useEffect(() => {
    if (!drawn) {
      flip.value = 0;
      settledSV.value = false; // рубашка снова впереди, лицу вернуть 3D-переворот
      plateIn.value = 0;
      meanIn.value = 0;
    }
  }, [drawn, flip, settledSV, plateIn, meanIn]);
```

- [ ] **Шаг 3: `frontStyle` — нейтральные пропы после переворота**

Найти:

```ts
  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value },
      { perspective: 1100 },
      { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` },
    ],
    backfaceVisibility: 'hidden' as const,
  }));
```

Заменить на:

```ts
  // Стиль отдаётся ВСЕГДА (и до, и после переворота): после settled воркл ЯВНО возвращает
  // нейтральные 3D-пропы вместо того, чтобы пропасть из массива стилей, — иначе perspective/rotateY
  // остаются сиротами на слое, лицо живёт в 3D-контексте и рисуется через offscreen-текстуру (мыло).
  // Покачивание остаётся: 2D-сдвиг 3D-контекст не создаёт. Скачка нет: на flip=1 rotateY стоит
  // на 360°, что визуально identity
  const frontStyle = useAnimatedStyle(() => {
    if (settledSV.value) {
      return { transform: [{ translateY: bob.value }], backfaceVisibility: 'visible' as const };
    }
    return {
      transform: [
        { translateY: bob.value },
        { perspective: 1100 },
        { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` },
      ],
      backfaceVisibility: 'hidden' as const,
    };
  });
```

- [ ] **Шаг 4: `onDraw` — сброс перед анимацией и подъём в колбэке**

Найти:

```ts
    hapticReveal();
    flip.value = withTiming(1, { duration: FLIP_MS, easing: Easing.out(Easing.cubic) });
```

Заменить на:

```ts
    hapticReveal();
    settledSV.value = false;
    flip.value = withTiming(1, { duration: FLIP_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) settledSV.value = true; // UI-поток: воркл frontStyle тут же снимает 3D-пропы
    });
```

- [ ] **Шаг 5: `npx tsc --noEmit`** — чист.

- [ ] **Шаг 6: веб-прогон на регресс** — `npx expo start --web` (порт 8081 или свой `--port 8082`,
  если занят): DEV-сброс карты в настройках → «Сегодня» → тап → переворот 850 мс, блик, салют,
  покачивание после переворота, повторный тап открывает лайтбокс; DEV-сброс → рубашка снова
  впереди → переворот заново. Консоль без новых ошибок.

- [ ] **Шаг 7: коммит**

```bash
git add "app/(tabs)/index.tsx"
git commit -m "fix: карта дня — снять 3D-пропы лица после переворота, чтобы слой не мылил (spec 42)"
```

---

### Задача 2: контракт-тест исходников карт (красный до замены)

**Файлы:** Create `src/lib/__tests__/cardAssets.test.ts`.

**Интерфейсы:** читает `assets/cards/<id>.jpg` для каждой карты из `cards` (`src/lib/content.ts`).

- [ ] **Шаг 1: написать тест**

```ts
/** Контракт исходников карт (спека 42): все 78 файлов assets/cards/<id>.jpg — JPEG шириной ровно
 *  900 px и пропорцией 1.68–1.76 (кадр по чёрной рамке рисунка). Ловит откат конвейера к мелким
 *  сканам и странный кадр отдельной карты. Парсер SOF-заголовка — без библиотек: размер лежит
 *  в первом SOF-маркере (C0–CF, кроме C4/C8/CC): [len 2][precision 1][height 2][width 2].
 *  Тест писался ДО замены ассетов и был красным на 73 картах шириной 300 (проверка честности). */
import fs from 'fs';
import path from 'path';
import { cards } from '../content';

const DIR = path.join(__dirname, '../../../assets/cards');
const WIDTH = 900;
const ASPECT: [number, number] = [1.68, 1.76];

function jpegSize(buf: Buffer): { w: number; h: number } {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('не JPEG (нет SOI)');
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) throw new Error(`битый маркер на смещении ${i}`);
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i += 1; // байт-заполнитель между маркерами
      continue;
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error('SOF-маркер не найден');
}

describe('контракт исходников карт (assets/cards)', () => {
  it('всего 78 карт', () => {
    expect(cards).toHaveLength(78);
  });

  it.each(cards.map((c) => [c.id] as const))('%s: JPEG шириной 900, пропорция 1.68–1.76', (id) => {
    const file = path.join(DIR, `${id}.jpg`);
    expect(fs.existsSync(file)).toBe(true);
    const { w, h } = jpegSize(fs.readFileSync(file));
    expect(w).toBe(WIDTH);
    const aspect = h / w;
    expect(aspect).toBeGreaterThanOrEqual(ASPECT[0]);
    expect(aspect).toBeLessThanOrEqual(ASPECT[1]);
  });
});
```

- [ ] **Шаг 2: прогнать — обязан быть КРАСНЫМ**

Run: `npx jest src/lib/__tests__/cardAssets.test.ts`
Ожидание: 73 падения на `expect(w).toBe(900)` (получено 300) — плюс 5 крупных карт (fool 746,
hermit 598, high-priestess 440, magician 596, sun 750) тоже падают. Зелёных — только «всего 78 карт».
Число упавших записать в отчёт спеки (правило hf-02: цифра «сколько упало» — вместе с редакцией).

- [ ] **Шаг 3: коммит теста отдельно (красный — намеренно, ассеты приедут в задаче 3)**

```bash
git add src/lib/__tests__/cardAssets.test.ts
git commit -m "test: контракт исходников карт — 900 px и пропорция кадра (spec 42, красный до замены)"
```

---

### Задача 3: скрипт `fetch_card_scans.py` и замена 78 ассетов (часть А2)

**Файлы:** Create `scripts/fetch_card_scans.py`; Modify (бинарно) `assets/cards/*.jpg` (78 файлов);
Create `docs/screenshots/42/contact-sheet.jpg`.

**Интерфейсы:** консольный скрипт; читает `content/cards.json` (id и порядок), пишет
`assets/cards/<id>.jpg`, кэш `.cache/rws-commons/<id>.jpg`.

- [ ] **Шаг 1: написать скрипт**

```python
#!/usr/bin/env python3
"""
Заменяет исходники 78 карт в assets/cards/ на сканы Wikimedia Commons (public domain), спека 42.

Зачем: прежние сканы 300 px на карте дня (218 pt, 3x = 654 px) растягивались в 2.2 раза и мылили.
Сканы Commons ~1100×1920 — физические карты с кремовым полем и скруглёнными углами; скрипт находит
чёрную рамку рисунка, кадрирует с тонким полем, уменьшает до 900 px и пишет JPEG на прежние имена
(cardImages.ts, gen_card_images.py и поле image в cards.json не меняются).

Запуск из корня репозитория:
    python scripts/fetch_card_scans.py                 # все 78 карт
    python scripts/fetch_card_scans.py --only fool,c01 # только эти
    python scripts/fetch_card_scans.py --dry-run       # найти рамки, напечатать отчёт, ничего не писать

Оригиналы кэшируются в .cache/rws-commons/ (в .gitignore, ~70 МБ), повторный запуск не скачивает.
Commons отдаёт 403 на дефолтный User-Agent Python — заголовок задан явно; качаем последовательно
с паузой. Отчёт печатается таблицей; контакт-лист 78 миниатюр — docs/screenshots/42/contact-sheet.jpg,
по нему кадр проверяется глазами разом. Карта, у которой рамка не нашлась там, где ей положено
(1.5–9 % от края), или кадр вышел не той пропорции (1.68–1.76), помечается FAIL, файл не пишется,
код возврата 1 — странный скан не должен уехать в ассеты молча.
Страж на стороне тестов: src/lib/__tests__/cardAssets.test.ts (ширина ровно 900).
"""
import argparse
import json
import sys
import time
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
PAUSE_S = 0.3

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
FRAME_MIN, FRAME_MAX = 0.015, 0.09  # где рамке положено лежать (доля от размера скана)
MARGIN = 0.012            # поле вокруг рамки, доля ширины скана
ASPECT = (1.68, 1.76)     # допустимая пропорция кадра h/w (ожидаемо ~1.72 = CARD_H/CARD_W)


def commons_title(card_id):
    if card_id in MAJORS:
        return MAJORS[card_id]
    suit, num = card_id[0], card_id[1:]
    return f"{SUITS[suit]}{int(num):02d}"


def _get(url, timeout):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def original_url(title):
    q = urllib.parse.urlencode({
        "action": "query", "prop": "imageinfo", "iiprop": "url", "format": "json",
        "titles": f"File:{title}.jpg",
    })
    data = json.loads(_get(f"{API}?{q}", 60))
    page = next(iter(data["query"]["pages"].values()))
    if "imageinfo" not in page:
        raise RuntimeError(f"на Commons нет файла File:{title}.jpg")
    return page["imageinfo"][0]["url"]


def download(card_id, title):
    CACHE.mkdir(parents=True, exist_ok=True)
    dst = CACHE / f"{card_id}.jpg"
    if dst.exists() and dst.stat().st_size > 0:
        return dst
    dst.write_bytes(_get(original_url(title), 120))
    time.sleep(PAUSE_S)
    return dst


def axis_means(gray, axis):
    """Средняя яркость каждого столбца (axis='x') или строки ('y') по центральной полосе.
    Считает Pillow (BOX-уменьшение до 1 px), а не цикл по пикселям — быстрее в сотни раз."""
    w, h = gray.size
    if axis == "x":
        band = gray.crop((0, int(h * BAND[0]), w, int(h * BAND[1])))
        return list(band.resize((w, 1), Image.BOX).getdata())
    band = gray.crop((int(w * BAND[0]), 0, int(w * BAND[1]), h))
    return list(band.resize((1, h), Image.BOX).getdata())


def find_frame(im):
    """(l, t, r, b) чёрной рамки рисунка или None, если рамка не там, где ей положено."""
    gray = im.convert("L")
    w, h = gray.size
    cols, rows = axis_means(gray, "x"), axis_means(gray, "y")

    def first(vals):
        return next((i for i, v in enumerate(vals) if v < DARK), None)

    def last(vals):
        return next((i for i in range(len(vals) - 1, -1, -1) if vals[i] < DARK), None)

    l, r, t, b = first(cols), last(cols), first(rows), last(rows)
    if None in (l, r, t, b):
        return None
    for pos, size in ((l, w), (w - 1 - r, w), (t, h), (h - 1 - b, h)):
        if not (FRAME_MIN * size <= pos <= FRAME_MAX * size):
            return None
    return l, t, r, b


def make_asset(im, frame, width):
    """Кадр = рамка + поле MARGIN; уменьшение LANCZOS до width. Возвращает (картинка|None, пропорция, кадр)."""
    w, h = im.size
    l, t, r, b = frame
    m = round(w * MARGIN)
    crop = im.crop((max(0, l - m), max(0, t - m), min(w, r + 1 + m), min(h, b + 1 + m)))
    cw, ch = crop.size
    aspect = ch / cw
    if not (ASPECT[0] <= aspect <= ASPECT[1]):
        return None, aspect, crop.size
    return crop.resize((width, round(ch * width / cw)), Image.LANCZOS), aspect, crop.size


def contact_sheet(ids):
    cols, tw = 13, 150
    th = round(tw * 1.72)
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
    ap = argparse.ArgumentParser(description="сканы Commons -> assets/cards/*.jpg (спека 42)")
    ap.add_argument("--only", help="id карт через запятую, например fool,c01")
    ap.add_argument("--width", type=int, default=900)
    ap.add_argument("--quality", type=int, default=78)
    ap.add_argument("--dry-run", action="store_true", help="найти рамки и напечатать отчёт, ничего не писать")
    args = ap.parse_args()

    ids = [c["id"] for c in json.load(open(CARDS, encoding="utf-8"))["cards"]]
    if args.only:
        wanted = [s.strip() for s in args.only.split(",") if s.strip()]
        unknown = [w for w in wanted if w not in ids]
        if unknown:
            sys.exit(f"неизвестные id: {unknown}")
        ids = [i for i in ids if i in wanted]

    failed = []
    total_kb = 0
    print(f"{'id':16} {'источник':11} {'рамка l,t,r,b':22} {'кадр':11} {'проп.':6} {'KB':>5}  статус")
    for cid in ids:
        title = commons_title(cid)
        try:
            src = download(cid, title)
            im = Image.open(src).convert("RGB")
        except Exception as e:  # сеть/файл — тоже FAIL, но остальные карты обработать
            failed.append(cid)
            print(f"{cid:16} FAIL {title}: {e}")
            continue
        frame = find_frame(im)
        if frame is None:
            failed.append(cid)
            print(f"{cid:16} {im.width}x{im.height:<6} {'рамка не найдена':22} {'':11} {'':6} {'':>5}  FAIL")
            continue
        out, aspect, crop_size = make_asset(im, frame, args.width)
        if out is None:
            failed.append(cid)
            print(f"{cid:16} {im.width}x{im.height:<6} {str(frame):22} {crop_size[0]}x{crop_size[1]:<6} {aspect:<6.3f} {'':>5}  FAIL пропорция")
            continue
        kb = 0
        if not args.dry_run:
            OUT_DIR.mkdir(parents=True, exist_ok=True)
            out.save(OUT_DIR / f"{cid}.jpg", "JPEG", quality=args.quality, optimize=True, progressive=True)
            kb = (OUT_DIR / f"{cid}.jpg").stat().st_size // 1024
            total_kb += kb
        print(f"{cid:16} {im.width}x{im.height:<6} {str(frame):22} {crop_size[0]}x{crop_size[1]:<6} {aspect:<6.3f} {kb:>5}  {'dry' if args.dry_run else 'ok'}")

    print(f"\nкарт: {len(ids)}, ошибок: {len(failed)}, записано: {total_kb / 1024:.1f} MB")
    if failed:
        print("FAIL:", ", ".join(failed))
    if not args.dry_run and not failed and not args.only:
        contact_sheet(ids)
        print(f"контакт-лист: {SHEET.relative_to(ROOT)}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
```

- [ ] **Шаг 2: сухой прогон (и кадр «до»)**

Перед боевым прогоном снять для отчёта кадр «до» — фрагмент открытой карты дня в вебе крупно
(dpr 2), чтобы в отчёте была пара до/после на одном и том же кадре.

Run: `python scripts/fetch_card_scans.py --dry-run` (первый запуск качает 78 оригиналов, ~70 МБ,
несколько минут). Ожидание: 78 строк со статусом `dry`, `ошибок: 0`, рамки в пределах 3–7 %,
пропорции 1.70–1.74. Если у какой-то карты FAIL — НЕ подгонять пороги вслепую: открыть оригинал
из `.cache/rws-commons/<id>.jpg`, посмотреть, что там (скан с другим полем? тёмный фон?), и решить
точечно; сообщить об этом в отчёте спеки.

- [ ] **Шаг 3: боевой прогон**

Run: `python scripts/fetch_card_scans.py`
Ожидание: 78 × `ok`, `записано: 25–29 MB`, контакт-лист `docs/screenshots/42/contact-sheet.jpg`.
Затем: `du -sh assets/cards` — ≤ 30 МБ.

- [ ] **Шаг 4: контакт-лист глазами**

Открыть `docs/screenshots/42/contact-sheet.jpg` (Read или браузер): у всех 78 — рисунок целиком,
тонкое кремовое поле, ни одного среза по рисунку, ни одного широкого поля/скруглённого угла
скана. Сомнительную карту перекадровать точечно (`--only <id>` после правки порога/поля ТОЛЬКО
если причина понятна) — и снова смотреть.

- [ ] **Шаг 5: тест зелёный**

Run: `npx jest src/lib/__tests__/cardAssets.test.ts` → 79 passed. Затем `npm test` — все сьюты
зелёные (840 + 79 = 919 тестов в 31 сьюте; число записать в отчёт).

- [ ] **Шаг 6: веб-прогон резкости**

`npx expo start --web`: «Сегодня» с открытой картой, страница карты, сетка, лайтбокс — картинки
на месте, пропорции не поплыли (contentFit cover, кадр 1.72), кремовое поле не шире тонкой
полоски под бордером `frame`. Кадр «после» — тот же фрагмент карты дня, что в шаге 2.

- [ ] **Шаг 7: коммит (большой бинарный — так и задумано)**

```bash
git add scripts/fetch_card_scans.py assets/cards docs/screenshots/42/contact-sheet.jpg
git commit -m "feat: исходники 78 карт со сканов Wikimedia Commons, 900 px, кадр по рамке рисунка (spec 42)"
```

---

### Задача 4: золочёные уголки (часть Б, задача 40)

**Файлы:** Create `src/components/CardCorners.tsx`; Modify `src/components/CardBack.tsx`,
`app/(tabs)/index.tsx` (константы ~строка 55, рубашка и лицо ~408–433, стили ~554),
`docs/design-reference.html` (CSS после `.st2.ico svg{…}`, ~строка 191).

**Интерфейсы:**
- Produces: `CardCorners(): JSX` — без пропов, цвет из темы; `CardBack({ hint?, corners? })`.
- Consumes: `CornerBadge({ icon, style })` (существует), `useTheme().accent`.

- [ ] **Шаг 1: компонент `CardCorners`**

`src/components/CardCorners.tsx`:

```tsx
/** Золочёные уголки карты дня — `.cnr` эталона (design-system §5): четыре дужки 20×20 с инсетом 4,
 *  обводка 1.1 цветом accent, точка r=1 — один рисунок, повёрнутый на 0/90/180/270°.
 *  Место применения РОВНО одно — обе грани карты дня (рубашка через проп `CardBack.corners`,
 *  лицо в app/(tabs)/index.tsx); нигде больше — уголки остаются особенными, потому что редкие
 *  (решение 10.08; задача 40 закрыла расхождение с макетом 18.08). */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';

const SIZE = 20; // .cnr width/height
const INSET = 4; // .cnr.tl top/left
const STROKE = 1.1; // .cnr svg stroke-width

// один и тот же рисунок по часовой: tl 0°, tr 90°, br 180°, bl 270° (.cnr.tl/.tr/.br/.bl эталона)
const CORNERS = [
  { key: 'tl', place: { top: INSET, left: INSET }, rotate: '0deg' },
  { key: 'tr', place: { top: INSET, right: INSET }, rotate: '90deg' },
  { key: 'br', place: { bottom: INSET, right: INSET }, rotate: '180deg' },
  { key: 'bl', place: { bottom: INSET, left: INSET }, rotate: '270deg' },
] as const;

export function CardCorners() {
  const t = useTheme();
  return (
    <View style={st.layer}>
      {CORNERS.map((c) => (
        <View key={c.key} style={[st.corner, c.place, { transform: [{ rotate: c.rotate }] }]}>
          {/* width/height явно: на вебе react-native-svg без них рисует в дефолтный вьюпорт (урок CardBackSurface) */}
          <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24">
            <Path d="M2 14 V6 a4 4 0 0 1 4-4 h8" stroke={t.accent} strokeWidth={STROKE} fill="none" />
            <Circle cx={2} cy={17} r={1} fill={t.accent} />
          </Svg>
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  // свойство внутри стиля, а не пропом (правило спеки 07)
  layer: { ...StyleSheet.absoluteFillObject, pointerEvents: 'none' },
  corner: { position: 'absolute', width: SIZE, height: SIZE },
});
```

- [ ] **Шаг 2: `CardBack` — проп `corners`**

В `src/components/CardBack.tsx` добавить импорт `import { CardCorners } from './CardCorners';`
(по алфавиту, после `CardBackSurface`) и заменить сигнатуру и начало разметки:

Найти:

```tsx
export function CardBack({ hint }: { hint?: string }) {
  const t = useTheme();

  return (
    <>
      <CardBackSurface />

      <View style={[st.inframe, { borderColor: t.frame }]} />
```

Заменить на:

```tsx
export function CardBack({ hint, corners = false }: { hint?: string; corners?: boolean }) {
  const t = useTheme();

  return (
    <>
      <CardBackSurface />

      <View style={[st.inframe, { borderColor: t.frame }]} />

      {/* золочёные уголки — только у карты дня (проп); рубашка в лайтбоксе (полёт и с героя
          страницы карты) и EmptyState их не получают — design-system §5 «нигде больше» */}
      {corners && <CardCorners />}
```

Дополнить шапку файла одной строкой: «Уголки `.cnr` — по пропу `corners`, включает только карта дня (спека 42/40)».

- [ ] **Шаг 3: экран «Сегодня» — уголки на обеих гранях, ярлычок 9/9**

В `app/(tabs)/index.tsx`:

(а) импорт — после строки `import { CardBack } …` добавить
`import { CardCorners } from '../../src/components/CardCorners';`

(б) константа — после `const STREAK_MILESTONE = 7; …` добавить:

```ts
// ярлычок «увеличить» на лице карты дня стоит ВНУТРИ правого верхнего уголка (задача 40): инсет 9
// вместо 6/6 остальных мест — уголок 20×20 с инсетом 4 «держит» его с двух сторон
const BADGE_INSET_IN_CORNER = 9;
```

(в) рубашка — найти `<CardBack hint={drawn ? undefined : tr('today.tapToReveal')} />`,
заменить на `<CardBack corners hint={drawn ? undefined : tr('today.tapToReveal')} />`.

(г) лицо — найти:

```tsx
                  {/* ярлычок «можно увеличить» (спека 39) — поверх блика, чтобы скрим
                      не «зажигался». Условие по drawn не нужно: до переворота грань
                      повёрнута на 180° с backfaceVisibility hidden и не видна */}
                  <CornerBadge icon="expand-outline" />
```

Заменить на:

```tsx
                  {/* уголки — поверх картинки и блика, под ярлычком (порядок слоёв .cnr → .st2 эталона) */}
                  <CardCorners />
                  {/* ярлычок «можно увеличить» (спека 39) — поверх блика, чтобы скрим
                      не «зажигался». Условие по drawn не нужно: до переворота грань
                      повёрнута на 180° с backfaceVisibility hidden и не видна.
                      Инсет 9/9 — внутри уголка (задача 40) */}
                  <CornerBadge icon="expand-outline" style={st.badgeInCorner} />
```

(д) стиль — в `st` после `faceClip: {…},` добавить:

```ts
  badgeInCorner: { top: BADGE_INSET_IN_CORNER, right: BADGE_INSET_IN_CORNER },
```

- [ ] **Шаг 4: макет — ярлычок внутрь уголка**

В `docs/design-reference.html` после правила `.st2.ico svg{…display:block}` (около строки 191)
добавить строку:

```css
.face.front .st2{top:9px;right:9px} /* задача 40: на лице карты дня ярлычок внутри уголка */
```

- [ ] **Шаг 5: `npx tsc --noEmit`** — чист.

- [ ] **Шаг 6: веб-прогон** — обе темы: рубашка с четырьмя уголками поверх внутренней рамки
(эмблема не задета), после переворота лицо с уголками, ярлычок в правом верхнем уголке (замер:
`getBoundingClientRect` ярлычка — правый край карты минус 9, верх карты плюс 9); тап по лицу
(и по ярлычку) открывает лайтбокс; в лайтбоксе рубашка в полёте БЕЗ уголков; страница карты
(герой) и сетка — без уголков, ярлычок героя остался 6/6. Консоль без новых предупреждений
(`props.pointerEvents is deprecated` — известный чужой из react-navigation, спека 39).

- [ ] **Шаг 7: коммит**

```bash
git add src/components/CardCorners.tsx src/components/CardBack.tsx "app/(tabs)/index.tsx" docs/design-reference.html
git commit -m "feat: золочёные уголки на обеих гранях карты дня, ярлычок внутри уголка (spec 42, задача 40)"
```

---

### Задача 5: документы

**Файлы:** Modify `docs/design-system.md` (§5, ~строки 75–76 и ~237–245), `docs/product-spec.md`
(§1 «Сегодня», абзац «Поведение карты»), `docs/master-plan.md` (часть 2 таблица ~строка 50; этап 2
пункт «Изображения карт в высоком разрешении» ~173–178), `docs/motion-spec.md` («Изображения»,
~106–108), `AGENTS.md` (Команды → контент-конвейер), `docs/backlog.md` (новая запись 43).

- [ ] **Шаг 1: design-system §5**

После абзаца «**Золочёные уголки — ТОЛЬКО на карте дня** …(решение 10.08).» добавить:

```
Реализация — `CardCorners` (20×20, инсет 4, обводка 1.1 accent, точка r=1; повороты 0/90/180/270),
на рубашке — через проп `CardBack.corners`, на лице — рядом с ярлычком (задача 40, 18.08).
На лице карты дня иконочный `CornerBadge` стоит на инсете **9/9** — внутри правого верхнего
уголка; это ЕДИНСТВЕННОЕ место с инсетом не 6/6.
```

В абзаце про `CornerBadge` заменить «инсет 6/6,» на «инсет 6/6 (на лице карты дня — 9/9, внутри
золочёного уголка, задача 40),».

- [ ] **Шаг 2: product-spec §1**

В конец абзаца «**Поведение карты.** …» добавить предложение:
«Обе грани несут четыре золочёных уголка (`.cnr` макета, design-system §5); ярлычок «можно
увеличить» на лице стоит внутри правого верхнего уголка ✅(40, 18.08).»

- [ ] **Шаг 3: master-plan**

Строка таблицы части 2 «**Изображения 78 карт**»: текст «✅ уже скачаны (300×518; позже заменим на
сканы высокого разрешения с Wikimedia Commons)» → «✅ сканы Wikimedia Commons ~1100 px, в бандле
900 px JPEG после кадрирования по рамке рисунка (задача 42, 18.08; до того — 300×518)».

Пункт этапа 2 «**Изображения карт в высоком разрешении.** …» целиком → «✅ (задача 42, 18.08)
**Изображения карт в высоком разрешении** — все 78 заменены на сканы Commons, кадрированы и
уменьшены до 900 px (`scripts/fetch_card_scans.py`); один размер вместо thumb/full: `expo-image`
декодирует под размер вью сам (`allowDownscaling`).»

- [ ] **Шаг 4: motion-spec «Изображения»**

Пункт «⏳ Заменить сканы карт …» → «✅ (задача 42, 18.08) Сканы карт заменены на Wikimedia Commons
(~1100 px, public domain) → один размер 900 px: карта дня 218 pt @3x = 654 px, лайтбокс при 1x —
растяжение ≤ 1.3; отдельного thumb не нужно — expo-image декодирует под размер вью.»

- [ ] **Шаг 5: AGENTS.md — команда конвейера**

После строки про `check_edits.py` добавить:

```
  - `python scripts/fetch_card_scans.py [--only id,…] [--dry-run]` — заменяет исходники 78 карт на сканы Wikimedia Commons (спека 42): качает оригиналы в `.cache/rws-commons/` (в .gitignore), находит чёрную рамку рисунка по яркости, кадрирует с полем 1.2 %, уменьшает до 900 px, пишет JPEG q78 в `assets/cards/` на прежние имена (код картинок не меняется); печатает отчёт и контакт-лист `docs/screenshots/42/contact-sheet.jpg`; карта с ненайденной рамкой — FAIL, файл не пишется, код 1. Страж — контракт-тест `cardAssets.test.ts` (ширина ровно 900, пропорция 1.68–1.76).
```

И в строке «`npm test` — юнит-тесты (jest-expo). На 17.08: 840 тестов в 30 сьютах» — обновить
число и дату по факту после задачи 3.

- [ ] **Шаг 6: backlog — побочная находка (не чиним здесь)**

Над записью `- [ ] **42 · …**` добавить:

```
- [ ] **43 · Импорт бэкапа с сегодняшней картой дня оставляет на «Сегодня» рубашку** — заведено
      18.08 при спеке 42. `flip` карты дня поднимается только в `onDraw`; эффект по `drawn`
      обрабатывает лишь сброс (`!drawn`). Импортируй бэкап, в котором есть запись за СЕГОДНЯ,
      при смонтированном табе «Сегодня» — `drawn` станет истинным, но лицо не повернётся: на
      экране рубашка, а тап по ней открывает лайтбокс (ветка `if (drawn)`). Проявляется только
      при импорте того же дня; до перезапуска приложения. Починка — эффект «drawn стал истинным
      без анимации → flip/plate/mean/settled = 1» с защитой от гонки с onDraw (там flip анимируется
      с 0 и эффект не должен его перебить).
```

- [ ] **Шаг 7: коммит**

```bash
git add docs/design-system.md docs/product-spec.md docs/master-plan.md docs/motion-spec.md AGENTS.md docs/backlog.md
git commit -m "docs: уголки карты дня и исходники 900 px в design-system, product-spec, master-plan, motion-spec; задача 43 в бэклог"
```

---

### Задача 6: веб-проверка 6а/6б → отчёт → лайв-проверка → merge

**Файлы:** Create `docs/screenshots/42/*.png`; Modify `docs/specs/42-day-card-sharpness.md`
(раздел «Отчёт»), затем после лайв-проверки — `docs/backlog.md` ([x] 42 и 40), `CLAUDE.md` (Статус).

- [ ] **Шаг 1: скриншоты 390×844 (обе темы)** — через Playwright MCP (`browser_resize(390, 844)`,
подтверждать `window.innerWidth === 390`) или headless-CLI
`npx playwright screenshot --viewport-size="390,844" --load-storage=seed.json --wait-for-timeout=9000 http://localhost:8081/ out.png`.
Кадры: `today-back-dark.png`, `today-back-light.png` (рубашка с уголками — DEV-сброс карты перед
кадром), `today-front-dark.png`, `today-front-light.png` (лицо с уголками и ярлычком 9/9),
`today-front-zoom.png` (фрагмент карты дня крупно, dpr 2 — резкость исходника), `mockup-today.png`
(макет после правки CSS). Сверка по `docs/ui-verification.md`.

- [ ] **Шаг 2: 6б прокликивание** — по списку спеки («Проверка → 6б») + контакт-лист просмотрен.

- [ ] **Шаг 3: отчёт в спеку** — раздел «## Отчёт (дата)»: число упавших тестов на старых ассетах
(редакция: 79 тестов сьюта), таблица прогона скрипта (карт/ошибок/МБ, `du -sh assets/cards`),
итог `npm test` (число тестов/сьютов), список кадров, найденные расхождения и их причины,
уроки (что нового узнали). Коммит `docs: отчёт веб-проверки задачи 42`.

- [ ] **Шаг 4: push и лайв-проверка Артёма** — `git push -u origin feat/42-day-card-sharpness`;
попросить проверить по списку 6в спеки (главное: последняя перевёрнутая карта чёткая БЕЗ
перерендера; холодный старт с открытой картой; уголки в обеих темах; лайтбокс с карты дня).
На устройстве Артёму нужен перезапуск `npx expo start` (ассеты сменились; пакеты — нет,
`npm install` не нужен).

- [ ] **Шаг 5: после ✓** — `docs/backlog.md`: 42 и 40 → `[x]` с датой и ссылкой на спеку;
`CLAUDE.md` «Статус»: абзац по задаче (что сделано, уроки, число тестов); merge в main
(`git checkout main && git merge --no-ff feat/42-day-card-sharpness`), `git push`.

---

## Самопроверка плана (сделана при написании)

- **Покрытие спеки:** А1 → задача 1 (все четыре правки: объявление, сброс, воркл, onDraw);
  А2 → задачи 2–3 (тест красный → скрипт → замена → зелёный, контакт-лист, du); Б → задача 4
  (компонент, проп CardBack, лицо, инсет 9, макет); доки → задача 5 (все семь файлов из спеки,
  включая запись 43); проверка/отчёт/merge → задача 6.
- **Плейсхолдеров нет:** каждый шаг с кодом несёт код целиком; текстовые правки доков — дословно.
- **Согласованность имён:** `settledSV` (задача 1), `CardCorners`/`corners`/`BADGE_INSET_IN_CORNER`/
  `st.badgeInCorner` (задача 4), `fetch_card_scans.py`/`.cache/rws-commons/`/`contact-sheet.jpg`
  (задачи 0, 3, 5), `cardAssets.test.ts` (задачи 2, 3, 5) — одинаковы во всех упоминаниях.
- **Порядок:** тест (2) идёт ДО скрипта (3) намеренно — красный прогон и есть проверка теста
  на честность; задача 1 не зависит от 2–5 и может идти первой или последней.
