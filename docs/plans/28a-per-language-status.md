# Пер-языковый статус контента — план реализации

> **Для исполнителя:** шаги помечены чекбоксами (`- [ ]`). Каждый шаг — одно проверяемое
> действие. После каждого шага с кодом — `npx tsc --noEmit`; перед каждым коммитом — `npm test`.

**Цель:** статус готовности контента перестаёт быть одним на все языки и становится словарём
по языкам, чтобы «русский вычитан, испанский не написан» можно было записать в схеме — до того,
как приедет первый перевод.

**Архитектура:** `status` блока превращается из строки `"reviewed"` в объект
`{"ru": "reviewed", "en": "reviewed"}`; отсутствующий язык = `todo`. Читатели спрашивают не
«какой статус у блока», а «какой статус у языка, который реально попадёт на экран» — то есть
у результата `presentLang` (фолбэк `inLang` на английский учитывается). Данные, все пять
скриптов конвейера и контракт-тесты меняются согласованно, иначе следующий прогон конвейера
откатит схему назад.

**Технологии:** TypeScript (strict), jest-expo, Python 3 (скрипты конвейера), JSON-контент в бандле.

**Спека:** `docs/specs/28a-per-language-status.md` — там доказательство необходимости,
инвентаризация и решения Артёма от 19.08.

## Глобальные ограничения

- **Ветка** `feat/28a-per-language-status` (задача крупная — правило CLAUDE.md, задачи 07+).
- **Схема стора НЕ меняется.** Это схема КОНТЕНТА (файлы в бандле), а не zustand-persist.
  `version` персиста остаётся **9**; правило «следующая задача, меняющая схему стора, поднимает
  до 10» остаётся в силе и этой задачей не расходуется.
- **Переводов не пишем ни строчки** — задача 28 идёт после.
- **Стартовые значения миграции:** `ru: reviewed`, `en: reviewed` везде (весь контент сейчас
  ровно в `reviewed`: 958 блоков карт + 32 теории + 32 `quizStatus` + 5 staging-файлов —
  проверено 19.08). `es`/`pt` не создаются вовсе.
- **Отсутствие ключа языка и пустая строка значат РАЗНОЕ** (решение 2б спеки): конвейеру
  запрещено создавать `es`/`pt` пустыми заглушками — `presentLang` считает такой язык
  присутствующим и покажет пустоту вместо готового английского.
- **Формат записи JSON** — тот же, что у остальных скриптов конвейера:
  `json.dumps(data, ensure_ascii=False, indent=1) + "\n"`, `encoding="utf-8"`, `newline="\n"`.
  Любое отклонение даст дифф на весь файл.
- **Комментарии в коде — по-русски**, цвета/токены не трогаем (UI-изменений в задаче нет).
- **Правило проекта:** проверка, которая не краснеет на сломанном состоянии, — декорация.
  Каждый новый контракт-тест проверяется экспериментом (шаги это требуют явно).

## Карта файлов

| Файл | Что с ним |
|---|---|
| `src/lib/content.ts` | тип `StatusMap`, `CardContentBlock.status` → `StatusMap`, `quizStatus?: StatusMap`, `wordsStatus?: StatusMap`; новые `statusIn` и `blockText` |
| `src/lib/spread.ts:49` | `cardMeaning` переходит на `blockText` |
| `app/card/[id].tsx:233` | `blockOf` переходит на `blockText` |
| `app/(tabs)/index.tsx:412` | `hasText` переходит на `blockText` |
| `src/lib/__tests__/contentStatus.test.ts` | **создать** — юниты `statusIn`/`blockText` на фикстурах |
| `src/lib/__tests__/cardsContent.test.ts` | связка «текст ⟺ статус» переписывается по языкам + запрет пустых неканоничных ключей |
| `scripts/migrate_status_lang.py` | **создать** — одноразовая идемпотентная миграция всех четырёх хранилищ |
| `content/cards.json` | 958 блоков + новое поле `wordsStatus` у 78 карт |
| `content/course.json` | 32 `theory.status` + 32 `quizStatus` |
| `content/quiz-m*.json` | 5 файловых статусов |
| `scripts/set_status.py` | `--lang`, часть `words`, работа со словарём |
| `scripts/merge_quiz.py` | дефолт статуса отсутствующего поля |
| `scripts/build_cards.py` | новые блоки создаются с пустым словарём; перенос `wordsStatus` |
| `scripts/add_birth_path.py` | вставка со словарём |
| `scripts/content_stats.py` | счёт ПО ЯЗЫКАМ + `course.json` + `wordsStatus` |
| `docs/content-guide.md`, `docs/logic-spec.md`, `docs/localization-plan.md`, `AGENTS.md`, `CLAUDE.md`, `docs/backlog.md` | документация |

---

### Задача 1: Новая схема статуса — данные, типы, чтение

Один неделимый шов: тип `status` меняется, поэтому три сравнения `=== 'todo'` перестают
компилироваться, а контракт-тест данных перестаёт соответствовать данным. Разнести это по
коммитам нельзя — между ними репозиторий был бы красным.

**Файлы:**
- Создать: `src/lib/__tests__/contentStatus.test.ts`, `scripts/migrate_status_lang.py`
- Изменить: `src/lib/content.ts`, `src/lib/spread.ts`, `app/card/[id].tsx`,
  `app/(tabs)/index.tsx`, `src/lib/__tests__/cardsContent.test.ts`
- Данные: `content/cards.json`, `content/course.json`, `content/quiz-m*.json`

**Интерфейсы:**
- Даёт дальше: `StatusMap = Partial<Record<Lang, BlockStatus>>`;
  `statusIn(block: CardContentBlock, lang: Lang): BlockStatus`;
  `blockText(block: CardContentBlock | undefined, lang: Lang): { text: string; todo: boolean }`.
- Берёт: `presentLang`, `inLang`, `Lang` из `src/lib/lang.ts` (уже существуют).

- [ ] **Шаг 1: Ветка**

```bash
git checkout -b feat/28a-per-language-status
```

- [ ] **Шаг 2: Падающий тест на `statusIn` и `blockText`**

Создать `src/lib/__tests__/contentStatus.test.ts`. Фикстуры — свои, не данные бандла:
тест обязан проверять ПРАВИЛО, а не текущее содержимое `cards.json`.

```ts
/** Чтение статуса с учётом фолбэка (спека 28а, решения 2 и 2а): статус спрашивается
 *  у того языка, который реально попадёт на экран, а не у того, который выбрал пользователь. */
import { blockText, statusIn, type CardContentBlock } from '../content';

const block = (over: Partial<CardContentBlock> = {}): CardContentBlock =>
  ({ ru: 'текст', en: 'text', status: { ru: 'reviewed', en: 'reviewed' }, ...over } as CardContentBlock);

describe('statusIn', () => {
  it('свой язык есть — отдаёт его статус', () => {
    const b = block({ es: 'texto', status: { ru: 'reviewed', en: 'reviewed', es: 'draft' } } as Partial<CardContentBlock>);
    expect(statusIn(b, 'es')).toBe('draft');
  });

  it('своего языка нет — отдаёт статус английского, на который упал inLang', () => {
    expect(statusIn(block(), 'es')).toBe('reviewed');
  });

  it('у показанного языка статуса нет вовсе — это todo', () => {
    expect(statusIn(block({ status: { ru: 'reviewed' } }), 'en')).toBe('todo');
  });
});

describe('blockText', () => {
  it('готовый блок — текст своего языка и todo: false', () => {
    expect(blockText(block(), 'ru')).toEqual({ text: 'текст', todo: false });
  });

  it('испанцу без перевода — английский текст, потому что английский готов', () => {
    expect(blockText(block(), 'es')).toEqual({ text: 'text', todo: false });
  });

  it('todo у показанного языка — пусто и todo: true', () => {
    const b = block({ ru: '', en: '', status: { ru: 'todo', en: 'todo' } });
    expect(blockText(b, 'ru')).toEqual({ text: '', todo: true });
  });

  it('блока нет вовсе — todo: true (карта без такого ключа контента)', () => {
    expect(blockText(undefined, 'ru')).toEqual({ text: '', todo: true });
  });
});
```

- [ ] **Шаг 3: Прогон — обязан упасть**

```bash
npm test -- contentStatus
```

Ожидание: FAIL, `statusIn`/`blockText` не экспортированы из `../content`.

- [ ] **Шаг 4: Типы и хелперы в `src/lib/content.ts`**

Импорт `presentLang`/`inLang` (сейчас из `./lang` берутся только типы):

```ts
import { presentLang, inLang, type Lang, type Localized } from "./lang";
```

Заменить объявление блока и добавить хелперы:

```ts
export type BlockStatus = "todo" | "draft" | "reviewed" | "final";

/** Статус готовности ПО ЯЗЫКАМ (спека 28а). Отсутствующий язык = todo: пока перевода нет,
 *  писать про него в файл нечего. Отсутствие ключа и пустая строка значат РАЗНОЕ — конвейеру
 *  запрещено создавать es/pt заглушками (решение 2б спеки). */
export type StatusMap = Partial<Record<Lang, BlockStatus>>;

export interface CardContentBlock extends Localized { status: StatusMap }

/** Статус текста, который РЕАЛЬНО увидит пользователь: `inLang` молча падает на английский,
 *  поэтому спрашивать статус выбранного языка нельзя — испанец с английским текстом получил бы
 *  «Текст готовится» поверх готового текста. Каскада нет: связка «есть текст ⟺ статус не todo»
 *  держится контракт-тестом (решение 2а спеки). */
export function statusIn(block: CardContentBlock, lang: Lang): BlockStatus {
  return block.status[presentLang(block, lang)] ?? "todo";
}

/** Пара «что показать / готово ли» — единственное место, где это правило записано.
 *  Три экрана спрашивали одно и то же по-своему (страница карты, карта дня, расклад). */
export function blockText(
  block: CardContentBlock | undefined,
  lang: Lang,
): { text: string; todo: boolean } {
  if (!block || statusIn(block, lang) === "todo") return { text: "", todo: true };
  return { text: inLang(block, lang), todo: false };
}
```

И у урока курса:

```ts
  /** workflow готовности викторины, как у блоков карт — по языкам (спека 28а) */
  quizStatus?: StatusMap;
```

У карты (`TarotCard`) — статус слов витрины и поиска:

```ts
  /** Один статус на name + keywords + search: перевод карты заливается атомарно, по частям
   *  нельзя — источник поиска выбирается по языку НАЗВАНИЯ (`presentLang` в cardSearch),
   *  и `name.es` без `search.es` дал бы испанское название с английскими словами, порезанными
   *  испанскими окончаниями (решение 4а спеки). */
  wordsStatus?: StatusMap;
```

- [ ] **Шаг 5: Прогон — тест обязан позеленеть**

```bash
npm test -- contentStatus
npx tsc --noEmit
```

Ожидание: тест PASS; `tsc` **красный** в трёх местах — сравнения `block.status === 'todo'`
теперь сравнивают объект со строкой. Это и есть список читателей, которых чинит шаг 6.

- [ ] **Шаг 6: Три читателя переходят на `blockText`**

`src/lib/spread.ts` — `cardMeaning` целиком:

```ts
export function cardMeaning(cardId: string, reversed: boolean, lang: Lang): { text: string; todo: boolean } {
  return blockText(cardById.get(cardId)?.content[reversed ? 'reversed' : 'general'], lang);
}
```

(в импорт из `./content` добавить `blockText`; `inLang` в файле может стать неиспользуемым —
проверить и убрать).

`app/card/[id].tsx` — `blockOf` (заглушка тут своя, `card.soon`):

```ts
  const blockOf = (key: string): { text: string; todo: boolean } => {
    const { text, todo } = blockText(card.content[key], lang);
    return todo ? { text: tr('card.soon'), todo: true } : { text, todo: false };
  };
```

`app/(tabs)/index.tsx`:

```ts
  const dayBlock = card.content.day_card;
  const { text: dayText, todo: dayTodo } = blockText(dayBlock, lang);
  const hasText = !dayTodo;
```

⚠️ Дальше по файлу `dayText` использовался как `string | undefined`; после правки это всегда
строка. Проверить каждое употребление: `grep -n "dayText" "app/(tabs)/index.tsx"` — условия
вида `dayText && …` заменить на `hasText && …`, чтобы пустая строка не читалась как «есть текст».

- [ ] **Шаг 7: `tsc` и тесты — где стало красным от СХЕМЫ, а не от кода**

```bash
npx tsc --noEmit
npm test
```

Ожидание: `tsc` чистый; `npm test` красный в `cardsContent.test.ts` (данные ещё старые,
`block.status` там строка) и, возможно, в `lesson.test.ts` (фикстура `theory.status: 'draft'`
и `quizStatus: 'draft'` — строки вместо словарей). Это ровно те два места, которые обязаны
измениться вместе со схемой.

- [ ] **Шаг 8: Фикстуры `lesson.test.ts` — под новую схему**

```ts
  theory: { ru: 'абзац', en: 'para', status: { ru: 'draft', en: 'draft' } },
  quizStatus: { ru: 'draft', en: 'draft' },
```

- [ ] **Шаг 9: Скрипт миграции**

Создать `scripts/migrate_status_lang.py`:

```python
#!/usr/bin/env python3
"""
Одноразовая идемпотентная миграция статусов контента на пер-языковую схему (спека 28а).

Было:  "status": "reviewed"
Стало: "status": {"ru": "reviewed", "en": "reviewed"}

Трогает все четыре хранилища статуса сразу — блоки карт, теорию и quizStatus уроков,
файловый статус staging-викторин, — потому что рассинхрон между ними молчалив: следующий
прогон merge_quiz.py просто перенёс бы старую форму обратно в course.json.
Заодно заводит wordsStatus у карты (name + keywords + search, решение 4а спеки).

Запуск из корня:  python scripts/migrate_status_lang.py [--dry-run]
Повторный прогон ничего не меняет (уже словарь — пропускаем).
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CARDS = ROOT / "content" / "cards.json"
COURSE = ROOT / "content" / "course.json"

# Языки канона: только на них контент написан руками. es/pt не создаём вовсе —
# отсутствие ключа и есть todo (решение 2б спеки: пустая строка значила бы другое).
CANON = ("ru", "en")
# Статус слов витрины и поиска: их не было в workflow вовсе, заводим сразу вычитанными
# по решению 4 (оговорка про en — в спеке, раздел «Решения, принятые в рамках согласованного»).
WORDS_START = "reviewed"


def to_map(value):
    """Строка -> словарь по языкам канона. Уже словарь (или пусто) -> отдаём как есть."""
    if isinstance(value, str):
        return {lang: value for lang in CANON}
    return value


def dump(path: Path, data: object) -> None:
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="Миграция статусов контента на пер-языковую схему")
    ap.add_argument("--dry-run", action="store_true", help="показать счётчики, ничего не записывая")
    args = ap.parse_args()

    changed = {"блоки карт": 0, "wordsStatus": 0, "теория": 0, "викторины уроков": 0, "staging-файлы": 0}

    cards = json.loads(CARDS.read_text(encoding="utf-8"))
    for card in cards["cards"]:
        for block in card["content"].values():
            if isinstance(block.get("status"), str):
                block["status"] = to_map(block["status"])
                changed["блоки карт"] += 1
        if "wordsStatus" not in card:
            card["wordsStatus"] = {lang: WORDS_START for lang in CANON}
            changed["wordsStatus"] += 1

    course = json.loads(COURSE.read_text(encoding="utf-8"))
    for module in course["modules"]:
        for lesson in module["lessons"]:
            theory = lesson.get("theory")
            if theory and isinstance(theory.get("status"), str):
                theory["status"] = to_map(theory["status"])
                changed["теория"] += 1
            if isinstance(lesson.get("quizStatus"), str):
                lesson["quizStatus"] = to_map(lesson["quizStatus"])
                changed["викторины уроков"] += 1

    staging = []
    for path in sorted((ROOT / "content").glob("quiz-*.json")):
        quiz = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(quiz.get("status"), str):
            quiz["status"] = to_map(quiz["status"])
            staging.append((path, quiz))
            changed["staging-файлы"] += 1

    report = ", ".join(f"{k}: {v}" for k, v in changed.items())
    if args.dry_run:
        print(f"СУХОЙ ПРОГОН: изменилось бы — {report}")
        return
    if sum(changed.values()) == 0:
        print(f"Нечего мигрировать: схема уже пер-языковая ({report})")
        return

    dump(CARDS, cards)
    dump(COURSE, course)
    for path, data in staging:
        dump(path, data)
    print(f"OK: {report}")


if __name__ == "__main__":
    main()
```

- [ ] **Шаг 10: Сухой прогон**

```bash
python scripts/migrate_status_lang.py --dry-run
```

Ожидание ровно: `блоки карт: 958, wordsStatus: 78, теория: 32, викторины уроков: 32,
staging-файлы: 5`. Цифры сверены с содержимым файлов 19.08; расхождение = повод остановиться
и разобраться, а не «наверное, что-то поменялось».

- [ ] **Шаг 11: Боевой прогон и проверка идемпотентности**

```bash
python scripts/migrate_status_lang.py
git diff --stat
python scripts/migrate_status_lang.py
git diff --stat
```

Ожидание: первый прогон печатает те же цифры и меняет 7 файлов; второй печатает
«Нечего мигрировать» и `git diff --stat` после него совпадает с предыдущим (повторный запуск
не добавил ни строки — иначе скрипт не идемпотентен и им нельзя пользоваться дважды).

- [ ] **Шаг 12: Контракт-тест данных — под новую связку**

Переписать второй `describe` в `src/lib/__tests__/cardsContent.test.ts`. Правило было
«todo ⟺ оба языка пустые»; стало «у языка есть текст ⟺ его статус не todo», плюс запрет
пустых ключей неканоничных языков (решение 2б спеки).

```ts
import { cards, type BlockStatus, type StatusMap } from '../content';
import { LANGS, type CanonLang, type Lang } from '../lang';

const CANON: CanonLang[] = ['ru', 'en'];
const VALID_STATUSES: BlockStatus[] = ['todo', 'draft', 'reviewed', 'final'];

const statusOf = (map: StatusMap, lang: Lang): BlockStatus => map[lang] ?? 'todo';

describe('контракт пер-языкового статуса (cards.json, спека 28а)', () => {
  it.each(cards.map((c) => [c.id, c] as const))('%s: статусы блоков валидны и согласованы с текстом', (_id, card) => {
    for (const [key, block] of Object.entries(card.content)) {
      for (const lang of CANON) {
        expect(VALID_STATUSES).toContain(statusOf(block.status, lang));
        // канон обязан быть у каждого блока: язык есть всегда, вопрос только в наполненности
        const hasText = (block[lang] ?? '').trim() !== '';
        expect(`${key}.${lang}: текст=${hasText}`)
          .toBe(`${key}.${lang}: текст=${statusOf(block.status, lang) !== 'todo'}`);
      }
      // неканоничный язык: либо его нет вовсе, либо он полноценный — пустых заглушек не бывает,
      // иначе presentLang покажет пустоту вместо готового английского (решение 2б спеки)
      for (const lang of LANGS.filter((l) => !CANON.includes(l as CanonLang))) {
        if (block[lang] === undefined) continue;
        expect(`${key}.${lang}`).toBe(`${key}.${lang}`);
        expect((block[lang] as string).trim()).not.toBe('');
        expect(statusOf(block.status, lang)).not.toBe('todo');
      }
    }
  });

  it.each(cards.map((c) => [c.id, c] as const))('%s: wordsStatus заведён на канон', (_id, card) => {
    for (const lang of CANON) {
      expect(VALID_STATUSES).toContain(statusOf(card.wordsStatus ?? {}, lang));
      expect(statusOf(card.wordsStatus ?? {}, lang)).not.toBe('todo');
    }
  });
});
```

⚠️ Первый `describe` файла (наличие четырёх блоков `*_reversed`) и последний (непустые
`name.ru`/`name.en`) не трогать — они про другое.

- [ ] **Шаг 13: Прогон**

```bash
npm test
npx tsc --noEmit
```

Ожидание: всё зелёное, число тестов выросло на 7 (юниты `contentStatus`) плюс по два новых
кейса на карту.

- [ ] **Шаг 14: Эксперимент «проверка обязана краснеть»**

Правило проекта: тест, который не краснеет на сломанном состоянии, — декорация. Проверяем
ОБЕ новые связки, по одной за раз, руками и с откатом.

```bash
python -c "
import json,pathlib
p=pathlib.Path('content/cards.json'); d=json.loads(p.read_text(encoding='utf-8'))
d['cards'][0]['content']['general']['es']=''   # пустой неканоничный ключ — ловушка presentLang
p.write_text(json.dumps(d,ensure_ascii=False,indent=1)+'\n',encoding='utf-8',newline='\n')"
npm test -- cardsContent
git checkout content/cards.json
```

Ожидание: FAIL на первой карте. Затем вторая связка:

```bash
python -c "
import json,pathlib
p=pathlib.Path('content/cards.json'); d=json.loads(p.read_text(encoding='utf-8'))
d['cards'][0]['content']['general']['status']['ru']='todo'  # текст есть, статус todo
p.write_text(json.dumps(d,ensure_ascii=False,indent=1)+'\n',encoding='utf-8',newline='\n')"
npm test -- cardsContent
git checkout content/cards.json
```

Ожидание: FAIL. После обоих откатов — `git status` чистый по `content/`.

- [ ] **Шаг 15: Коммит**

```bash
git add -A
git commit -m "feat: пер-языковый статус контента — схема, миграция, чтение (spec 28a)"
```

---

### Задача 2: Конвейер — `set_status.py` учится языкам

**Файлы:** изменить `scripts/set_status.py`

**Интерфейсы:**
- Берёт: новую форму статуса из задачи 1.
- Даёт дальше: `--lang ru,en,es,pt` (по умолчанию — оба канонических) и часть `--only words`.

- [ ] **Шаг 1: Разбор `--lang` и части `words`**

В шапке дописать в примеры запуска:

```
    python scripts/set_status.py reviewed --lang es       # только испанский
    python scripts/set_status.py reviewed --only words    # слова витрины и поиска
```

Аргументы и константы:

```python
LANGS = ["ru", "en", "es", "pt"]
PARTS = ["cards", "words", "theory", "quiz"]
```

```python
    ap.add_argument("--only", choices=PARTS, help="ограничить одной частью контента")
    ap.add_argument("--lang", help="языки через запятую (по умолчанию ru,en — канон)")
```

```python
    langs = [l.strip() for l in args.lang.split(",")] if args.lang else ["ru", "en"]
    bad = [l for l in langs if l not in LANGS]
    if bad:
        print(f"ОШИБКА: неизвестный язык {', '.join(bad)}; допустимы {', '.join(LANGS)}")
        sys.exit(1)
```

- [ ] **Шаг 2: Общий сдвиг статуса — одной функцией на все четыре хранилища**

Дублировать `if block.get("status") == args.src` в четырёх местах больше нельзя: значение стало
словарём, и правило «двигаем только совпавшие языки» должно лежать по одному разу.

```python
def bump(holder: dict, key: str, src: str, dst: str, langs: list[str]) -> int:
    """Двигает статус у перечисленных языков; отсутствующий язык считается todo.
    Возвращает, сколько языков сдвинулось. Языки, чей статус не совпал с исходным, не трогает —
    поэтому «русский reviewed, испанский draft» не схлопывается в один статус."""
    status = holder.get(key)
    if not isinstance(status, dict):
        return 0
    moved = 0
    for lang in langs:
        if status.get(lang, "todo") == src:
            status[lang] = dst
            moved += 1
    return moved
```

- [ ] **Шаг 3: Четыре хранилища через `bump`**

```python
    if "cards" in parts or "words" in parts:
        cards = json.loads(CARDS.read_text(encoding="utf-8"))
        for card in cards["cards"]:
            if "cards" in parts:
                for block in card["content"].values():
                    changed["cards"] += bump(block, "status", args.src, args.to, langs)
            if "words" in parts:
                changed["words"] += bump(card, "wordsStatus", args.src, args.to, langs)
```

```python
    if "theory" in parts:
        for module in course["modules"]:
            for lesson in module["lessons"]:
                if lesson.get("theory"):
                    changed["theory"] += bump(lesson["theory"], "status", args.src, args.to, langs)
```

```python
        for quiz_path in sorted((ROOT / "content").glob("quiz-*.json")):
            quiz = json.loads(quiz_path.read_text(encoding="utf-8"))
            if bump(quiz, "status", args.src, args.to, langs):
                changed_quiz_files.append((quiz_path, quiz))
        for module in course["modules"]:
            for lesson in module["lessons"]:
                changed["quiz"] += bump(lesson, "quizStatus", args.src, args.to, langs)
```

⚠️ Запись `cards.json` теперь нужна и при `--only words` — поправить условие внизу:
`if "cards" in parts or "words" in parts:`.

- [ ] **Шаг 4: Проверка сухими прогонами**

```bash
python scripts/set_status.py final --from reviewed --dry-run
python scripts/set_status.py final --from reviewed --lang es --dry-run
python scripts/set_status.py final --from reviewed --only words --dry-run
python scripts/set_status.py reviewed --lang xx --dry-run
```

Ожидание: первый — 2044 (958×2 блока + 32×2 теории + 32×2 викторины уроков; staging-файлы
в счётчик не входят, они печатаются отдельно); второй — 0 (испанского нет ни у кого, и это
главная проверка: язык, которого нет, не должен «подхватить» чужой статус); третий — 156
(78 карт × 2 языка); четвёртый — ОШИБКА про неизвестный язык, код возврата 1.

- [ ] **Шаг 5: Коммит**

```bash
git add scripts/set_status.py
git commit -m "feat: set_status двигает статусы по языкам (spec 28a)"
```

---

### Задача 3: Конвейер — создание блоков и слияние викторин

**Файлы:** изменить `scripts/merge_quiz.py`, `scripts/build_cards.py`, `scripts/add_birth_path.py`

- [ ] **Шаг 1: `merge_quiz.py` — дефолт статуса**

```python
    # статус файла — словарь по языкам (спека 28а); файл без статуса = ничего не готово,
    # то есть пустой словарь, а не «draft на всех языках сразу»
    status = quiz.get("status") or {}
```

Строку отчёта поправить, чтобы печатала словарь читаемо:

```python
    langs = ", ".join(f"{k}: {v}" for k, v in sorted(status.items())) or "нет статуса"
    print(f"{quiz_path.name}: {total} вопросов в {len(quiz['lessons'])} уроков, статус — {langs}")
```

- [ ] **Шаг 2: Проверка идемпотентности слияния — главная регрессия задачи**

```bash
python scripts/merge_quiz.py
git diff --stat content/course.json
```

Ожидание: отчёт печатает `статус — en: reviewed, ru: reviewed` по каждому из пяти файлов,
а `git diff` по `course.json` **пустой**. Непустой дифф означает, что слияние откатило схему
статуса назад — ровно та ловушка двойного хранения, ради которой периметр расширяли.

- [ ] **Шаг 3: `build_cards.py` — новые блоки и перенос `wordsStatus`**

```python
        for b in BLOCKS:
            # пустой словарь статуса = ничего не готово ни на одном языке (спека 28а).
            # Ключи es/pt тут не создаём вовсе: пустая строка значила бы «язык есть и он пуст»
            content.setdefault(b, {"ru": "", "en": "", "status": {}})
```

Рядом с переносом `keywords`/`search` из прежнего файла — перенос статуса слов:

```python
        card["wordsStatus"] = (prev or {}).get("wordsStatus", {})
```

В шапке скрипта строку `status: todo | draft | reviewed | final` заменить на
`status: словарь по языкам, {"ru": "reviewed", "en": "draft"} (спека 28а)`.

⚠️ Строка отчёта в конце считает написанное как `b["status"] != "todo"` — теперь это всегда
истина (словарь ≠ строка), то есть счётчик молча врал бы:

```python
    kept = sum(1 for x in out
               if any(s != "todo" for b in x["content"].values() for s in b["status"].values()))
```

- [ ] **Шаг 4: Проверка `build_cards.py`**

```bash
ls /tmp/tarot-api/static/card_data.json
```

⚠️ На 19.08 исходника в системе НЕТ, и скрипт запустить нечем. Значит правка проверяется
чтением, а факт непроверенности пишется в отчёт спеки честно — не «прогнал, всё хорошо».
Если исходник появится: `python scripts/build_cards.py` и `git diff content/cards.json`
обязан быть пустым (скрипт сливает, а не перезаписывает).

- [ ] **Шаг 5: `add_birth_path.py` — вставка словарём**

```python
        card["content"]["birth_path"] = {
            "ru": phrase["ru"], "en": phrase["en"],
            "status": {"ru": "draft", "en": "draft"},
        }
```

(скрипт одноразовый и уже отработан — правка ради консистентности схемы, чтобы повторный
прогон не вернул строку).

- [ ] **Шаг 6: Тесты и коммит**

```bash
npm test
git add scripts/merge_quiz.py scripts/build_cards.py scripts/add_birth_path.py content/course.json
git commit -m "feat: конвейер контента пишет статусы по языкам (spec 28a)"
```

---

### Задача 4: Отчёт готовности по языкам

`content_stats.py` сейчас считает только `cards.json` и ничего не знает ни про курс, ни про
языки — то есть после миграции отвечал бы на вопрос, который больше не задают.

**Файлы:** изменить `scripts/content_stats.py`

- [ ] **Шаг 1: Переписать отчёт**

```python
#!/usr/bin/env python3
"""Отчёт о готовности контента по языкам: сколько единиц в каком статусе (спека 28а).

Единица — то, у чего есть свой статус: блок значений карты, слова карты (name+keywords+search),
теория урока, викторина урока. Считаем ПО ЯЗЫКАМ: отсутствующий язык = todo, поэтому
непереведённый испанский виден сразу столбцом todo, а не отсутствием строки.
"""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LANGS = ("ru", "en", "es", "pt")
ORDER = ("final", "reviewed", "draft", "todo")


def add(counts: dict, part: str, status_map: dict) -> None:
    for lang in LANGS:
        counts[part][lang][status_map.get(lang, "todo")] += 1


def main() -> None:
    counts = {p: {l: Counter() for l in LANGS} for p in ("значения карт", "слова карт", "теория", "викторины")}

    cards = json.loads((ROOT / "content/cards.json").read_text(encoding="utf-8"))["cards"]
    for card in cards:
        for block in card["content"].values():
            add(counts, "значения карт", block["status"])
        add(counts, "слова карт", card.get("wordsStatus", {}))

    course = json.loads((ROOT / "content/course.json").read_text(encoding="utf-8"))
    for module in course["modules"]:
        for lesson in module["lessons"]:
            if lesson.get("theory"):
                add(counts, "теория", lesson["theory"]["status"])
            if lesson.get("quizStatus") is not None:
                add(counts, "викторины", lesson["quizStatus"])

    for part, per_lang in counts.items():
        total = sum(per_lang["ru"].values())
        print(f"\n{part} — {total} единиц на язык")
        for lang in LANGS:
            row = "  ".join(f"{s}: {per_lang[lang].get(s, 0):4d}" for s in ORDER)
            ready = per_lang[lang].get("reviewed", 0) + per_lang[lang].get("final", 0)
            print(f"  {lang}:  {row}   готово {ready / total:.0%}" if total else f"  {lang}: —")

    print("\nStaging-викторины (статус файла):")
    for path in sorted((ROOT / "content").glob("quiz-*.json")):
        status = json.loads(path.read_text(encoding="utf-8")).get("status") or {}
        print(f"  {path.name:18s} " + ", ".join(f"{k}: {v}" for k, v in sorted(status.items())))


if __name__ == "__main__":
    main()
```

- [ ] **Шаг 2: Прогон и сверка с известными числами**

```bash
python scripts/content_stats.py
```

Ожидание: «значения карт — 958 единиц на язык», ru/en `reviewed: 958`, es/pt `todo: 958`,
готово 100 % / 100 % / 0 % / 0 %; «слова карт — 78»; «теория — 32»; «викторины — 32»;
пять staging-файлов с `en: reviewed, ru: reviewed`. Расхождение с этими числами = ошибка
миграции, а не отчёта.

- [ ] **Шаг 3: Коммит**

```bash
git add scripts/content_stats.py
git commit -m "feat: отчёт готовности контента по языкам (spec 28a)"
```

---

### Задача 5: Документация и закрытие

**Файлы:** `docs/content-guide.md`, `docs/logic-spec.md`, `docs/localization-plan.md`,
`AGENTS.md`, `CLAUDE.md`, `docs/backlog.md`, `docs/specs/28a-per-language-status.md`

- [ ] **Шаг 1: `content-guide.md` — workflow статусов по языкам**

В разделе про статусы: статус принадлежит ПАРЕ «блок + язык», а не блоку; отсутствующий
язык читается как `todo`; двигать статус только тому языку, который реально вычитан
(`--lang`). Заодно поправить фактическую неточность: `npm run content:stats` в
`package.json` не существует — запуск `python scripts/content_stats.py`.

- [ ] **Шаг 2: `logic-spec.md` — правило чтения**

Дописать: текст берётся `inLang` с фолбэком на английский, а готовность спрашивается у языка,
который реально показан (`statusIn`/`blockText`), — иначе одно из двух: заглушка поверх
готового английского либо черновик под видом готового.

- [ ] **Шаг 3: `localization-plan.md` — сессия L-5**

Сейчас обещает выставить один статус на блок. Переформулировать: L-5 двигает статус ТОЛЬКО
залитого языка (`python scripts/set_status.py reviewed --lang es`), канон не трогает.

- [ ] **Шаг 4: `AGENTS.md` — блок «Контент-конвейер»**

Обновить описания `set_status.py` (появились `--lang` и часть `words`), `content_stats.py`
(по языкам, видит курс), добавить `migrate_status_lang.py` как одноразовый; в разделе
«Архитектура» — новая форма блока `{ru, en, status: {ru, en}}` и правило `statusIn`.

- [ ] **Шаг 5: `CLAUDE.md` — статус и уроки задачи**

Абзац про закрытие 28а: что изменилось в схеме, чем закрыт класс «английский никто не читал»,
новые хелперы, число тестов, напоминание что persist version НЕ поднималась (схема контента ≠
схема стора) и правило про пустые ключи неканоничных языков.

- [ ] **Шаг 6: `backlog.md`**

Отметить 28а сделанной; в задаче 28 снять слова «ЖДЁТ РЕШЕНИЯ Артёма по четырём развилкам»
и записать, что предусловие закрыто, — заливать переводы теперь есть куда.

- [ ] **Шаг 7: Отчёт в спеке**

В `docs/specs/28a-per-language-status.md` дописать раздел «Отчёт» — что сделано, какие числа
дал `content_stats.py`, что `build_cards.py` проверен ЧТЕНИЕМ (исходника tarot-api в системе
нет), какие эксперименты на «краснеет ли тест» проведены.

- [ ] **Шаг 8: Финальная проверка и коммит**

```bash
npx tsc --noEmit
npm test
git add -A
git commit -m "docs: пер-языковый статус контента — доки и отчёт (spec 28a)"
```

---

## Проверка (пункт 6 процесса)

**Веб-проверки 6а/6б у этой задачи нет по существу, и это надо сказать прямо, а не пропустить
молча.** Задача не меняет ни одного пикселя: UI-путь «показать текст или заглушку» остаётся
тем же, потому что весь контент как был `reviewed`, так и остался. Прогонять скриншоты 390×844
и сравнивать с макетом здесь нечего — сравнивать было бы с самим собой.

Что заменяет проверку:
1. `npm test` — контракт-тесты данных на всех 78 картах плюс юниты фолбэка статуса.
2. Эксперименты «тест краснеет на сломанном состоянии» (задача 1, шаг 14) — оба.
3. Идемпотентность миграции и слияния (`git diff` пустой после повторного прогона).
4. **Дымовая проверка в браузере одним экраном:** `npx expo start --web`, открыть страницу
   любой карты и убедиться, что тексты сфер на месте, а не «Текст готовится». Это ловит
   единственный реальный способ всё сломать — если бы `statusIn` начал отдавать `todo` там,
   где раньше показывался текст.

Лайв-проверка на iPhone (6в) не нужна: движковых различий (числительные, даты, форматы) задача
не касается, нативного слоя не трогает.
