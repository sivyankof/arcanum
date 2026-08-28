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

- [~] **RevenueCat 28.08**: аккаунт Артёма, проект `Arcanum` (id `1478061f`); мастер «Let's get
      Arcanum ready» пропущен («Go to dashboard») — он не даёт задать разные ID продуктов для Apple
      и Google и ничего не сохраняет, пока не нажат Continue; всё заведено руками: entitlement
      `premium` (`entlf5f5076e48`), приложение App Store `Arcanum (App Store)` (`appf047232a4a`,
      bundle `app.arcanum.tarot`, In-App Purchase Key `67VRFKU59T` + Issuer ID загружены), продукты
      `premium.year` / `premium.month` (App Store) привязаны к `premium`, offering `default`
      (`ofrng701668146c`) с пакетами `$rc_annual` → `premium.year`, `$rc_monthly` → `premium.month`.
      ⚠️ Файл `.p8` Playwright-браузер кладёт в `.playwright-mcp/` репозитория (папка в
      `.gitignore`, `*.p8` в `.easignore`) под именем с ДЕФИСОМ `SubscriptionKey-XXXX.p8`, а форма
      RevenueCat требует имя `SubscriptionKey_XXXX.p8` — переименовать; загрузка через
      `browser_file_upload` работает только из корня репо/`.playwright-mcp`, копии оттуда удалены,
      ключ хранится в `C:\Users\Artem\Documents\keys\` (вне репо). Play Store-приложение в
      RevenueCat — после аккаунта продавца Google.
- [ ] RevenueCat: приложение Google Play (`app.arcanum.tarot`).
      Service-account JSON для проверки покупок — по мастеру RevenueCat (Google Cloud → сервисный
      аккаунт → Play Console «Пользователи и разрешения» → финансовые данные + управление заказами).
      RTDN (Pub/Sub) — по тому же мастеру, рекомендуется, не блокирует.
- [ ] Play Console → Монетизация → Подписки: подписка `premium`, базовые планы `year` (годовой,
      автопродление) и `month` (месячный); **цены** (ориентир Артёма 27.08 — 2 890 ₽/год и 399 ₽/мес,
      см. ⚠️ ниже про валюту); без вводных предложений (решение 2); активировать.
      ⚠️ **Рубли базовой ценой поставить нельзя** (проверено 27.08 по справке Google):
      у аккаунта из Беларуси валюта разработчика — **USD**, базовая цена задаётся в долларах, остальные
      страны Google пересчитывает сама. В **России** подписки Google Play не работают вовсе (ни покупок,
      ни продлений) — рублёвая цена никому выставлена не будет. В **Беларуси** подписка внутри
      БЕСПЛАТНОГО приложения работает (блокируются платные приложения, а покупки внутри бесплатных нет),
      значит белорусы купить смогут. Пара, сохраняющая задуманную скидку 39 % (2890 / 399×12 = 0.604):
      **$4.99/мес и $35.99/год**. Утвердить у Артёма до создания продуктов.
      **Решение Артёма 28.08 — $5.99/мес и $34.99/год** (скидка 51 %, год = $2.92/мес), после
      разбора рынка: таро без ИИ в US App Store — месяц $4.99–7.99, год $29.99–44.99
      (Learn Tarot RWS $29.99, Tarot Card Meanings $39.99, Tarot Pro $44.99; Labyrinthos с ИИ
      $9.99/$89.99), медианы RevenueCat 2026: Education $9.99/$44.99, все категории год $34.80.
      Аргументы: год — главный план (59–66 % подписок в Education), при 39 % скидки год стоил
      7.2 месяца, при 51 % — 5.8; поднимать цену потом больно (согласие подписчиков Apple при
      росте >50 %), опускать легко. Страны продаж — все доступные; без триала (подтверждено).
- [ ] RevenueCat: entitlement `premium` ← продукты `premium:year`, `premium:month`; offering `default`
      (сделать current) с пакетами `$rc_annual` → `premium:year`, `$rc_monthly` → `premium:month`.
- [ ] Play Console → Настройки → Лицензионное тестирование: аккаунт Артёма (+ второй, если будет
      телефон жены) — тестовые карты вместо настоящих.
- [ ] Ключ `goog_…` из RevenueCat → `eas env:set --name EXPO_PUBLIC_RC_ANDROID_KEY --value goog_… \
      --environment production --environment preview --visibility plaintext` и та же строка в `.env`
      локально (для `expo start` она не нужна — в Expo Go SDK не конфигурируется, но `eas env:pull`
      кладёт её туда же).
- [~] Apple — после активации аккаунта: In-App Purchase Key (`.p8`) в RevenueCat, продукты
      `premium.year` / `premium.month` в ASC, ключ `appl_…` → `EXPO_PUBLIC_RC_IOS_KEY`. Отдельный
      заход, не блокирует Android. **28.08: продукты созданы** (группа `Premium`, `premium.year`
      34,99 $, `premium.month` 5,99 $, 175 стран, локализации ×4 у подписок и группы; США
      переставлены вручную — Apple уравнивает цены после налога от базовой витрины Грузии,
      подробности release-checklist п. 1). Ключ `.p8` — кнопку в ASC блокирует классификатор
      auto-режима, делает Артём или сессия в ручном режиме.
- [~] **Google Play — профиль продавца СОЗДАН 28.08 вечером** (решение Артёма после разбора,
      задача 66): платёжный профиль «Беларусь / физлицо» заведён и привязан к аккаунту, страница
      «Подписки» открылась, но требует **APK/AAB с разрешением BILLING** — запущена `production`-
      сборка с `react-native-purchases` из main → внутренний трек (AAB кладёт Артём руками).
      ⚠️ Выплаты: форма способа оплаты для белорусского профиля принимает ТОЛЬКО белорусский
      USD-счёт — Bank of Georgia (`BAGAGE22` / `GE…`) отвергнут на клиенте «Недопустимые данные»
      по SWIFT и IBAN; Wise (US/EU-реквизиты) не пройдёт так же. Продавать можно, выручка копится
      у Google; вывод — хвост задачи 66. **Сделано 28.08 вечером (решение Артёма «доводим»)**:
      [x] лицензионный тестер — список «Внутренние тестировщики» (аккаунт Артёма) в Настройки →
      Тестирование лицензий (сохранение требует подтверждения в модалке «Эти изменения затронут
      все ваши приложения»); [x] Google Cloud: проект `arcanum-play`, включён Google Play Android
      Developer API, сервисный аккаунт `revenuecat@arcanum-play.iam.gserviceaccount.com`, JSON-ключ
      сохранён в `C:\Users\Artem\Documents\keys\arcanum-play-revenuecat.json` (через
      `download.saveAs` в `browser_run_code_unsafe` — минуя `.playwright-mcp`; копия оттуда удалена);
      [x] Play Console → Пользователи и разрешения: сервисный аккаунт приглашён с правами
      «Просмотр информации о приложении», «Просмотр финансовых данных…», «Управление заказами и
      подписками» — статус «Активно» сразу; [x] RevenueCat: приложение `Arcanum (Play Store)`
      (`app58f9b33ee5`, пакет `app.arcanum.tarot`, JSON загружен `setInputFiles` из `Documents\keys`),
      продукты `premium:year` (base plan `year`, backwards compatible) и `premium:month` (`month`)
      привязаны к `premium` и к пакетам `$rc_annual`/`$rc_monthly` (Play-колонка); ключ
      `goog_APhZjlZlpcqJbfIOJmhZecvZPNa` → `eas env:set` (production + preview) и `.env`.
      ⚠️ Кнопки RevenueCat/Google Cloud/Play Console надёжнее нажимать через
      `browser_run_code_unsafe` (`page.evaluate` + JS `click()` по тексту): у MUI/Angular кнопок
      `getByRole` часто ловит невидимый дубль. **Сделано 28.08 вечером**: [x] AAB №2 `6cf48d53`
      (с ключом; в бандле `goog_`, в манифесте BILLING — проверено zipfile до заливки) → выпуск 5
      (1.0.0) во внутреннем треке (Артём); [x] подписка `premium` в Play Console: планы `year`
      (каждый год, $34.99, обратная совместимость) и `month` (каждый месяц, $5.99) — оба АКТИВНЫ,
      174 страны, льготный период 7 дней; сведения: имя `Arcanum Premium`, три преимущества
      (курс целиком / все расклады / тренажёр без лимита), описание. ⚠️ Форма «Set prices»:
      чекбокс «все страны» появляется только после кнопки «Set prices», поле цены принимает
      запятую (`34,99`), «Активировать» — на странице плана после сохранения; поля преимуществ
      и описания при добавлении переиндексируются — заполнять по списку `input, textarea` с
      проверкой после reload. Осталось: [ ] лайв Android (эмулятор с Play Store, лицензионный
      тестер), [ ] RTDN (Pub/Sub) — рекомендация RevenueCat, не блокирует.
      ⚠️ Форма платёжного профиля живёт в iframe `payments.google.com` (`merchant-sign-up-popupIframe`):
      кросс-доменный, `browser_evaluate` его не видит, снимок и клики — только через
      `iframe[name=…] >> internal:control=enter-frame >> …`; списки страны/типа — `[role=menuitem]`
      с `data-value` (`LEGAL_ENTITY_TYPE_INDIVIDUAL`, `TAX_STATUS_PERSONAL`). Существующие профили
      (покупательские, в т.ч. «Физическое лицо (Play)» с оплаты регистрации) для продавца недоступны —
      радиокнопки disabled, нужен новый.

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
- [x] **Регресс в Expo Go проверен Артёмом 27.08 ✓** («всё работает»): приложение запускается на
      ветке после `npm install`, DEV-тумблер Premium открывает М3–М6 и «Ещё N» в тренажёре, пейвол
      с правом показывает «Подписка активна · DEV-режим» и диалог «Пока недоступно» у «Управлять
      подпиской», без права — панель «Оформить подписку пока нельзя» без тарифов и кнопки покупки,
      гейты возвращаются. Это подтверждает, что ветка ничего не сломала; сами покупки в Expo Go
      недостижимы по построению (`PURCHASES_AVAILABLE === false`) — их закрывает пункт ниже.
- [x] **6в iOS — ПРОЙДЕНО 28.08 (Артём, iPhone, Sandbox-тестер, сборка `preview` `a320c6dd`):**
      пейвол показал два тарифа ценами магазина («Год · $34.99, ≈ $2.91 в месяц», «Месяц · $5.99»)
      и бейдж «−51 %», посчитанный из фактической пары; системный лист Sandbox Apple с продуктом
      `Premium — Yearly`, `USD 34.99 per year`, аккаунтом тестера и «You will not be charged» →
      «You're all set [Environment: Sandbox]» → панель «Годовая подписка · Продлится 28 августа
      2026», чип «✦ АКТИВНА», строка настроек «Arcanum Premium · Активна ›»; удалить → поставить →
      право вернулось само (синхронизация `usePremiumSync` на старте). ⚠️ Дата «Продлится» =
      сегодня — не дефект: в Sandbox год сжат до часа (месяц — до 5 минут), в продакшене 2027.
      Вторая порция 28.08: модуль 3 открыт (замок в шапке — маркер «платный», по макету остаётся при
      подписке; плашки «ПРЕМИУМ» нет; замки уроков — последовательность курса), авиарежим ✓ (право
      на месте), «Управлять подпиской» открывает системный лист подписок Apple ✓ — но в нём
      подписки НАСТОЯЩЕГО Apple ID, Sandbox-подписка там не видна (так у Apple; отмена тестовой —
      Настройки → App Store → Sandbox-аккаунт → Управлять). «Ещё N» не прогнан — нет изученных карт,
      карточка «Повторение» не появляется; гейт проверен 27.08 с DEV-правом, логика общая.
      Отмена в Sandbox (Настройки → Разработчик → Sandbox Apple Account → Управлять; на iOS 18+
      раздел живёт там, а не в App Store) прошла на стороне Apple («You have cancelled…»), но
      панель осталась «Продлится»: RevenueCat отмену НЕ получил — у покупателя «Active · renews
      in N minutes». Причина: URL App Store Server Notifications подключён в 16:00, отмена была в
      15:57, а «Восстановить покупки» перепостил ту же транзакцию без обновления статуса
      автопродления. Вывод для лайва: ветку «Действует до …» проверять на СЛЕДУЮЩЕЙ покупке —
      месячной (5-минутные циклы) с отменой уже при подключённых уведомлениях, после отмены
      выждать >5 мин (кэш CustomerInfo SDK) и перезапустить приложение. ⚠️ «Восстановить покупки»
      при успехе молчит (решение 10: успех → право в стор, диалога нет) — при неизменном праве
      тап выглядит как «не кликается»; кандидат на хаптик/короткий тост, отдельная мелкая задача. ⚠️ Раздел «Sandbox-аккаунт» в Настройках → App Store
      iPhone появляется только ПОСЛЕ первой попытки покупки в не-App-Store-сборке — до неё его нет,
      креды тестера вводятся прямо в системный диалог покупки.
- [ ] **6в Android — ОТЛОЖЕНО до задачи 66** (аккаунт продавца Google; Артём, устройство или эмулятор с Play Store, аккаунт — лицензионный тестер):
      сборка `production` из ветки → внутренний трек → установка из Play; до заливки грепом по
      `index.android.bundle` внутри AAB подтверждён ключ `goog_` (доставка env в бандл).
      Сценарий: пейвол показывает два тарифа с ценами магазина (валюта аккаунта) и «≈ … в месяц»;
      бейдж «−N %» соответствует ценам; покупка месячного тестовой картой → панель «Месячная
      подписка · Продлится …», чип «✦ АКТИВНА», строка настроек «Активна ›», М3 открыт, «Ещё N»
      работает; «Управлять подпиской» открывает подписки Play; отмена там → через ≤ 5 мин после
      сворачивания/разворачивания панель «Действует до …»; после ~30 мин (шесть продлений)
      право снимается само; удалить приложение → поставить → «Восстановить покупки» → право
      вернулось; в авиарежиме приложение открывается, право прежнее, пейвол — «скоро».
- [ ] **Ветки, недостижимые ни в вебе, ни в Expo Go** (`PURCHASES_AVAILABLE=false` там всегда) —
      проверяются ТОЛЬКО на живом магазине внутри сценария 6в выше, отдельно отметить каждую:
      панель «Годовая подписка» и панель «Месячная подписка» (реальный `premium.plan` из магазина,
      не DEV-нейтральный заголовок); строка «Действует до …» у отменённой, но ещё не истёкшей
      подписки (`willRenew: false` при `active: true`); диалог «Не получилось» (магазин не ответил
      на покупку/восстановление); диалог «Подписка не найдена» (восстановление без покупки на
      аккаунте); открытие страницы подписок магазина по «Управлять подпиской».
- [ ] В целевых странах у подписки доступны ОБА базовых плана: витрина требует пару (`toOffers`
      отдаёт `[]`, если нет годового или месячного), и в стране с одним планом пользователь
      увидел бы «скоро» вместо покупаемого тарифа.
- [ ] Бессрочное промо-право, выданное из консоли RevenueCat (`until` пустой): панель обязана
      сказать «Подписка активна» (`paywall.activeTitle`), а не «DEV-режим» (правка финального
      ревью — панель различает `source`, а не наличие даты).
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

1. ~~Цены: базовая страна, годовая и месячная, принять ли автопересчёт Google по странам.~~
   **Решено 28.08**: USD, $5.99/мес и $34.99/год, автопересчёт магазинов по странам принят.
2. ~~Страны продаж подписки (по умолчанию — все страны закрытого теста, 177).~~ **Решено 28.08**: все доступные.
3. Второе устройство для «Восстановить» (переустановка на том же считается).

## Отчёт: задачи 1–6 (код) и 7 (документы, веб-регресс) — 27.08.2026

Реализация шла по `docs/plans/53b-revenuecat.md`, задачи 1–6 плана — девять коммитов (часть задач
вышла в 2–3 коммита из-за фикса ревью между ними): `731ff7e` (1), `4016800` (2), `4fb8f47`/`fca9d72`
(3), `dd13510`/`553787f`/`45ea84e` (4), `bee41fe` (5), `94feb46` (6), плюс докс-правка `34683c0`
до начала этой задачи. Диапазон `731ff7e^..34683c0`: 26 файлов, +970/−105 строк.

**Что сделано (шаги 1–3 задачи 7 — сделал я; шаги 4–7 ниже — предстоящие, не мои):**
- `src/lib/premium.ts`: `PlanId`, поля `plan`/`willRenew`, обновлённый `PREMIUM_NONE`,
  `mergePremium`. Persist **12**, `SCHEMA_VERSION` в `src/lib/backup.ts`. `parseBackup` не тронут —
  `premium` в бэкап не входит, дублировать миграцию некуда.
- `src/lib/purchasesMap.ts` (новый чистый модуль, TDD) — `purchasesAvailable`, `discountPercent`,
  `toOffers`, `planOf`, `toPremium`, `mergeEntitlement`, `samePremium`, `Offer`.
- `react-native-purchases@^10.8.0` (Play Billing 8.3), ключи `EXPO_PUBLIC_RC_*`, `.env.example`
  (коммитится, но исключён из архива EAS отдельной строкой — не ослабляет детектор секретов).
- `src/lib/purchases.ts` переписан на SDK (единственный импорт пакета в проекте), парная
  `src/lib/purchases.web.ts`; `PurchaseResult` с причиной `'none'`; `init`/`onEntitlementChange`/
  `manageUrl`. Контракт `purchasesWeb.test.ts` — сигнатуры пары по именам/типам/арности
  (`tsc` эту пару не проверяет, `moduleSuffixes` в конфиге нет).
- `src/lib/usePremiumSync.ts` — синхронизация на старте, возврате из фона (`useAppActive`) и push
  SDK; подключён в `app/_layout.tsx`.
- `app/paywall.tsx` — тариф и продление/истечение из магазина, бейдж скидки из цен, четыре исхода
  покупки/восстановления через `DIALOG_TEXT`, «Управлять подпиской» → `manageUrl()`. Семь новых
  ключей ×4 языка. Макет `docs/design-reference.html` правлен под `#pwOn`.

**Тесты:** было **1860 в 48 сьютах** (задача 63, 26.08) → **49 сьютов** к моменту старта ветки
53б (между 63 и 53б на `main` легла задача 64 — она добавила один новый сьют
`androidPermissions.test.ts`, проверено `git log --follow` на этот файл) → **1917 в 52 сьютах**
сейчас: три НОВЫХ сьюта задач 2–4 плана (`purchasesMap.test.ts` 31 кейс, `purchasesEnv.test.ts` 5,
`purchasesWeb.test.ts` 4; 49 + 3 = 52, сходится) плюс `purchases.test.ts` ПЕРЕПИСАН на мок SDK
(не новый файл — 11 своих кейсов адаптера поверх унаследованного контракта «цен в коде нет»,
который теперь считает и три новых модуля в периметре), плюс точечные правки `premium.test.ts`,
`backup.test.ts`, `useApp.test.ts` (гидрация версии 11→12: файл без `plan`/`willRenew` получает
дефолты, красный без `mergePremium` — `toEqual` не прощает `null` против отсутствующего ключа).
`npx tsc --noEmit` чист, `python scripts/check_easignore.py` (под `PYTHONIOENCODING=utf-8` —
иначе `UnicodeEncodeError` на «≈» в cp1251-консоли) — 308 файлов / 31.8 МБ в архиве, секретов
не утекает.

**Веб-регресс задачи 7 (27.08, dev-сервер `--clear`):**

| проверка | результат |
|---|---|
| `scripts/check_62_web.js` (без правок сценария) | **58 из 58**, ошибок в консоли 0 |
| SDK в веб-бандле (`node_modules/react-native-purchases` в `entry.bundle?platform=web`) | **0 вхождений** (2 вхождения голого имени пакета — обе внутри русского комментария `purchases.web.ts`, не в коде) |

Веб-поведение задачи 62 («скоро», без цен, без SDK) не изменилось — что и требовалось: RevenueCat
подключается только там, где есть натив, ключ и не Expo Go.

**Что отложено (не входит в шаги 1–3, порядок — Артём):** RevenueCat-аккаунт, продукты
`premium`/`year`/`month` и цены в App Store Connect/Google Play Console, лицензионный тестер,
`eas env:set` для `production`/`preview`, `production`-сборка с ключом, лайв 6в по сценарию выше
(включая ветки экрана, недостижимые без живого магазина — годовая/месячная панель, «Действует
до …», оба диалога ответа магазина, переход на страницу подписок), слияние ветки в `main`.
Анкету Data Safety Google Play переписать ДО отправки сборки с SDK в любой трек — см.
`docs/release-checklist.md`.
