# 04б · Свечение искр через `textShadow`

Статус: реализовано 10.08 · мелкая задача (<30 строк, согласование пропущено по правилу CLAUDE.md §4)

## Цель

Убрать предупреждение `"textShadow*" style props are deprecated. Use "textShadow".` из консоли веб-версии,
не потеряв свечение искр на устройстве.

## Разведка: премиса задачи в backlog была неточной

В backlog задача звучала как «textShadow*, как и старые shadow*, не работают в вебе и на Android».
Проверка по исходникам зависимостей (10.08) показала другое:

| Что | shadow* (тени вида) | textShadow* (тени текста) |
|---|---|---|
| iOS | работает | работает |
| Android | только `shadowColor` (через elevation) | работает (нативный shadowLayer) |
| react-native-web 0.21 | **игнорируется** (в `ignoredProps`) | **конвертируется** в CSS `text-shadow` + deprecation-warning (`node_modules/react-native-web/dist/exports/StyleSheet/preprocess.js:144–150`) |

То есть визуально искры светятся везде уже сейчас. Реальная проблема — только шум в консоли,
который мешает пункту 6б проверки (консоль должна быть чистой).

Второе ограничение: **строкового пропа `textShadow` в React Native 0.81 нет** — в типах и в
`ReactNativeStyleAttributes.js` только legacy-тройка (`StyleSheetTypes.d.ts:546–548`).
Прямая замена на строку убрала бы свечение на iPhone и Android. Это регрессия, так делать нельзя.

## Что делаем

Платформенный сплит по образцу `glowShadow` из `src/theme/glow.ts`:
- **web** → строковый `textShadow: '0 0 <blur>px <color>'` (react-native-web понимает, предупреждения нет);
- **native (iOS/Android)** → legacy-тройка `textShadowColor/Offset/Radius`, радиус = `blur / 2`
  (правило проекта: RN-радиус вдвое меньше CSS-blur).

Хелпер живёт в `src/theme/glow.ts` рядом с `glowShadow` — это файл про свечения, знание о
платформенных различиях теней держим в одном месте.

## Что НЕ делаем

- Не меняем параметры свечения: остаётся `0 0 9px var(--glow)` из `.spark` эталона
  (нативный радиус 4.5 — как сейчас, на устройстве вид не меняется).
- Не трогаем другие компоненты: `textShadow*` больше нигде в проекте не используется (grep 10.08).

## Значения

Из `docs/design-reference.html`, правило `.spark`: `text-shadow: 0 0 9px var(--glow)`, цвет — `t.glow`.

## План по файлам

1. `src/theme/glow.ts` — добавить `textGlow(color: string, cssBlur: number): TextStyle`.
2. `src/components/Sparks.tsx` — заменить три legacy-пропа на `...textGlow(t.glow, 9)`.
3. `npx tsc --noEmit`.
4. Веб-проверка: экран «Сегодня» → перевернуть карту дня → искры видны, в консоли нет
   предупреждения про textShadow.

## Готово, когда

- [x] `npx tsc --noEmit` чистый;
- [x] искры светятся в вебе (визуально не изменились);
- [x] предупреждения `"textShadow*" style props are deprecated` в консоли нет;
- [x] на нативе путь кода — legacy-тройка с радиусом 4.5 (проверяется чтением кода; на iPhone —
      в ближайшую лайв-проверку, вид не должен отличаться от текущего).
