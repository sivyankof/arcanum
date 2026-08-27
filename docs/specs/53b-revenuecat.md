# 53б · RevenueCat: живые покупки за готовым правом Premium

Заведена 27.08.2026 (бэклог 53, вторая половина). Первая половина — 53а (`docs/specs/53-premium.md`,
закрыта 22.08): право `premium` в сторе, правила `src/lib/premium.ts`, гейты, экран пейвола, адаптер-заглушка
`src/lib/purchases.ts`. Задача 62 (26.08) сняла с пейвола выдуманные цены: без магазина экран рисует
состояние «скоро». Эта спека подставляет под тот же интерфейс адаптера настоящий магазин.

## Цель

В сборке из App Store / Google Play пейвол показывает цены магазина, покупает, восстанавливает и
синхронизирует право `premium` с подпиской; в Expo Go и вебе ничего не меняется (состояние «скоро»).
Ни одной цены в коде, ни одной кнопки, которая не может сделать то, что обещает.

## Решения, на которых стоит задача

1. **Подход А — RevenueCat без `expo-dev-client`** (решение Артёма 27.08). `react-native-purchases`
   10.8 в Expo Go сам переходит в «Preview API Mode» (JS-моки), поэтому профиль `development` и
   dev-client не нужны: ежедневная работа — Expo Go, живые покупки — сборка из внутреннего трека.
   Предположение спеки 61 («dev-client придёт с RevenueCat») снято.
   ⚠️ В Expo Go `Purchases.configure()` с боевым ключом БРОСАЕТ (`Invalid API key … inside Expo Go`),
   поэтому в Expo Go SDK не конфигурируется вовсе — адаптер остаётся заглушкой 62.
2. **Пробного периода нет** (решение Артёма 27.08). Продукты создаются без вводных предложений,
   код `introPrice` не читает. Появится позже — включается в консоли, тогда же дописывается ветка
   «N дней бесплатно, затем {{price}}» (правило обоих магазинов: цена после триала на кнопке).
3. **Play Billing Library ≥ 8 обязательна для новых приложений с 31.08.2026.** `react-native-purchases`
   10.6+ несёт `purchases-android` 10.16+ с Billing 8.3.0 (`VERSIONS.md` репозитория) — берём `^10.8.0`.
   Текущие сборки без библиотеки покупок под требование не попадают.
4. **Ключи — не в коде.** Публичные SDK-ключи RevenueCat (`goog_…`, `appl_…`) живут в переменных
   `EXPO_PUBLIC_RC_ANDROID_KEY` / `EXPO_PUBLIC_RC_IOS_KEY`: локально `.env` (уже в `.gitignore` и
   `.easignore`), в EAS — `eas env:set` для сред `production` и `preview` (репозиторий публичный).
   Нет ключа → `PURCHASES_AVAILABLE === false` → «скоро» — сборка без ключа честно деградирует,
   а не падает. `eas.json` без поля `environment`: `production` берёт среду `production`
   (`distribution` по умолчанию `store`), `preview` — среду `preview` (проверено по докам EAS 27.08).
5. **Каталог.** Google Play: подписка `premium`, базовые планы `year` (P1Y) и `month` (P1M).
   RevenueCat: entitlement `premium`, продукты `premium:year` и `premium:month` (формат Google
   «подписка:план»), offering `default` с пакетами `$rc_annual` и `$rc_monthly`. Apple: продукты
   `premium.year` / `premium.month` в App Store Connect, когда откроется аккаунт; код общий —
   в нём нет ни одного идентификатора продукта, только entitlement `premium` и типы пакетов.
6. **Цены — только строки магазина** (правило спеки 53, раздел «Цены и валюта»): `price` =
   `product.priceString`, `perMonth` годового = `product.pricePerMonthString` (форматирует SDK
   по локали магазина — сами не делим и не форматируем, у Hermes урезанный ICU). Процент скидки
   считается из чисел `pricePerMonth` годового и `price` месячного, округляется ВНИЗ и рисуется
   только при полной паре в одной валюте и при ≥ 5 %; иначе бейджа нет.
7. **Право остаётся в сторе, магазин — его источник.** `PremiumState` получает `plan` и `willRenew`
   → **persist version 12** (поле ВНУТРИ объекта `premium` — слияние руками, правило 5 CLAUDE.md).
   Слияние ответа магазина: активен → `{active: true, source: 'store', until, plan, willRenew}`;
   неактивен и `source === 'store'` → `PREMIUM_NONE`; `source === 'dev'` магазин не трогает
   (DEV-тумблер живёт только в Expo Go). Гейты `premium.ts` не меняются.
8. **Без сервера и без аккаунтов** (как весь v1): app user ID анонимный (генерирует SDK),
   «Восстановить покупки» = `restorePurchases()` по аккаунту магазина.
9. **«Продлится {{date}}» — только если продление включено.** У отменённой, но ещё действующей
   подписки панель говорит «Действует до {{date}}» (`willRenew === false`); сейчас «Продлится»
   соврало бы. `until` хранится ЛОКАЛЬНОЙ датой `YYYY-MM-DD` (`localDateISO(new Date(expirationDate))`):
   `formatFullDate` разбирает только такую форму, полный ISO-момент даст NaN.
10. **Ошибка магазина — не тишина.** Сейчас результат `error` в `run()` пейвола глотается молча
    (обрабатывается только `unavailable`). Добавляется диалог «Не получилось / Магазин не ответил»;
    `cancelled` (пользователь закрыл лист оплаты) — без диалога; `restore` без права — диалог
    «Подписка не найдена» (новая причина `none`).
11. **Проверка покупок — на устройстве с аккаунтом лицензионного тестера**, установка из
    внутреннего трека (подпись Play App Signing; APK с ключом загрузки Play Billing не примет).
    Тестовые подписки Google: месяц продлевается каждые 5 минут, год — каждые 30, после шести
    продлений гаснут сами. Эмулятор с Play Store (уже залогинен, AGENTS.md) пробуем первым —
    документация RevenueCat называет его ненадёжным, но не запрещённым; сорвётся — телефон.

## Что делаем

### Артём — до кода (консоли, ~1 час)

- [ ] RevenueCat: аккаунт → проект `Arcanum` → приложение Google Play (`app.arcanum.tarot`).
      Service-account JSON для проверки покупок — по мастеру RevenueCat (Google Cloud → сервисный
      аккаунт → Play Console «Пользователи и разрешения» → финансовые данные + управление заказами).
      RTDN (Pub/Sub) — по тому же мастеру, рекомендуется, не блокирует.
- [ ] Play Console → Монетизация → Подписки: подписка `premium`, базовые планы `year` (годовой,
      автопродление) и `month` (месячный); **цены** — базовая страна и уровни (решение Артёма:
      ориентир master-plan 2 890 ₽/год ≈ −40 %, 399 ₽/мес; автопересчёт по странам принять или поправить);
      без вводных предложений (решение 2); активировать.
- [ ] RevenueCat: entitlement `premium` ← продукты `premium:year`, `premium:month`; offering `default`
      (сделать current) с пакетами `$rc_annual` → `premium:year`, `$rc_monthly` → `premium:month`.
- [ ] Play Console → Настройки → Лицензионное тестирование: аккаунт Артёма (+ второй, если будет
      телефон жены) — тестовые карты вместо настоящих.
- [ ] Ключ `goog_…` из RevenueCat → `eas env:set --name EXPO_PUBLIC_RC_ANDROID_KEY --value goog_… \
      --environment production --environment preview --visibility plaintext` и та же строка в `.env`
      локально (для `expo start` она не нужна — в Expo Go SDK не конфигурируется, но `eas env:pull`
      кладёт её туда же).
- [ ] Apple — после активации аккаунта: In-App Purchase Key (`.p8`) в RevenueCat, продукты
      `premium.year` / `premium.month` в ASC, ключ `appl_…` → `EXPO_PUBLIC_RC_IOS_KEY`. Отдельный
      заход, не блокирует Android.

### Ключи и окружение (сессия)

- `package.json`: `react-native-purchases@^10.8.0` → **`npm install` и новая сборка**; в Expo Go
  приложение продолжает работать (Preview API Mode), dev-сервер перезапустить с `--clear`
  (новый файл `.web.ts`, урок 06б).
- `.env.example` (коммитится): две строки с пустыми значениями и комментарием, откуда брать.
  ⚠️ Файл добавляется и в `.easignore`: страж `check_easignore.py` считает секретом любой `.env.*`,
  а сборке образец не нужен — исключаем файл, а не ослабляем детектор секретов (рулинг 27.08).
- `src/lib/purchasesEnv.ts` (крошечный, без SDK): чтение `process.env.EXPO_PUBLIC_RC_*` по платформе
  и признак Expo Go (`Constants.executionEnvironment === ExecutionEnvironment.StoreClient`).
  Отдельный файл — чтобы `purchasesMap.ts` оставался чистым, а `purchases.ts` не зависел от
  `expo-constants` в тестах.

### Чистые преобразования `src/lib/purchasesMap.ts` (без SDK и react, под юнитами)

```ts
export function purchasesAvailable(p: { platform: string; expoGo: boolean; apiKey: string | undefined }): boolean;
// натив ∧ не Expo Go ∧ непустой ключ

export function toOffers(offering: OfferingLike | null): Offer[];
// current === null или нет пакетов annual/monthly → []; порядок: year, month (экран выбирает year по умолчанию);
// price = priceString; perMonth = annual.product.pricePerMonthString ?? undefined;
// discountPct = discountPercent(annual.product.pricePerMonth, monthly.product.price, валюты равны)

export function discountPercent(annualPerMonth: number | null, monthlyPrice: number | null, sameCurrency: boolean): number | undefined;
// floor((1 − a/m)·100); undefined, если чисел нет, m ≤ 0, валюты разные или результат < 5

export function toPremium(info: CustomerInfoLike): PremiumState;
// entitlements.active.premium есть → {active: true, source: 'store', until: localDateISO(expirationDate) | null,
//   plan: planOf(productIdentifier), willRenew}; нет → PREMIUM_NONE (не null: «магазин ответил — права нет»)

export function planOf(productIdentifier: string): Plan | null;
// /year|annual/i → 'year', /month/i → 'month', иначе null — покрывает 'premium:year', 'premium.year', '$rc_annual'

export function mergeEntitlement(current: PremiumState, fromStore: PremiumState | null, todayISO: string): PremiumState;
// правило 7 + локальная проверка: source 'store' и until < todayISO → PREMIUM_NONE (fromStore === null — SDK не ответил)
```

`OfferingLike` / `CustomerInfoLike` — узкие структурные типы с нужными полями, чтобы фикстуры тестов
не тащили типы SDK. Тип `Offer` в `purchases.ts`: `discount: string` → `discountPct?: number`
(подпись «−N %» собирает i18n, не адаптер).

### Адаптер `src/lib/purchases.ts` (единственный файл с импортом `react-native-purchases`)

```ts
export const PURCHASES_AVAILABLE: boolean;            // purchasesAvailable(...) на загрузке модуля
export type PlanId = 'year' | 'month';
export interface Offer { id: PlanId; price: string; perMonth?: string; discountPct?: number }
export type PurchaseResult =
  | { ok: true; premium: PremiumState }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'error' | 'none' }; // none — только у restore

export async function init(): Promise<void>;          // configure({apiKey}) один раз + setLogLevel(__DEV__ ? DEBUG : ERROR); без SDK — no-op
export async function getOffers(): Promise<Offer[]>;  // toOffers((await getOfferings()).current); любой throw → []
export async function purchase(id: PlanId): Promise<PurchaseResult>;
// purchasePackage(пакет по id) → {ok, premium: toPremium(customerInfo)}; e.userCancelled → cancelled; иначе error
export async function restore(): Promise<PurchaseResult>;
// restorePurchases() → право есть → ok; нет → none; throw → error
export async function refreshEntitlement(): Promise<PremiumState | null>; // getCustomerInfo → toPremium; throw → null
export function onEntitlementChange(cb: (p: PremiumState) => void): () => void; // addCustomerInfoUpdateListener → toPremium
export async function manageUrl(): Promise<string | null>;
// customerInfo.managementURL ?? (android: play.google.com/store/account/subscriptions?package=app.arcanum.tarot, ios: apps.apple.com/account/subscriptions)
```

Без SDK (`!PURCHASES_AVAILABLE`) каждая функция ведёт себя как заглушка 62: `[]`, `unavailable`,
`null`, `() => {}`, `null`. `purchases.web.ts` — та же сигнатура, ни одного импорта SDK
(приём `pushes.web.ts`). Идентификаторов продуктов в адаптере нет — пакеты берутся как
`offering.annual` / `offering.monthly`.

### Право: стор, persist 12, синхронизация

- `src/lib/premium.ts`: `PremiumState` + `plan: PlanId | null` + `willRenew: boolean`;
  `PREMIUM_NONE` = `{active: false, source: 'none', until: null, plan: null, willRenew: false}`.
  Тип `PlanId` переезжает сюда из `purchases.ts` (чистый модуль не импортирует адаптер).
- `src/lib/backup.ts`: `SCHEMA_VERSION = 12` (комментарий: v11 → v12 — поля внутри `premium`);
  `useApp.ts` `migrate`: `premium: mergePremium(s.premium)` — доливает `plan: null`, `willRenew: false`
  старому объекту, `active`/`source`/`until` сохраняет. Бэкап не меняется (`premium` вне бэкапа).
- `src/lib/usePremiumSync.ts` (новый хук, монтируется в `app/_layout.tsx` рядом с `usePushScheduler`):
  на монтировании `init()` → `refreshEntitlement()` → `setPremium(mergeEntitlement(...))`;
  подписка `onEntitlementChange` → то же слияние; `useAppActive` → повторный refresh (правило 10:
  всё временнóе слушает AppState — истечение подписки тоже). Без SDK хук — no-op.
- DEV-тумблер настроек ставит `plan: null, willRenew: false` (тип требует).

### Пейвол `app/paywall.tsx`

- Панель «активна»: заголовок по плану — `paywall.activeYear` / `activeMonth`, без плана —
  прежний `activeTitle`; вторая строка — `willRenew ? activeUntil : activeExpires`; `source: 'dev'` —
  как было («DEV-режим»).
- Бейдж: `o.discountPct !== undefined && <PremiumBadge label={tr('paywall.discount', {pct})} solid />`.
- `run()`: `error` → `ConfirmDialog` «Не получилось»; `none` → «Подписка не найдена»;
  `cancelled` — ничего; `unavailable` — как было. Один стейт `dialog: 'unavailable'|'error'|'none'|null`
  вместо булева `unavailable`.
- «Управлять подпиской» → `manageUrl()` → `Linking.openURL`; `null` → диалог `unavailable`.
- Ссылка «Восстановить» в состоянии «скоро» уже показывается при `PURCHASES_AVAILABLE` (62) — так и есть.
- Макет `docs/design-reference.html`, `#pwOn`: подпись варианта «Действует до …» одной строкой
  (правило: задача, меняющая экран, правит макет в том же коммите).

### i18n (`src/lib/i18n.ts`, блок `paywall`, ×4)

| ключ | ru | en | es | pt |
|---|---|---|---|---|
| `activeYear` | Годовая подписка | Annual subscription | Suscripción anual | Assinatura anual |
| `activeMonth` | Месячная подписка | Monthly subscription | Suscripción mensual | Assinatura mensal |
| `activeExpires` | Действует до {{date}} | Valid until {{date}} | Válida hasta {{date}} | Válida até {{date}} |
| `discount` | −{{pct}} % | −{{pct}}% | −{{pct}} % | −{{pct}} % |
| `errorTitle` | Не получилось | Something went wrong | Algo salió mal | Algo deu errado |
| `errorText` | Магазин не ответил. Проверьте связь и попробуйте ещё раз. | The store didn't respond. Check your connection and try again. | La tienda no respondió. Revisa tu conexión e inténtalo de nuevo. | A loja não respondeu. Verifique sua conexão e tente de novo. |
| `restoreNoneTitle` | Подписка не найдена | No subscription found | No se encontró la suscripción | Assinatura não encontrada |
| `restoreNoneText` | У этого аккаунта App Store / Google Play нет активной подписки Arcanum Premium. | This App Store / Google Play account has no active Arcanum Premium subscription. | Esta cuenta de App Store / Google Play no tiene una suscripción activa de Arcanum Premium. | Esta conta da App Store / Google Play não tem uma assinatura ativa do Arcanum Premium. |

es/pt — написаны сессией, в очередь вычитки носителем (волна Cowork, вместе со строками 54/62).
`activeUntil` («Продлится {{date}}») остаётся для `willRenew === true`.

### Документы

- `docs/logic-spec.md` §14 (поля `plan`/`willRenew`, слияние, persist 12), §7 (версия 12);
  `docs/product-spec.md` §5а (поведение кнопок в сборке, диалоги, «Действует до»);
  `docs/release-checklist.md`: пункт «Подписка (53б)» → что сделано, **анкета «Безопасность данных»
  → «История покупок» (сбор, не передача третьим лицам как продавцу; цель — работа приложения;
  по гайду RevenueCat «Google Play's Data Safety»)**, ответ ревьюеру; `store-listing.md` — ответы
  анкет уже упоминают RevenueCat (57) — сверить формулировки с фактом; `site/privacy.html` и
  политика в приложении называют RevenueCat с задачи 54 — сверить, `site.test.ts` держит равенство.
- `docs/backlog.md` (53 → `[x]` после лайва), CLAUDE.md «Статус», `docs/changelog.md`,
  `docs/lessons.md` (новые ⚠️), AGENTS.md (команды `eas env:set`, проверка ключа в бандле).

## Что НЕ делаем

- Пробный период, промо-офферы, lifetime, семейный доступ, смена тарифа внутри подписки
  (год ↔ месяц покупается как новая подписка — Google сам предложит замену).
- RevenueCat Paywalls UI (`react-native-purchases-ui`), web-checkout, `expo-dev-client`.
- Платежи из РФ (RuStore) — отдельное решение после 53.
- Аналитика воронки — v1.1.
- iOS-приёмка — после аккаунта Apple, отдельным хвостом (код общий, продукты и ключ — Артём).

## Критерии приёмки (готово, когда…)

- [ ] `npm test` зелёный, `tsc` чист, `expo-doctor` 18/18; `npm install` сделан, Expo Go открывает
      приложение (Preview API Mode SDK не мешает), веб — `purchases.web.ts`, SDK в веб-бандле нет
      (грепом по бандлу: `react-native-purchases` отсутствует).
- [ ] `purchasesMap.test.ts`: `toOffers` — нет `current` → `[]`; только месячный → `[]`; пара в трёх
      валютах (₽, €, R$) → `price`/`perMonth` побайтово равны строкам фикстуры, `discountPct` = floor;
      скидка < 5 % → без бейджа; разные валюты → без бейджа; `toPremium` — активная с продлением,
      активная отменённая (`willRenew false`), истёкшая → `PREMIUM_NONE`; `until` — локальная дата;
      `planOf` на `premium:year` / `premium.year` / `$rc_monthly` / `x`; `mergeEntitlement` — все
      ветки правила 7 и локальное истечение; `purchasesAvailable` — 5 комбинаций.
- [ ] `purchases.test.ts`: `jest.mock('react-native-purchases')`; контракт «цен в коде нет»
      остаётся (строки и исходники); без ключа — заглушка (`[]`, `unavailable`, `null`); с ключом
      и моком — `purchase` мапит `userCancelled` → `cancelled`, throw → `error`, успех → `ok`;
      `restore` без права → `none`.
- [ ] `useApp.test.ts`: persisted `{premium: {active: true, source: 'dev', until: null}, version: 11}`
      → после `rehydrate()` `plan: null`, `willRenew: false`, `active` сохранён; `SCHEMA_VERSION === 12`.
- [ ] Контракт `premiumSources.test.ts` зелёный без правок периметра (`usePremiumSync` живёт в `src/lib`).
- [ ] Красный прогон: мутации `discountPercent` (округление вверх), `mergeEntitlement` (dev
      перетирается магазином), `planOf` (month → year) — каждая роняет ровно свои тесты.
- [ ] Веб 6а/6б: `scripts/check_62_web.js` зелёный без изменений (веб = «скоро»); Expo Go:
      DEV-тумблер, панель активна с «DEV-режим».
- [ ] **6в Android (Артём, устройство или эмулятор с Play Store, аккаунт — лицензионный тестер):**
      сборка `production` из ветки → внутренний трек → установка из Play; до заливки грепом по
      `index.android.bundle` внутри AAB подтверждён ключ `goog_` (доставка env в бандл).
      Сценарий: пейвол показывает два тарифа с ценами магазина (валюта аккаунта) и «≈ … в месяц»;
      бейдж «−N %» соответствует ценам; покупка месячного тестовой картой → панель «Месячная
      подписка · Продлится …», чип «✦ АКТИВНА», строка настроек «Активна ›», М3 открыт, «Ещё N»
      работает; «Управлять подпиской» открывает подписки Play; отмена там → через ≤ 5 мин после
      сворачивания/разворачивания панель «Действует до …»; после ~30 мин (шесть продлений)
      право снимается само; удалить приложение → поставить → «Восстановить покупки» → право
      вернулось; в авиарежиме приложение открывается, право прежнее, пейвол — «скоро».
- [ ] Документы по списку выше; ветка `feat/53b-revenuecat` влита после лайва; чекбокс 53 в
      бэклоге — после Android-лайва (iOS — хвост).

## План по файлам (порядок; детальный план — `docs/plans/53b-revenuecat.md`)

1. `src/lib/premium.ts` — `PlanId`, поля `plan`/`willRenew`, `PREMIUM_NONE`; `src/lib/backup.ts`
   `SCHEMA_VERSION = 12`; `src/store/useApp.ts` `mergePremium` в `migrate`; `app/settings.tsx`
   DEV-тумблер (новые поля); тесты миграции. `tsc`.
2. `src/lib/purchasesMap.ts` + `__tests__/purchasesMap.test.ts` (TDD: тесты первыми).
3. `package.json` (`react-native-purchases`), `npm install`; `.env.example`; `src/lib/purchasesEnv.ts`.
4. `src/lib/purchases.ts` (SDK) + `src/lib/purchases.web.ts`; `purchases.test.ts` переписан с моком.
5. `src/lib/usePremiumSync.ts` + монтирование в `app/_layout.tsx`.
6. `src/lib/i18n.ts` ×4; `app/paywall.tsx` (панель, бейдж, диалоги, manage); макет `#pwOn`.
7. Документы; веб-регресс `check_62_web.js`; сборка `production` → внутренний трек → 6в.
`npm install` нужен один раз (шаг 3), после него — перезапуск `npx expo start --tunnel`.

## Открытые вопросы Артёму (не блокируют код, блокируют 6в)

1. Цены: базовая страна, годовая и месячная, принять ли автопересчёт Google по странам.
2. Страны продаж подписки (по умолчанию — все страны закрытого теста, 177).
3. Второе устройство для «Восстановить» (переустановка на том же считается).
