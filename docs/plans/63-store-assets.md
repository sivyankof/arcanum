# Материалы витрины Google Play (63) — детальный план

> **Для исполнителя:** план идёт задача за задачей, шаги помечены `- [ ]`. Каждая задача
> заканчивается проверкой и коммитом. Спека — `docs/specs/63-store-assets.md`, читать вместе
> с планом. Шаг 0 процесса: `docs/lessons.md` §4 (вёрстка, контраст), §9 (веб-проверка: сид,
> маркеры, `page.clock`, dev-сервер с `--clear`), §12 (процесс, консоль Windows и UTF-8, PowerShell).

**Цель:** иконка 512, четыре баннера 1024×500 и 28 скриншотов (7 кадров × 4 языка) Google Play
делаются из репозитория двумя командами, без телефона, и защищены от протухания контракт-тестом
и самопроверкой генераторов.

**Архитектура:** приложение снимается Playwright как есть (390×844 @3× → 1170×2532 PNG в памяти)
и компонуется на холст магазина HTML-шаблоном `frame.html` (подпись + кадр, шрифты и картинка —
data-URI), результат — JPEG. Баннер — HTML-шаблон `feature.html` → PNG → python снимает альфу.
Иконка — python из `assets/images/icon.png`. Проверка трёхслойная: самопроверка генераторов,
`store_assets.py verify`, jest-контракт по файлам в репозитории.

**Стек:** Playwright из кэша npx (`NODE_PATH`, рецепт `AGENTS.md`), Node без новых пакетов,
Python 3.10+ с Pillow (уже используется `gen_notification_icon.py`), jest-expo.

**Ветка:** `main` (нового кода приложения нет; скрипты, шаблоны, тест, материалы).

## Глобальные ограничения

- `assets/images/*`, `app.json`, `package.json` не трогать; SDK не обновлять.
- Цвета и шрифты баннера/рамки — только значения `docs/design-system.md` §1–2 и `src/theme/theme.ts`
  (тёмная тема): `bg #0a0c1d`, `bgTop #1b2140`, `head #f5eacb`, `muted #848cb2`, `accent #e2bd72`,
  `frame #8f7439`, `line #262e56`; Cormorant Garamond 600 / Manrope 500 из
  `node_modules/@expo-google-fonts/{cormorant-garamond/600SemiBold,manrope/500Medium}/*.ttf`.
- Карты на кадрах — только вне списка наготы: `star`, `sun`, `lovers`, `devil`, `judgement`,
  `world` запрещены (сценарий проверяет id сида списком и падает).
- Веб: dev-сервер заново с `--clear`; сид — форма `scripts/shoot_56.js`; часы браузера пришпилены
  `page.clock.install` к `2026-09-18T10:00:00` (локальное время).
- Комментарии в коде русские; ни слова про ИИ; стейджить поимённо (`git add <путь>`).
- Python: совместимость с 3.10 (без PEP 701), `sys.stdout.reconfigure(encoding="utf-8")` — урок 55.

## Файловая карта

| Файл | Ответственность |
|---|---|
| `src/lib/__tests__/imageHeaders.ts` | **новый** — `jpegSize`, `pngHeader` (вынос из двух тестов) |
| `src/lib/__tests__/cardAssets.test.ts`, `notificationIcon.test.ts` | импортируют парсеры из `imageHeaders.ts` |
| `scripts/store_assets.py` | **новый** — `icon` / `feature` / `verify` |
| `docs/store/captions.json` | **новый** — подписи кадров ×4 языка (единственный источник текста кадров) |
| `docs/store/frame.html` | **новый** — шаблон кадра: `window.compose({...})` |
| `docs/store/feature.html` | **новый** — шаблон баннера: `window.render({...})` |
| `scripts/shoot_63.js` | **новый** — съёмка + компоновка + баннеры |
| `docs/store/icon-512.png`, `docs/store/feature/<lang>.png`, `docs/store/google/<lang>/NN-<id>.jpg` | материалы (коммитятся) |
| `src/lib/__tests__/storeAssets.test.ts` | **новый** — контракт файлов и `captions.json` |
| `.gitignore` | `docs/store/apple/` (до 63б) |
| доки | спека 63 (отчёт), backlog, changelog, CLAUDE.md «Статус», release-checklist, lessons |

---

### Задача 1: общий парсер заголовков картинок `imageHeaders.ts`

**Файлы:**
- Создать: `src/lib/__tests__/imageHeaders.ts`
- Изменить: `src/lib/__tests__/cardAssets.test.ts` (удалить локальный `jpegSize`, импорт),
  `src/lib/__tests__/notificationIcon.test.ts` (удалить локальные `PNG_SIGNATURE`/`pngHeader`, импорт)

**Интерфейсы:**
- Отдаёт: `jpegSize(buf: Buffer): { w: number; h: number }`,
  `pngHeader(buf: Buffer): { w: number; h: number; depth: number; colorType: number }`.
- Потребители: три теста (два существующих + `storeAssets.test.ts` задачи 5).

- [ ] **Шаг 1: создать модуль**

```ts
/** Размеры и формат картинки из заголовка файла — без декодера (для контракт-тестов ассетов).
 *  Вынесено из cardAssets.test.ts (JPEG) и notificationIcon.test.ts (PNG) задачей 63, когда
 *  потребителей стало три (правило DRY). Файл без суффикса `test` — под testMatch jest-expo
 *  (`**​/__tests__/**​/*test.[jt]s?(x)`) не попадает, тестом не считается. */

/** JPEG: размер лежит в первом SOF-маркере (C0–CF, кроме C4/C8/CC):
 *  [len 2][precision 1][height 2][width 2]. */
export function jpegSize(buf: Buffer): { w: number; h: number } {
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

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** PNG: IHDR обязан быть первым чанком: [8 сигнатура][4 длина][4 "IHDR"][4 ширина][4 высота]
 *  [1 глубина][1 тип цвета]. colorType: 2 — RGB (24-bit, без альфы), 6 — RGBA (32-bit). */
export function pngHeader(buf: Buffer): { w: number; h: number; depth: number; colorType: number } {
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('не PNG: сигнатура не совпала');
  if (buf.toString('ascii', 12, 16) !== 'IHDR') throw new Error('первый чанк не IHDR');
  return {
    w: buf.readUInt32BE(16),
    h: buf.readUInt32BE(20),
    depth: buf.readUInt8(24),
    colorType: buf.readUInt8(25),
  };
}
```

- [ ] **Шаг 2: перевести оба теста на импорт**

В `cardAssets.test.ts`: удалить функцию `jpegSize` (строки `function jpegSize … }`), добавить
`import { jpegSize } from './imageHeaders';`; в doc-комментарии фразу «Парсер SOF-заголовка — без
библиотек…» заменить на «Парсер заголовка — общий `imageHeaders.ts`». В `notificationIcon.test.ts`:
удалить `PNG_SIGNATURE` и `pngHeader`, добавить `import { pngHeader } from './imageHeaders';`,
в комментарии над бывшей функцией оставить одну строку «размер и формат — `pngHeader` из
`imageHeaders.ts`».

- [ ] **Шаг 3: проверить**

Run: `npx tsc --noEmit && npx jest src/lib/__tests__/cardAssets.test.ts src/lib/__tests__/notificationIcon.test.ts`
Expected: tsc чист; 79 + 3 теста зелёные, число сьютов не выросло (`imageHeaders.ts` не сьют —
если jest пытается его запустить и падает «Your test suite must contain at least one test»,
имя файла попало под testMatch: переименовать нельзя в `*test*`, проверить, что суффикс не `test`).

- [ ] **Шаг 4: коммит**

```bash
git add src/lib/__tests__/imageHeaders.ts src/lib/__tests__/cardAssets.test.ts src/lib/__tests__/notificationIcon.test.ts
git commit -m "test: общий парсер заголовков JPEG/PNG для контрактов ассетов (spec 63)"
```

---

### Задача 2: иконка 512 — `scripts/store_assets.py icon`

**Файлы:**
- Создать: `scripts/store_assets.py` (подкоманды `feature`/`verify` — задача 5, здесь каркас + `icon`)
- Создаёт: `docs/store/icon-512.png`

**Интерфейсы:**
- Команда `python scripts/store_assets.py icon` (из корня), код 0/1, печать `[OK]`/`[FAIL]`.
- Константы, которые переиспользуют задачи 4–5: `STORE = Path("docs/store")`, `ICON = STORE / "icon-512.png"`,
  `FEATURE_DIR = STORE / "feature"`, `GOOGLE_DIR = STORE / "google"`, `APPLE_DIR = STORE / "apple"`,
  `LANGS = ("ru", "en", "es", "pt")`, `GOOGLE_SHOT = (1080, 1920)`, `APPLE_SHOT = (1290, 2796)`,
  `FEATURE = (1024, 500)`, `ICON_SIZE = 512`.

- [ ] **Шаг 1: написать скрипт (каркас + icon)**

```python
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
```

- [ ] **Шаг 2: запустить и проверить мутацией**

Run: `python scripts/store_assets.py icon`
Expected: `[OK] docs/store/icon-512.png — 512×512 RGBA, непрозрачных 100 %, N KB`; `N ≤ 1024`.

Мутация (временно, в `make_icon` перед `save`): `small.putpixel((0, 0), (0, 0, 0, 0))` →
прогон обязан упасть «есть прозрачные пиксели (минимальная альфа 0)». Вернуть код, прогнать
снова — `[OK]`. Открыть файл глазами (Read) — золотая звезда на синеве, углы не скруглены.

- [ ] **Шаг 3: коммит**

```bash
git add scripts/store_assets.py docs/store/icon-512.png
git commit -m "feat: иконка витрины 512 с самопроверкой генератора (spec 63)"
```

---

### Задача 3: подписи и HTML-шаблоны кадра и баннера

**Файлы:**
- Создать: `docs/store/captions.json`, `docs/store/frame.html`, `docs/store/feature.html`

**Интерфейсы:**
- `captions.json`: `{ "tagline": {lang: string}, "screens": { id: { lang: [title, sub] } } }`,
  порядок ключей `screens` = порядок кадров (1…7) — его читает `shoot_63.js`.
- `frame.html`: `window.compose({ w, h, img, title, sub })` — выставляет размер холста и содержимое;
  возвращает `true`. Шрифты приходят `page.addStyleTag` (data-URI), не из файла.
- `feature.html`: `window.render({ title, tagline, icon })` — `icon` data-URI PNG.

- [ ] **Шаг 1: `docs/store/captions.json`**

Слоган = подзаголовок iOS из `docs/store-listing.md` (не сочинять — копия). Подписи ru/en —
по фактам таблицы «Факты о приложении» того же файла; es/pt — черновик (вычитка носителем —
волна 57н). Порядок `screens` = порядок кадров.

```json
{
  "tagline": {
    "ru": "Курс, значения карт, расклады",
    "en": "Course, card meanings, spreads",
    "es": "Curso, significados y tiradas",
    "pt": "Curso, significados e tiragens"
  },
  "screens": {
    "today": {
      "ru": ["Карта дня", "Каждое утро — новая карта и её значение"],
      "en": ["Card of the day", "A new card and its meaning every morning"],
      "es": ["Carta del día", "Cada mañana, una carta y su significado"],
      "pt": ["Carta do dia", "Toda manhã, uma carta e seu significado"]
    },
    "course": {
      "ru": ["Курс из 32 уроков", "6 модулей, викторины, прогресс"],
      "en": ["A 32-lesson course", "6 modules, quizzes, progress"],
      "es": ["Curso de 32 lecciones", "6 módulos, cuestionarios, progreso"],
      "pt": ["Curso de 32 lições", "6 módulos, quizzes, progresso"]
    },
    "detail": {
      "ru": ["78 карт со значениями", "Общее, любовь, работа, финансы, здоровье"],
      "en": ["All 78 cards explained", "General, love, career, finances, health"],
      "es": ["78 cartas explicadas", "General, amor, trabajo, finanzas, salud"],
      "pt": ["78 cartas explicadas", "Geral, amor, trabalho, finanças, saúde"]
    },
    "spread": {
      "ru": ["Расклады", "Три карты, Кельтский крест и лунные"],
      "en": ["Spreads", "Three cards, Celtic Cross and moon spreads"],
      "es": ["Tiradas", "Tres cartas, Cruz Celta y tiradas lunares"],
      "pt": ["Tiragens", "Três cartas, Cruz Celta e tiragens lunares"]
    },
    "trainer": {
      "ru": ["Тренажёр памяти", "Интервальные повторения"],
      "en": ["Memory trainer", "Spaced repetition"],
      "es": ["Entrenador de memoria", "Repaso espaciado"],
      "pt": ["Treino de memória", "Repetição espaçada"]
    },
    "moon": {
      "ru": ["Лунный календарь", "Новолуния и полнолуния"],
      "en": ["Moon calendar", "New moons and full moons"],
      "es": ["Calendario lunar", "Lunas nuevas y lunas llenas"],
      "pt": ["Calendário lunar", "Luas novas e luas cheias"]
    },
    "today-light": {
      "ru": ["Светлая тема", "И тёмная — на выбор"],
      "en": ["Light theme", "Or dark — your choice"],
      "es": ["Tema claro", "U oscuro, a tu elección"],
      "pt": ["Tema claro", "Ou escuro, você escolhe"]
    }
  }
}
```

- [ ] **Шаг 2: `docs/store/frame.html`**

```html
<!doctype html>
<!-- Шаблон кадра витрины (спека 63): подпись + снимок приложения на холсте магазина.
     Данные подставляет scripts/shoot_63.js через window.compose({w, h, img, title, sub});
     шрифты (Cormorant Garamond 600, Manrope 500) — тем же скриптом как data-URI @font-face:
     file://-страница в Chromium не имеет права грузить file://-шрифт без флага запуска.
     Значения — design-system.md §1–2 (тёмная тема): фон bgTop→bg, head, muted, frame. -->
<html lang="ru"><head><meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; }
  body { background: #0a0c1d; overflow: hidden; }
  #canvas {
    position: relative; width: 1080px; height: 1920px; overflow: hidden;
    background: radial-gradient(120% 70% at 50% 0%, #1b2140 0%, #0a0c1d 70%);
    display: flex; flex-direction: column; align-items: center;
    box-sizing: border-box; padding: 96px 72px 72px;
    font-family: 'Manrope', sans-serif; color: #e2e6f4;
  }
  #title { font-family: 'Cormorant Garamond', serif; font-weight: 600; font-size: 72px; line-height: 1.15;
    color: #f5eacb; text-align: center; margin: 0; }
  #sub { font-size: 34px; line-height: 1.3; letter-spacing: 1px; color: #848cb2; text-align: center; margin: 16px 0 0; }
  #phone { margin-top: 56px; border-radius: 54px; border: 2px solid #8f7439; overflow: hidden;
    box-shadow: 0 42px 72px rgba(226,189,114,0.18); background: #0a0c1d; }
  #phone img { display: block; width: 100%; height: 100%; object-fit: cover; }
</style></head>
<body>
  <div id="canvas">
    <h1 id="title"></h1>
    <p id="sub"></p>
    <div id="phone"><img id="shot" alt=""></div>
  </div>
<script>
  /* Кадр приложения 390×844 (@3× = 1170×2532) вписывается целиком в остаток высоты под подписью;
     ширина считается от высоты, чтобы пропорция 390:844 не искажалась ни на одном холсте. */
  window.compose = function ({ w, h, img, title, sub }) {
    const canvas = document.getElementById('canvas');
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    document.getElementById('title').textContent = title;
    document.getElementById('sub').textContent = sub;
    document.getElementById('shot').src = img;
    const pad = 96 + 72, gap = 56;
    const caption = document.getElementById('title').offsetHeight + document.getElementById('sub').offsetHeight + 16;
    const free = h - pad - caption - gap;
    const ph = Math.floor(free);
    const pw = Math.floor(ph * 390 / 844);
    const phone = document.getElementById('phone');
    phone.style.height = ph + 'px';
    phone.style.width = pw + 'px';
    return true;
  };
</script>
</body></html>
```

- [ ] **Шаг 3: `docs/store/feature.html`**

```html
<!doctype html>
<!-- Баннер витрины Google Play 1024×500 (спека 63). Данные — scripts/shoot_63.js:
     window.render({title, tagline, icon}); шрифты — data-URI через addStyleTag (см. frame.html).
     Безопасная зона: всё значимое в центральных 80 % ширины (Play подрезает края в части раскладок).
     Запрещено: цены, рейтинги, «бесплатно», «новинка», корпус телефона. -->
<html lang="ru"><head><meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; }
  body { background: #0a0c1d; overflow: hidden; }
  #canvas { position: relative; width: 1024px; height: 500px; overflow: hidden;
    background: radial-gradient(90% 120% at 30% 40%, #1b2140 0%, #0a0c1d 75%);
    display: flex; align-items: center; justify-content: center; gap: 56px;
    font-family: 'Manrope', sans-serif; }
  #icon { width: 236px; height: 236px; border-radius: 48px; border: 2px solid #8f7439;
    box-shadow: 0 24px 56px rgba(226,189,114,0.22); display: block; }
  #text { display: flex; flex-direction: column; }
  #title { font-family: 'Cormorant Garamond', serif; font-weight: 600; font-size: 124px; line-height: 1;
    color: #f5eacb; margin: 0; letter-spacing: 2px; }
  #rule { width: 120px; height: 1px; background: #8f7439; margin: 22px 0 18px; }
  #tagline { font-size: 34px; letter-spacing: 1px; color: #848cb2; margin: 0; }
</style></head>
<body>
  <div id="canvas">
    <img id="icon" alt="">
    <div id="text"><h1 id="title"></h1><div id="rule"></div><p id="tagline"></p></div>
  </div>
<script>
  window.render = function ({ title, tagline, icon }) {
    document.getElementById('title').textContent = title;
    document.getElementById('tagline').textContent = tagline;
    document.getElementById('icon').src = icon;
    return true;
  };
</script>
</body></html>
```

- [ ] **Шаг 4: проверка глазами (без скрипта)**

Открыть `file:///…/docs/store/frame.html` в браузере, в консоли:
`compose({w:1080,h:1920,img:'',title:'Карта дня',sub:'Каждое утро — новая карта и её значение'})`
— подпись по центру, рамка телефона под ней шириной ≈ 700 px (шрифты пока системные — это ожидаемо).
Аналогично `feature.html`: `render({title:'Arcanum',tagline:'Курс, значения карт, расклады',icon:''})`.

- [ ] **Шаг 5: коммит**

```bash
git add docs/store/captions.json docs/store/frame.html docs/store/feature.html
git commit -m "docs: подписи и HTML-шаблоны кадров и баннера витрины (spec 63)"
```

---

### Задача 4: `scripts/shoot_63.js` — съёмка, компоновка, баннеры

**Файлы:**
- Создать: `scripts/shoot_63.js`
- Создаёт: `docs/store/google/<lang>/0N-<id>.jpg` ×28, `docs/store/feature/<lang>.png` ×4
  (PNG с альфой — снимает задача 5); при `--store apple` — `docs/store/apple/<lang>/…` (не коммитить)

**Интерфейсы:**
- Команда: `NODE_PATH="…" node scripts/shoot_63.js [--store google|apple] [--lang ru,en] [--only today]`.
- Потребляет: `docs/store/captions.json` (задача 3), шаблоны (задача 3), `content/cards.json`,
  `content/spreads.json`, `content/course.json`, `src/lib/i18n.ts` (маркеры), шрифты из `node_modules`,
  `assets/images/icon.png` (для баннера).

- [ ] **Шаг 1: написать скрипт**

```js
/* Скриншоты и баннеры витрины (спека 63) — снимаются БЕЗ телефона.
   Запуск (dev-сервер поднят ЗАНОВО с --clear, рецепт AGENTS.md):
     NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" \
       node scripts/shoot_63.js [--store google|apple] [--lang ru,en,es,pt] [--only today]

   Как устроено: приложение снимается как есть (390×844 @3× = 1170×2532, PNG в памяти) и кладётся
   с подписью на холст магазина шаблоном docs/store/frame.html → JPEG q92 (у JPEG нет альфы, которую
   запрещают оба магазина). Google — 1080×1920 (9:16: наш 390×844 = 2.16:1 не проходит правило
   «длинная сторона ≤ 2× короткой»), Apple — 1290×2796. Баннер — docs/store/feature.html → PNG,
   альфу снимает scripts/store_assets.py feature.

   ⚠️ Часы браузера пришпилены (page.clock.install): кадры воспроизводимы, дата в шапке и календарь
   не плывут. Сегодняшняя запись дневника считается от ЛОКАЛЬНОЙ даты этих часов: todayDraw() ищет
   localDateISO(), а UTC-срез toISOString() в аудите 56 оставил карту дня закрытой.
   ⚠️ У каждого кадра маркеры (имя карты на языке кадра из cards.json, заголовок из i18n.ts, видимый
   <img> карты): нет маркера — FAIL с именем кадра, пустой кадр в набор не идёт (урок 56).
   ⚠️ Карты на кадрах — только вне списка наготы (правила Play к графике витрины): проверяется списком.
   ⚠️ Шрифты и кадр передаются шаблону data-URI: file://-страница не грузит file://-шрифты без флага.
   ⚠️ Сид — форма scripts/shoot_56.js (урок 54: сид не сочинять). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const STORE = opt('--store', 'google');
const LANGS = opt('--lang', 'ru,en,es,pt').split(',');
const ONLY = opt('--only', '');
const CANVAS = { google: { w: 1080, h: 1920 }, apple: { w: 1290, h: 2796 } }[STORE];
if (!CANVAS) throw new Error(`неизвестный магазин ${STORE}`);

const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost:8081';
const OUT = path.join(ROOT, 'docs/store', STORE);
const FEATURE_OUT = path.join(ROOT, 'docs/store/feature');
const CLOCK = '2026-09-18T10:00:00'; // пятница; новолуние 11.09 позади, полнолуние 26.09 впереди
const TODAY = '2026-09-18';

const captions = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/store/captions.json'), 'utf8'));
// форма файлов — как в src/lib/content.ts: `.cards`, `.spreads`, `.modules`; name/keywords — по языкам
const cards = require('../content/cards.json').cards;
const spreads = require('../content/spreads.json').spreads;
const modules = require('../content/course.json').modules;
const I18N = fs.readFileSync(path.join(ROOT, 'src/lib/i18n.ts'), 'utf8');

const NUDITY = ['star', 'sun', 'lovers', 'devil', 'judgement', 'world'];
const DAY_CARD = 'magician';
const DETAIL_CARD = 'moon';
const SPREAD_CARDS = ['empress', 'chariot', 'strength'];
const DECK = ['fool', 'magician', 'high-priestess', 'empress', 'emperor', 'hierophant', 'chariot'];
const M12 = ['m1l1', 'm1l2', 'm1l3', 'm1l4', 'm2l1', 'm2l2', 'm2l3', 'm2l4', 'm2l5', 'm2l6'];
for (const id of [DAY_CARD, DETAIL_CARD, ...SPREAD_CARDS, ...DECK]) {
  if (NUDITY.includes(id)) throw new Error(`карта ${id} из списка наготы — в витрину нельзя`);
  if (!cards.find((c) => c.id === id)) throw new Error(`карты ${id} нет в колоде`);
}

/** Строка i18n для языка: файл режется на языковые блоки по `  <lang>: {`, внутри блока —
 *  первый `key: "…"` после `      <section>: {`. Маркеры берутся из исходника, не из памяти. */
function i18nText(lang, section, key) {
  const order = ['ru', 'en', 'es', 'pt'];
  const starts = order.map((l) => I18N.search(new RegExp(`^  ${l}: \\{`, 'm')));
  if (starts.some((s) => s < 0)) throw new Error('не нашёл языковые блоки i18n.ts');
  const i = order.indexOf(lang);
  const chunk = I18N.slice(starts[i], i + 1 < order.length ? starts[i + 1] : undefined);
  const sec = chunk.search(new RegExp(`^      ${section}: \\{`, 'm'));
  if (sec < 0) throw new Error(`секции ${section} нет в блоке ${lang}`);
  const m = chunk.slice(sec).match(new RegExp(`\\b${key}: "([^"]+)"`));
  if (!m) throw new Error(`ключа ${section}.${key} нет в блоке ${lang}`);
  return m[1];
}
const cardName = (id, lang) => cards.find((c) => c.id === id).name[lang];
const spreadName = (id, lang) => spreads.find((s) => s.id === id).name[lang];

/** Дневник: сегодня (по пришпиленным часам) — Маг, четыре прошлых дня — серия 5 (форма shoot_56). */
const JOURNAL = ['magician', 'high-priestess', 'empress', 'high-priestess', 'chariot'].map((cardId, i) => ({
  date: `2026-09-${String(18 - i).padStart(2, '0')}`,
  cardId,
  reversed: false,
  ...(i === 1 ? { note: 'Разговор прошёл мягче, чем ждала', outcome: 'yes' } : {}),
}));
const SAVED_SPREAD = { ts: 1758100000000, date: '2026-09-17', spreadId: 'three-card',
  cards: SPREAD_CARDS.map((cardId) => ({ cardId, reversed: false })) };

function seed(lang, extra = {}) {
  return JSON.stringify({
    state: {
      themeMode: 'dark',
      lang,
      installSeed: 12345,
      lastDrawDate: TODAY,
      profile: { onboarded: true, name: 'Артём', birthDate: '1990-05-14', birthArcanaId: 'justice' },
      premium: { active: false, source: 'none', until: null },
      lessonsProgress: Object.fromEntries(M12.map((id) => [id, { done: true, errors: 0, ts: 1755000000000 }])),
      srs: Object.fromEntries(DECK.map((id) => [id, { reps: 2, intervalDays: 3, ease: 2.5, due: '2026-01-01' }])),
      reviewDay: { date: '', newCount: 0, doneCount: 0 },
      history: JOURNAL,
      spreadsHistory: [SAVED_SPREAD],
      xp: 400,
      streak: 5,
      ...extra,
    },
    version: 11,
  });
}

/** Кадры: route, extra сида, prepare (тапы до кадра), check (маркеры; возвращает список проблем). */
const SCREENS = [
  { id: 'today', route: '/',
    check: async (page, lang) => [
      ...(await visible(page, `img[src*="/${DAY_CARD}"]`) ? [] : ['нет лица карты дня (рубашка?)']),
      ...((await text(page)).includes(cardName(DAY_CARD, lang)) ? [] : [`нет имени «${cardName(DAY_CARD, lang)}»`]),
    ] },
  { id: 'course', route: '/course',
    check: async (page, lang) => {
      const t = await text(page);
      const m3 = modules[2].title[lang];
      return t.includes(m3) ? [] : [`нет заголовка модуля 3 «${m3}»`];
    } },
  { id: 'detail', route: `/card/${DETAIL_CARD}`,
    check: async (page, lang) => [
      ...(await visible(page, `img[src*="/${DETAIL_CARD}"]`) ? [] : ['нет скана карты']),
      ...((await text(page)).includes(cardName(DETAIL_CARD, lang)) ? [] : [`нет имени «${cardName(DETAIL_CARD, lang)}»`]),
    ] },
  { id: 'spread', route: `/spread/${SAVED_SPREAD.ts}`,
    check: async (page, lang) => {
      const missing = [];
      for (const id of SPREAD_CARDS) if (!(await visible(page, `img[src*="/${id}"]`))) missing.push(`карта ${id} не открыта`);
      if (!(await text(page)).includes(spreadName('three-card', lang))) missing.push('нет названия расклада');
      return missing;
    } },
  { id: 'trainer', route: '/review',
    prepare: async (page) => {
      // переворачиваем карточку: оборот — значение и четыре оценки
      await page.locator('img[src*="/cards/"]').first().click({ force: true });
      await page.waitForTimeout(1100);
    },
    check: async (page, lang) => {
      const t = await text(page);
      const problems = [];
      if (!t.includes(i18nText(lang, 'review', 'title'))) problems.push('нет заголовка тренажёра');
      // какая карта выпала — узнаём по src видимой картинки, ключевое слово оборота — из cards.json
      const src = await page.evaluate(() => {
        const im = [...document.querySelectorAll('img[src*="/cards/"]')].find((el) => el.offsetParent !== null);
        return im ? im.getAttribute('src') : '';
      });
      const id = DECK.find((d) => src.includes(`/${d}`));
      if (!id) problems.push('не видно карты тренажёра');
      else if (!t.includes(cards.find((c) => c.id === id).keywords[lang][0])) problems.push('оборот карточки не открыт (нет ключевого слова)');
      return problems;
    } },
  { id: 'moon', route: '/moon',
    check: async (page, lang) => {
      const t = await text(page);
      const problems = [];
      if (!t.includes(i18nText(lang, 'moon', 'title'))) problems.push('нет заголовка календаря');
      if (!t.includes(spreadName('full-moon', lang))) problems.push('нет панели расклада полнолуния');
      return problems;
    } },
  { id: 'today-light', route: '/', extra: { themeMode: 'light' },
    check: async (page, lang) => (await visible(page, `img[src*="/${DAY_CARD}"]`)) ? [] : ['нет лица карты дня'] },
];
if (Object.keys(captions.screens).join() !== SCREENS.map((s) => s.id).join()) {
  throw new Error('порядок экранов в captions.json не совпадает со списком SCREENS');
}

const text = (page) => page.locator('body').innerText();
const visible = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const fontFace = (family, weight, file) =>
  `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/ttf;base64,${fs.readFileSync(file).toString('base64')}) format('truetype');}`;
const FONTS = [
  fontFace('Cormorant Garamond', 600, path.join(ROOT, 'node_modules/@expo-google-fonts/cormorant-garamond/600SemiBold/CormorantGaramond_600SemiBold.ttf')),
  fontFace('Manrope', 500, path.join(ROOT, 'node_modules/@expo-google-fonts/manrope/500Medium/Manrope_500Medium.ttf')),
].join('\n');
const fileUrl = (p) => 'file:///' + p.replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const app = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  await app.clock.install({ time: CLOCK });
  const errors = [];
  app.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  const frame = await browser.newPage({ viewport: { width: CANVAS.w, height: CANVAS.h }, deviceScaleFactor: 1 });
  await frame.goto(fileUrl(path.join(ROOT, 'docs/store/frame.html')));
  await frame.addStyleTag({ content: FONTS });
  await frame.evaluate(() => document.fonts.ready);

  const failed = [];
  let shots = 0;
  for (const lang of LANGS) {
    fs.mkdirSync(path.join(OUT, lang), { recursive: true });
    for (const [n, s] of SCREENS.entries()) {
      if (ONLY && s.id !== ONLY) continue;
      const tag = `${lang}/${s.id}`;
      await app.goto(`${BASE}${s.route}`, { waitUntil: 'domcontentloaded' });
      await app.evaluate((v) => localStorage.setItem('arcanum-app', v), seed(lang, s.extra));
      await app.reload({ waitUntil: 'networkidle' });
      await app.waitForTimeout(1800);
      if ((await app.evaluate(() => window.innerWidth)) !== 390) throw new Error('вьюпорт не 390 — кадр недостоверен');
      if (s.prepare) await s.prepare(app);
      const problems = await s.check(app, lang);
      if (problems.length) {
        failed.push(`${tag}: ${problems.join('; ')} (url ${app.url().replace(BASE, '')})`);
        console.log(`  ✗ ${tag}`);
        continue;
      }
      const raw = await app.screenshot({ type: 'png' });
      const [title, sub] = captions.screens[s.id][lang];
      await frame.evaluate((a) => window.compose(a), {
        w: CANVAS.w, h: CANVAS.h, img: `data:image/png;base64,${raw.toString('base64')}`, title, sub,
      });
      await frame.waitForTimeout(150);
      const file = path.join(OUT, lang, `${String(n + 1).padStart(2, '0')}-${s.id}.jpg`);
      await frame.screenshot({ path: file, type: 'jpeg', quality: 92 });
      shots++;
      console.log(`  ✓ ${tag} → ${path.relative(ROOT, file)}`);
    }
  }

  if (!ONLY && STORE === 'google') {
    fs.mkdirSync(FEATURE_OUT, { recursive: true });
    const icon = `data:image/png;base64,${fs.readFileSync(path.join(ROOT, 'assets/images/icon.png')).toString('base64')}`;
    const banner = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
    await banner.goto(fileUrl(path.join(ROOT, 'docs/store/feature.html')));
    await banner.addStyleTag({ content: FONTS });
    await banner.evaluate(() => document.fonts.ready);
    for (const lang of LANGS) {
      await banner.evaluate((a) => window.render(a), { title: 'Arcanum', tagline: captions.tagline[lang], icon });
      await banner.waitForTimeout(150);
      await banner.screenshot({ path: path.join(FEATURE_OUT, `${lang}.png`), type: 'png' });
      console.log(`  ✓ баннер ${lang}`);
    }
  }

  console.log(`\nкадров снято: ${shots}, не снято: ${failed.length}`);
  failed.forEach((f) => console.log(`  ✗ ${f}`));
  if (errors.length) console.log(`ошибок страницы: ${errors.length}\n  ${errors.slice(0, 5).join('\n  ')}`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('СЦЕНАРИЙ УПАЛ:', e.message);
  process.exit(2);
});
```

- [ ] **Шаг 2: прогон на одном языке и калибровка**

Dev-сервер: `npm run kill:dev` → `npx expo start --web --clear`. Run:
`NODE_PATH="…" node scripts/shoot_63.js --lang ru`
Expected: 7 кадров `docs/store/google/ru/01-today.jpg … 07-today-light.jpg`, 4 баннера, «не снято: 0».
Открыть кадры глазами (Read): подпись в одну строку (если перенеслась — уменьшить текст в
`captions.json` или кегль в `frame.html`, а затем записать фактический бюджет `TITLE_MAX`/`SUB_MAX`
в `store_assets.py`); лицо Мага на кадре 1; оборот карточки с оценками на кадре 5; календарь
сентября на кадре 6; шрифты засечные в заголовках (иначе data-URI не сработал — проверить
`document.fonts.check("600 72px 'Cormorant Garamond'")` в `frame`).

Если маркер экрана «курс» не найден: экран мог не докрутиться до модуля 3 — добавить в `prepare`
`await page.getByText(modules[2].title[lang]).first().scrollIntoViewIfNeeded()`; если
`img` карты в тренажёре не кликается — уточнить селектор по фактическому DOM (`expo-image` кладёт
два `<div>` между `<img>` и родителем, урок 43/44).

- [ ] **Шаг 3: мутационная проверка маркеров**

Временно убрать первую запись из `JOURNAL` (сегодняшнюю) → прогон обязан упасть на `ru/today`
«нет лица карты дня» и `ru/today-light`; вернуть. Временно заменить `DETAIL_CARD` на `'star'` →
сценарий обязан упасть на старте «карта star из списка наготы». Вернуть. Числа — в отчёт спеки.

- [ ] **Шаг 4: все языки**

Run: `NODE_PATH="…" node scripts/shoot_63.js` → 28 кадров + 4 баннера, «не снято: 0».
Просмотреть по одному кадру en/es/pt глазами (подписи и тексты приложения на своём языке —
после L-0 языки в вебе не падают на en, урок сессии L-0).

- [ ] **Шаг 5: коммит (баннеры пока с альфой — их закроет задача 5 в том же дне)**

```bash
git add scripts/shoot_63.js docs/store/google
git commit -m "feat: съёмка и компоновка скриншотов витрины на четырёх языках (spec 63)"
```

---

### Задача 5: баннер без альфы, `verify`, контракт-тест

**Файлы:**
- Изменить: `scripts/store_assets.py` (подкоманды `feature`, `verify`)
- Создать: `src/lib/__tests__/storeAssets.test.ts`
- Изменить: `.gitignore` (`docs/store/apple/`)

**Интерфейсы:**
- `python scripts/store_assets.py feature` — перезаписывает `docs/store/feature/<lang>.png` в RGB.
- `python scripts/store_assets.py verify` — код 0/1, печатает каждую находку.
- Тест читает те же пути, что и скрипт (константы дублируются осознанно: разные языки; список
  путей в обоих местах — один и тот же, менять парой).

- [ ] **Шаг 1: тест (пишется ДО `feature` — баннеры сейчас с альфой, проверка colorType 2 краснеет)**

```ts
/** Контракт материалов витрины Google Play (спека 63): файлы в docs/store/ соответствуют требованиям
 *  магазина по заголовкам (размер, формат), подписи кадров есть на всех языках. Пиксели (альфа,
 *  полнота иконки) проверяет генератор scripts/store_assets.py — здесь только то, что дёшево без
 *  декодера. «Баннер стал 1024×512» или «кадр 1080×2340» выясняются тут, а не в консоли Play.
 *  Красный прогон: до `store_assets.py feature` баннеры Playwright несут альфу (colorType 6). */
import fs from 'fs';
import path from 'path';
import { LANGS } from '../lang';
import { jpegSize, pngHeader } from './imageHeaders';

const ROOT = path.join(__dirname, '../../..');
const STORE = path.join(ROOT, 'docs/store');
const GOOGLE = { w: 1080, h: 1920, min: 2, max: 8 };
const APPLE = { w: 1290, h: 2796, min: 1, max: 10 };
const TITLE_MAX = 26; // бюджет строки при кеглях frame.html — тот же, что в store_assets.py
const SUB_MAX = 48;

const captions = JSON.parse(fs.readFileSync(path.join(STORE, 'captions.json'), 'utf8')) as {
  tagline: Record<string, string>;
  screens: Record<string, Record<string, [string, string]>>;
};

describe('иконка витрины 512', () => {
  it('PNG 512×512, 32-bit (RGBA), ≤ 1024 KB', () => {
    const buf = fs.readFileSync(path.join(STORE, 'icon-512.png'));
    expect(pngHeader(buf)).toEqual({ w: 512, h: 512, depth: 8, colorType: 6 });
    expect(buf.length).toBeLessThanOrEqual(1024 * 1024);
  });
});

describe('баннер 1024×500 на каждом языке', () => {
  it.each(LANGS)('%s: PNG 1024×500 без альфы (colorType 2)', (lang) => {
    const buf = fs.readFileSync(path.join(STORE, 'feature', `${lang}.png`));
    expect(pngHeader(buf)).toEqual({ w: 1024, h: 500, depth: 8, colorType: 2 });
  });
});

function checkShots(dir: string, spec: { w: number; h: number; min: number; max: number }) {
  for (const lang of LANGS) {
    const files = fs.readdirSync(path.join(dir, lang)).filter((f) => f.endsWith('.jpg')).sort();
    expect({ lang, ok: files.length >= spec.min && files.length <= spec.max, n: files.length })
      .toEqual({ lang, ok: true, n: files.length });
    for (const f of files) {
      const size = jpegSize(fs.readFileSync(path.join(dir, lang, f)));
      expect({ lang, f, ...size }).toEqual({ lang, f, w: spec.w, h: spec.h });
    }
  }
}

describe('скриншоты телефона', () => {
  it('Google: у каждого языка 2–8 JPEG ровно 1080×1920, набор одинаковый по языкам', () => {
    checkShots(path.join(STORE, 'google'), GOOGLE);
    const sets = LANGS.map((l) => fs.readdirSync(path.join(STORE, 'google', l)).sort().join());
    expect(new Set(sets).size).toBe(1);
  });
  it('Apple (если каталог есть — до 63б не коммитится): 1–10 JPEG 1290×2796', () => {
    const dir = path.join(STORE, 'apple');
    if (!fs.existsSync(dir)) return;
    checkShots(dir, APPLE);
  });
  it('число кадров = число экранов в captions.json', () => {
    const n = fs.readdirSync(path.join(STORE, 'google', 'ru')).filter((f) => f.endsWith('.jpg')).length;
    expect(n).toBe(Object.keys(captions.screens).length);
  });
});

describe('подписи кадров (captions.json)', () => {
  it('слоган баннера есть на каждом языке и совпадает с подзаголовком iOS из store-listing.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'docs/store-listing.md'), 'utf8');
    for (const lang of LANGS) {
      const m = md.match(new RegExp(`### ${lang} · подзаголовок iOS \\(30\\)\\r?\\n([^\\r\\n]+)`));
      expect({ lang, tagline: captions.tagline[lang] }).toEqual({ lang, tagline: m?.[1] });
    }
  });
  it('каждый экран несёт все языки, заголовок ≤ 26 и подстрока ≤ 48 символов', () => {
    for (const [id, byLang] of Object.entries(captions.screens)) {
      for (const lang of LANGS) {
        const pair = byLang[lang];
        expect({ id, lang, has: Array.isArray(pair) && pair.length === 2 }).toEqual({ id, lang, has: true });
        expect({ id, lang, title: [...pair[0]].length <= TITLE_MAX }).toEqual({ id, lang, title: true });
        expect({ id, lang, sub: [...pair[1]].length <= SUB_MAX }).toEqual({ id, lang, sub: true });
      }
    }
  });
});
```

- [ ] **Шаг 2: прогнать — обязан краснеть на баннерах**

Run: `npx jest src/lib/__tests__/storeAssets.test.ts`
Expected: 4 красных «баннер … colorType 2» (Playwright пишет RGBA → 6); остальное зелёное.
Если зелёное всё — проверить, что баннеры вообще существуют и что тест их читает (урок 28а).

- [ ] **Шаг 3: `feature` и `verify` в `store_assets.py`**

Добавить перед `main`:

```python
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
    data = json.loads(CAPTIONS.read_text(encoding="utf-8"))
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
```

В `main` добавить ветки: `if cmd == "feature": return strip_feature_alpha()` и
`if cmd == "verify": return verify_all()`.

- [ ] **Шаг 4: прогнать всё**

Run: `python scripts/store_assets.py feature && python scripts/store_assets.py verify && npx tsc --noEmit && npx jest src/lib/__tests__/storeAssets.test.ts`
Expected: `[OK] баннеры без альфы`, `[OK] витрина …`, tsc чист, тест зелёный целиком.

Мутация: `python -c "from PIL import Image; Image.new('RGB',(1024,512)).save('docs/store/feature/ru.png')"`
→ `verify` падает «размер (1024, 512)», jest падает «ru: PNG 1024×500». Восстановить:
`git checkout docs/store/feature/ru.png` (если баннер уже закоммичен; иначе пересъёмка + `feature`).

- [ ] **Шаг 5: `.gitignore`**

Добавить в конец:

```
# Apple-набор скриншотов витрины (scripts/shoot_63.js --store apple) — до аккаунта Apple (63б) не коммитится
docs/store/apple/
```

- [ ] **Шаг 6: коммит**

```bash
git add scripts/store_assets.py src/lib/__tests__/storeAssets.test.ts docs/store/feature .gitignore
git commit -m "feat: баннеры витрины без альфы, verify и контракт-тест материалов (spec 63)"
```

---

### Задача 6: приёмка Артёмом, загрузка в консоль, синхронизация доков

**Файлы:**
- Изменить: `docs/specs/63-store-assets.md` (критерии → `[x]`, отчёт с числами прогонов и мутаций),
  `docs/backlog.md` (63 → `[x]`), `docs/changelog.md`, `CLAUDE.md` «Статус», `docs/release-checklist.md`
  (пункт «Скриншоты» → `[~]`: Google готов и загружен; iOS 6.7″ — `--store apple` после аккаунта;
  iPad — по решению `supportsTablet`), `docs/lessons.md` (⚠️ ниже), `AGENTS.md` (команды
  `shoot_63.js` и `store_assets.py` в раздел «Команды» — по образцу `gen_notification_icon.py`)

- [ ] **Шаг 1: показать Артёму** 7 кадров `docs/store/google/ru/*.jpg` и `docs/store/feature/ru.png`
      (открыть на ноутбуке; телефон не нужен). Замечания по композиции — править `frame.html`/
      `feature.html`, по текстам — `captions.json`; после правок — полный прогон задачи 4 шаг 4 и
      задачи 5 шаг 4 заново (все 28 кадров пересоздаются, иначе наборы разъедутся).
- [ ] **Шаг 2: загрузка в Play Console (Артём, ~20 мин)**: Store presence → Main store listing →
      Graphics: иконка `docs/store/icon-512.png`; feature graphic `feature/ru.png`; phone screenshots
      `google/ru/01…07`; затем Translations → Add languages (en-US, es-ES или es-419, pt-BR) →
      для каждого языка свой баннер и кадры. Сохранить; ошибок формата быть не должно — если
      консоль отклонила файл, это находка для `verify` (записать требование, добавить проверку).
- [ ] **Шаг 3: доки** — уроки ⚠️ в `docs/lessons.md`: §9 «Сегодняшняя запись сида считается от
      локальной даты пришпиленных часов, не `toISOString()` — аудит 56 снял рубашку вместо лица»;
      §12 «file://-страница в Chromium не грузит file://-шрифты — data-URI через `addStyleTag`»;
      §9 «Соотношение сторон кадра для Google ≤ 2:1 — не резать экран, а компоновать на холст».
      Changelog: что сделано, решения (7 кадров, тёмная + светлый, 4 языка, компоновка, JPEG),
      новое общее (`imageHeaders.ts`, `mockSetup`-подобный приём маркеров), где лежит Apple-ветка.
- [ ] **Шаг 4: коммит и push**

```bash
git add docs/specs/63-store-assets.md docs/backlog.md docs/changelog.md docs/lessons.md docs/release-checklist.md CLAUDE.md AGENTS.md docs/store/icon-512.png docs/store/feature docs/store/google
git commit -m "feat: материалы витрины Google Play — иконка, баннеры, скриншоты на четырёх языках (spec 63)"
git push
```

## Самопроверка плана по спеке

- Иконка 512 + самопроверка — задача 2 ✓. Баннер ×4 без альфы, слоган из store-listing — задачи 3–5 ✓.
- 7 кадров × 4 языка, тёмная + один светлый, подписи, маркеры, список наготы, пришпиленные часы,
  сид формы shoot_56 с локальной датой — задача 4 ✓. Холсты Google/Apple — `CANVAS` ✓.
- Контракт-тест (иконка, баннеры colorType 2, кадры 1080×1920 по языкам, captions полны,
  Apple только если есть) и общий `imageHeaders.ts` — задачи 1, 5 ✓. `.gitignore` для Apple ✓.
- «Не делаем»: iPad, промо-видео, корпус телефона, вычитка es/pt, `assets/*` и `app.json` — ни одна
  задача их не трогает ✓. Загрузка в консоль — руками Артёма, задача 6 ✓.
- Типы/имена: `jpegSize`/`pngHeader` (задача 1) = импорты задачи 5 ✓; `compose`/`render` (задача 3) =
  вызовы задачи 4 ✓; `captions.screens` порядок = `SCREENS` (проверяется в скрипте) ✓;
  `TITLE_MAX/SUB_MAX` одинаковы в python и jest (26/48, калибруются парой) ✓.
