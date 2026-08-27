# План реализации 53б · RevenueCat за готовым правом Premium

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ САБ-СКИЛЛ — superpowers:subagent-driven-development
> (рекомендуется) или superpowers:executing-plans, задача за задачей. Шаги — чекбоксы `- [ ]`.

**Цель:** в сборке из Google Play / App Store пейвол показывает цены магазина, покупает, восстанавливает
и синхронизирует право `premium`; в Expo Go и вебе поведение задачи 62 («скоро») не меняется.

**Архитектура:** `react-native-purchases` импортируется ровно в одном файле — `src/lib/purchases.ts`
(веб — `purchases.web.ts`-заглушка). Все преобразования ответов магазина — чистый `purchasesMap.ts`
под юнитами на фикстурах. Право живёт в сторе (`premium`, persist 12), магазин — его источник через
хук `usePremiumSync` (старт, возврат из фона, push SDK). Ключи — `EXPO_PUBLIC_RC_*` из EAS env.

**Стек:** Expo SDK 54 (НЕ обновлять), RN 0.81, `react-native-purchases` ^10.8.0 (Play Billing 8.3),
zustand/persist, jest-expo, expo-router.

**Спека:** `docs/specs/53b-revenuecat.md` — план аргументирует от неё; читать обе.

## Глобальные ограничения

- SDK 54 не трогать; мажорные версии пакетов не менять; единственный новый пакет — `react-native-purchases@^10.8.0`.
- Ни одной цены и ни одного знака валюты в `src/**`, `app/**` и строках i18n (контракт `purchases.test.ts`).
- Ни одного идентификатора продукта магазина в коде: пакеты — `offering.annual` / `offering.monthly`, право — entitlement `premium`.
- Цвета только из `src/theme/theme.ts`; комментарии в коде — русские; после каждого шага `npx tsc --noEmit`.
- Стейджить поимённо (`git add <путь>`), не `-A`; коммиты по-русски, без служебных трейлеров.
- Ветка `feat/53b-revenuecat` от `main`; `npm install` — один раз в задаче 3, после него Артёму нужен перезапуск `npx expo start --tunnel`.
- Веб-проверка: dev-сервер заново с `--clear` (появляется `purchases.web.ts`); Playwright по рецепту AGENTS.md.
- Тест обязан краснеть на сломанном коде: каждая задача с юнитами содержит шаг красного прогона.

---

### Задача 0: ветка

- [ ] **Шаг 1:** `git checkout main && git pull && git checkout -b feat/53b-revenuecat`
- [ ] **Шаг 2:** `npm test 2>&1 | tail -5` → все сьюты зелёные (ориентир 27.08: 1860+ тестов, 48+ сьютов); `npx tsc --noEmit` — пусто.

---

### Задача 1: `PremiumState.plan`/`willRenew`, persist 12, `mergePremium`

**Файлы:**
- Modify: `src/lib/premium.ts:8-16`
- Modify: `src/lib/backup.ts:30-36` (`SCHEMA_VERSION`)
- Modify: `src/store/useApp.ts:14,401-413` (`migrate`)
- Modify: `src/lib/purchases.ts:20` (`PlanId` переезжает в `premium.ts`)
- Modify: `app/settings.tsx:483` (DEV-тумблер)
- Modify: `src/lib/__tests__/premium.test.ts:16`
- Test: `src/store/__tests__/useApp.test.ts`

**Интерфейсы:**
- Produces: `type PlanId = 'year' | 'month'`; `PremiumState = {active, source, until, plan: PlanId | null, willRenew: boolean}`;
  `PREMIUM_NONE`; `mergePremium(saved: unknown): PremiumState`; `SCHEMA_VERSION === 12`.

- [ ] **Шаг 1: падающий тест миграции.** В `src/store/__tests__/useApp.test.ts` добавить импорт
  `import { SCHEMA_VERSION } from '../../lib/backup';` и после первого `describe`:

```ts
describe('useApp — гидрация persist версии 12 (спека 53б)', () => {
  it('файл версии 11 с premium без plan/willRenew получает plan: null, willRenew: false, остальное сохраняет', async () => {
    await AsyncStorage.setItem(
      'arcanum-app',
      JSON.stringify({ state: { premium: { active: true, source: 'dev', until: null } }, version: 11 }),
    );
    await useApp.persist.rehydrate();
    // toEqual НЕ прощает null против отсутствующего ключа — без mergePremium тест красный
    expect(useApp.getState().premium).toEqual({ active: true, source: 'dev', until: null, plan: null, willRenew: false });
  });

  it('версия схемы поднята до 12', () => {
    expect(SCHEMA_VERSION).toBe(12);
  });
});
```

- [ ] **Шаг 2:** `npx jest src/store/__tests__/useApp.test.ts` → FAIL: два новых теста (plan отсутствует; `SCHEMA_VERSION` 11).

- [ ] **Шаг 3: `src/lib/premium.ts`** — заменить блок типов (строки 8–16) на:

```ts
export type PremiumSource = 'none' | 'dev' | 'store';
/** Тариф подписки. Тип живёт здесь (чистый модуль), адаптер покупок его реэкспортирует. */
export type PlanId = 'year' | 'month';
export interface PremiumState {
  active: boolean;
  /** откуда право: магазин (53б), DEV-тумблер настроек, нет права */
  source: PremiumSource;
  /** конец оплаченного периода ЛОКАЛЬНОЙ датой YYYY-MM-DD (formatFullDate другой формы не разбирает);
   *  у dev/none — null */
  until: string | null;
  /** тариф из магазина (53б); у dev/none — null */
  plan: PlanId | null;
  /** продление включено (магазин); у отменённой, но действующей — false; у dev/none — false */
  willRenew: boolean;
}
export const PREMIUM_NONE: PremiumState = { active: false, source: 'none', until: null, plan: null, willRenew: false };

/** Доливка сохранённого `premium` версий ≤ 11 (без plan/willRenew): persist сливает состояние
 *  только по верхнему уровню ключей (ловушка 06а), поля внутри объекта дописываем руками. */
export function mergePremium(saved: unknown): PremiumState {
  if (typeof saved !== 'object' || saved === null) return PREMIUM_NONE;
  return { ...PREMIUM_NONE, ...(saved as Partial<PremiumState>) };
}
```

- [ ] **Шаг 4: `src/lib/backup.ts`** — комментарий и константа:

```ts
/** Версия персистуемой схемы (logic-spec §7). Единственный источник: стор берёт её отсюда.
 *  v8 → v9 (спека 36): `spreadsHistory` — ключ верхнего уровня, дефолт `[]` доливается сам.
 *  v9 → v10 (спека 45): `srs` и `reviewDay` — ключи верхнего уровня, дефолты доливаются сами.
 *  v10 → v11 (спека 53): doneCount ВНУТРИ reviewDay — слияние руками (mergeReviewDay) в migrate
 *  и тут; premium — ключ стора ВНЕ бэкапа.
 *  v11 → v12 (спека 53б): plan и willRenew ВНУТРИ premium — слияние руками (mergePremium) в migrate;
 *  parseBackup не трогается — premium в файл бэкапа не входит (решение 4 спеки 53). */
export const SCHEMA_VERSION = 12;
```

- [ ] **Шаг 5: `src/store/useApp.ts`** — импорт `import { mergePremium, PREMIUM_NONE, type PremiumState } from '../lib/premium';`;
  в комментарий истории версий перед `version: SCHEMA_VERSION` добавить строку
  `// v11 → v12: plan и willRenew ВНУТРИ premium (спека 53б) — слияние руками (mergePremium).`;
  `migrate`:

```ts
      migrate: (persistedState) => {
        const s = (persistedState ?? {}) as Partial<AppState>;
        return {
          ...s,
          settings: mergeSettings(s.settings),
          reviewDay: mergeReviewDay(s.reviewDay),
          premium: mergePremium(s.premium),
        } as AppState;
      },
```

- [ ] **Шаг 6: `src/lib/purchases.ts`** — строку `export type PlanId = 'year' | 'month';` заменить на
  `import type { PlanId, PremiumState } from './premium';` (объединить с существующим импортом) и
  `export type { PlanId };` — пейвол продолжает импортировать `PlanId` из адаптера.

- [ ] **Шаг 7: `app/settings.tsx`** — импорт `import { PREMIUM_NONE } from '../src/lib/premium';`; DEV-тумблер:

```tsx
                onPress={() => setPremium(premium.active ? PREMIUM_NONE : { ...PREMIUM_NONE, active: true, source: 'dev' })}
```

- [ ] **Шаг 8: `src/lib/__tests__/premium.test.ts:16`** — `const ACTIVE: PremiumState = { ...PREMIUM_NONE, active: true, source: 'dev' };`
  (если `tsc` укажет на `backup.test.ts:328` — литерал там дополнить `plan: null, willRenew: false`).

- [ ] **Шаг 9:** `npx tsc --noEmit` — пусто; `npm test` — зелёный, +2 теста.

- [ ] **Шаг 10: коммит.**
```bash
git add src/lib/premium.ts src/lib/backup.ts src/store/useApp.ts src/lib/purchases.ts app/settings.tsx src/lib/__tests__/premium.test.ts src/store/__tests__/useApp.test.ts
git commit -m "feat: plan/willRenew в PremiumState, persist 12 с mergePremium (spec 53б)"
```

---

### Задача 2: чистые преобразования `purchasesMap.ts` (TDD)

**Файлы:**
- Create: `src/lib/purchasesMap.ts`
- Test: `src/lib/__tests__/purchasesMap.test.ts`

**Интерфейсы:**
- Consumes: `PlanId`, `PremiumState`, `PREMIUM_NONE` (задача 1); `localDateISO` из `src/lib/dates.ts`.
- Produces: `Offer`, `ProductLike`, `PackageLike`, `OfferingLike`, `EntitlementLike`, `CustomerInfoLike`,
  `ENTITLEMENT_ID`, `MIN_DISCOUNT_PCT`, `purchasesAvailable`, `discountPercent`, `toOffers`, `planOf`,
  `toPremium`, `mergeEntitlement`, `samePremium`.

- [ ] **Шаг 1: тесты первыми** — `src/lib/__tests__/purchasesMap.test.ts`:

```ts
/** Преобразования ответов магазина (спека 53б). Фикстуры — структурные, без типов SDK.
 *  Цены в фикстурах законны: файл лежит в __tests__, периметр контракта «цен в коде нет»
 *  (purchases.test.ts) каталоги тестов обходит. */
import { PREMIUM_NONE, type PremiumState } from '../premium';
import {
  discountPercent,
  mergeEntitlement,
  planOf,
  purchasesAvailable,
  samePremium,
  toOffers,
  toPremium,
  type CustomerInfoLike,
  type OfferingLike,
  type ProductLike,
} from '../purchasesMap';

const product = (over: Partial<ProductLike>): ProductLike => ({
  identifier: 'premium:month',
  price: 399,
  priceString: '399,00 ₽',
  currencyCode: 'RUB',
  pricePerMonth: 399,
  pricePerMonthString: '399,00 ₽',
  ...over,
});
const offering = (annual: ProductLike | null, monthly: ProductLike | null): OfferingLike => ({
  annual: annual && { product: annual },
  monthly: monthly && { product: monthly },
});
const YEAR_RUB = product({ identifier: 'premium:year', price: 2890, priceString: '2 890,00 ₽', pricePerMonth: 240.83, pricePerMonthString: '240,83 ₽' });
const MONTH_RUB = product({});
const YEAR_EUR = product({ identifier: 'premium:year', price: 29.99, priceString: '29,99 €', currencyCode: 'EUR', pricePerMonth: 2.5, pricePerMonthString: '2,50 €' });
const MONTH_EUR = product({ price: 4.99, priceString: '4,99 €', currencyCode: 'EUR', pricePerMonth: 4.99, pricePerMonthString: '4,99 €' });
const YEAR_BRL = product({ identifier: 'premium:year', price: 89.9, priceString: 'R$ 89,90', currencyCode: 'BRL', pricePerMonth: 7.49, pricePerMonthString: 'R$ 7,49' });
const MONTH_BRL = product({ price: 12.9, priceString: 'R$ 12,90', currencyCode: 'BRL', pricePerMonth: 12.9, pricePerMonthString: 'R$ 12,90' });

const info = (e: { productIdentifier: string; expirationDate: string | null; willRenew: boolean } | null): CustomerInfoLike => ({
  entitlements: { active: e ? { premium: e } : {} },
});

describe('purchasesAvailable', () => {
  it.each([
    ['android', false, 'goog_x', true],
    ['ios', false, 'appl_x', true],
    ['web', false, 'goog_x', false],
    ['android', true, 'goog_x', false], // Expo Go: configure с боевым ключом бросает
    ['android', false, undefined, false],
    ['android', false, '', false],
  ])('%s, expoGo=%s, key=%s → %s', (platform, expoGo, apiKey, want) => {
    expect(purchasesAvailable({ platform, expoGo, apiKey })).toBe(want);
  });
});

describe('discountPercent — из чисел магазина, вниз, не меньше порога', () => {
  it('2890/год против 399/мес → 39 (не 40: 240.83/399 = 0.6036 → 39.6 → floor)', () => {
    expect(discountPercent(240.83, 399, true)).toBe(39);
  });
  it('нет пары или валюты разные → undefined', () => {
    expect(discountPercent(null, 399, true)).toBeUndefined();
    expect(discountPercent(240.83, null, true)).toBeUndefined();
    expect(discountPercent(240.83, 399, false)).toBeUndefined();
    expect(discountPercent(240.83, 0, true)).toBeUndefined();
  });
  it('меньше 5 % — бейдж не рисуется', () => {
    expect(discountPercent(96, 100, true)).toBeUndefined(); // ровно 4
    expect(discountPercent(95, 100, true)).toBe(5);
  });
});

describe('toOffers — только строки магазина', () => {
  it('нет current → []', () => {
    expect(toOffers(null)).toEqual([]);
  });
  it('без годового или без месячного → [] (экрану нужна пара)', () => {
    expect(toOffers(offering(null, MONTH_RUB))).toEqual([]);
    expect(toOffers(offering(YEAR_RUB, null))).toEqual([]);
  });
  it.each([
    ['RUB', YEAR_RUB, MONTH_RUB, 39],
    ['EUR', YEAR_EUR, MONTH_EUR, 49],
    ['BRL', YEAR_BRL, MONTH_BRL, 41],
  ])('%s: год первым, price/perMonth побайтово из магазина, скидка из чисел', (_c, y, m, pct) => {
    expect(toOffers(offering(y, m))).toEqual([
      { id: 'year', price: y.priceString, perMonth: y.pricePerMonthString, discountPct: pct },
      { id: 'month', price: m.priceString },
    ]);
  });
  it('разные валюты в паре → без бейджа, perMonth остаётся', () => {
    const [year] = toOffers(offering(YEAR_EUR, MONTH_RUB));
    expect(year.discountPct).toBeUndefined();
    expect(year.perMonth).toBe('2,50 €');
  });
  it('магазин не дал pricePerMonthString → perMonth отсутствует (сами не делим)', () => {
    const [year] = toOffers(offering({ ...YEAR_RUB, pricePerMonthString: null }, MONTH_RUB));
    expect('perMonth' in year).toBe(false);
  });
});

describe('planOf', () => {
  it.each([
    ['premium:year', 'year'],
    ['premium.year', 'year'],
    ['$rc_annual', 'year'],
    ['premium:month', 'month'],
    ['$rc_monthly', 'month'],
    ['premium_lifetime', null],
  ])('%s → %s', (id, want) => {
    expect(planOf(id)).toBe(want);
  });
});

describe('toPremium', () => {
  it('активная с продлением → store/year, until — локальная дата', () => {
    expect(toPremium(info({ productIdentifier: 'premium:year', expirationDate: '2027-09-22T12:00:00Z', willRenew: true }))).toEqual({
      active: true, source: 'store', until: '2027-09-22', plan: 'year', willRenew: true,
    });
  });
  it('отменённая, но действующая → willRenew false', () => {
    expect(toPremium(info({ productIdentifier: 'premium:month', expirationDate: '2026-09-27T12:00:00Z', willRenew: false }))).toEqual({
      active: true, source: 'store', until: '2026-09-27', plan: 'month', willRenew: false,
    });
  });
  it('права нет → PREMIUM_NONE (магазин ответил: не куплено)', () => {
    expect(toPremium(info(null))).toBe(PREMIUM_NONE);
  });
  it('без даты окончания (lifetime у магазина) → until null, право есть', () => {
    expect(toPremium(info({ productIdentifier: 'x', expirationDate: null, willRenew: false })).until).toBeNull();
  });
});

describe('mergeEntitlement — правило 7 спеки', () => {
  const STORE_ACTIVE: PremiumState = { active: true, source: 'store', until: '2027-09-22', plan: 'year', willRenew: true };
  const DEV: PremiumState = { ...PREMIUM_NONE, active: true, source: 'dev' };
  it('магазин активен → состояние магазина', () => {
    expect(mergeEntitlement(PREMIUM_NONE, STORE_ACTIVE, '2026-08-27')).toBe(STORE_ACTIVE);
  });
  it('магазин неактивен, было store → NONE', () => {
    expect(mergeEntitlement(STORE_ACTIVE, PREMIUM_NONE, '2026-08-27')).toBe(PREMIUM_NONE);
  });
  it('DEV-право магазин не перетирает', () => {
    expect(mergeEntitlement(DEV, PREMIUM_NONE, '2026-08-27')).toBe(DEV);
    expect(mergeEntitlement(DEV, null, '2026-08-27')).toBe(DEV);
  });
  it('SDK не ответил (null): store-право живёт до until, после — NONE', () => {
    expect(mergeEntitlement(STORE_ACTIVE, null, '2027-09-22')).toBe(STORE_ACTIVE);
    expect(mergeEntitlement(STORE_ACTIVE, null, '2027-09-23')).toBe(PREMIUM_NONE);
    expect(mergeEntitlement(PREMIUM_NONE, null, '2027-09-23')).toBe(PREMIUM_NONE);
  });
});

describe('samePremium', () => {
  it('сравнивает по полям, не по ссылке', () => {
    expect(samePremium(PREMIUM_NONE, { ...PREMIUM_NONE })).toBe(true);
    expect(samePremium(PREMIUM_NONE, { ...PREMIUM_NONE, willRenew: true })).toBe(false);
  });
});
```

- [ ] **Шаг 2:** `npx jest src/lib/__tests__/purchasesMap.test.ts` → FAIL «Cannot find module '../purchasesMap'».

- [ ] **Шаг 3: `src/lib/purchasesMap.ts`:**

```ts
/** Чистые преобразования ответов магазина в типы приложения (спека 53б). Ни SDK, ни react —
 *  всё под юнитами на фикстурах. Структурные типы *Like повторяют только нужные поля
 *  react-native-purchases (PurchasesOffering / CustomerInfo подходят им без кастов), чтобы
 *  тесты и веб-заглушка не тащили типы нативного пакета.
 *
 *  Правило спеки 53 «Цены и валюта»: строки цен (`priceString`, `pricePerMonthString`) отдаёт
 *  магазин уже отформатированными в валюте аккаунта покупателя — здесь их не собирают, не делят
 *  и не конвертируют (у Hermes урезанный ICU, урок hf-02). Считается только ПРОЦЕНТ скидки —
 *  из чисел, вниз, и только при полной паре в одной валюте: ценовые уровни по странам
 *  непропорциональны, константа «−40 %» в части регионов врала бы. */
import { localDateISO } from './dates';
import { PREMIUM_NONE, type PlanId, type PremiumState } from './premium';

export interface Offer {
  id: PlanId;
  /** строка магазина, как есть */
  price: string;
  /** «в пересчёте на месяц» — только у годового и только если магазин прислал строку */
  perMonth?: string;
  /** процент скидки годового против месячного ×12; нет — бейдж не рисуется */
  discountPct?: number;
}

export interface ProductLike {
  identifier: string;
  price: number;
  priceString: string;
  currencyCode: string;
  pricePerMonth: number | null;
  pricePerMonthString: string | null;
}
export interface PackageLike {
  product: ProductLike;
}
export interface OfferingLike {
  annual: PackageLike | null;
  monthly: PackageLike | null;
}
export interface EntitlementLike {
  productIdentifier: string;
  expirationDate: string | null;
  willRenew: boolean;
}
export interface CustomerInfoLike {
  entitlements: { active: Record<string, EntitlementLike> };
}

/** Идентификатор права в RevenueCat — единственная константа каталога в коде. */
export const ENTITLEMENT_ID = 'premium';
/** Ниже этого процента бейдж скидки не рисуется: «−2 %» — шум, не аргумент. */
export const MIN_DISCOUNT_PCT = 5;

/** Живой магазин есть только в нативной сборке с ключом. В Expo Go SDK переходит в Preview API
 *  Mode, но `configure` с боевым ключом бросает — поэтому Expo Go считается «магазина нет». */
export function purchasesAvailable(p: { platform: string; expoGo: boolean; apiKey: string | undefined }): boolean {
  return (p.platform === 'ios' || p.platform === 'android') && !p.expoGo && !!p.apiKey;
}

export function discountPercent(
  annualPerMonth: number | null,
  monthlyPrice: number | null,
  sameCurrency: boolean,
): number | undefined {
  if (!sameCurrency || annualPerMonth === null || monthlyPrice === null) return undefined;
  if (!(annualPerMonth > 0) || !(monthlyPrice > 0)) return undefined;
  const pct = Math.floor((1 - annualPerMonth / monthlyPrice) * 100);
  return pct >= MIN_DISCOUNT_PCT ? pct : undefined;
}

/** Предложения экрана: годовой первым (экран выбирает его по умолчанию), затем месячный.
 *  Нет пары — нет витрины: экран покажет «скоро», а не половину тарифов. */
export function toOffers(offering: OfferingLike | null): Offer[] {
  const annual = offering?.annual?.product;
  const monthly = offering?.monthly?.product;
  if (!annual || !monthly) return [];
  const year: Offer = { id: 'year', price: annual.priceString };
  if (annual.pricePerMonthString) year.perMonth = annual.pricePerMonthString;
  const pct = discountPercent(annual.pricePerMonth, monthly.price, annual.currencyCode === monthly.currencyCode);
  if (pct !== undefined) year.discountPct = pct;
  return [year, { id: 'month', price: monthly.priceString }];
}

/** Тариф по идентификатору продукта: Google `premium:year`, Apple `premium.year`, пакет `$rc_annual`. */
export function planOf(productIdentifier: string): PlanId | null {
  if (/year|annual/i.test(productIdentifier)) return 'year';
  if (/month/i.test(productIdentifier)) return 'month';
  return null;
}

/** Право из ответа магазина. Нет активного entitlement → PREMIUM_NONE (это «ответил: не куплено»,
 *  а не «не ответил» — за второе отвечает null у refreshEntitlement в адаптере). `until` —
 *  локальная дата: formatFullDate разбирает только YYYY-MM-DD. */
export function toPremium(info: CustomerInfoLike): PremiumState {
  const e = info.entitlements.active[ENTITLEMENT_ID];
  if (!e) return PREMIUM_NONE;
  return {
    active: true,
    source: 'store',
    until: e.expirationDate ? localDateISO(new Date(e.expirationDate)) : null,
    plan: planOf(e.productIdentifier),
    willRenew: e.willRenew,
  };
}

/** Слияние ответа магазина с правом в сторе (спека 53б, решение 7): DEV-право магазин не трогает;
 *  ответ есть — он и есть правда; ответа нет (SDK бросил) — store-право доживает до `until`,
 *  дальше снимается локально (при следующем удачном ответе вернётся, если продлилось). */
export function mergeEntitlement(current: PremiumState, fromStore: PremiumState | null, todayISO: string): PremiumState {
  if (current.source === 'dev') return current;
  if (fromStore !== null) return fromStore;
  const expired = current.source === 'store' && current.until !== null && current.until < todayISO;
  return expired ? PREMIUM_NONE : current;
}

/** Равенство по полям — чтобы синхронизация не писала в persist одно и то же на каждом старте. */
export function samePremium(a: PremiumState, b: PremiumState): boolean {
  return a.active === b.active && a.source === b.source && a.until === b.until && a.plan === b.plan && a.willRenew === b.willRenew;
}
```

- [ ] **Шаг 4:** `npx jest src/lib/__tests__/purchasesMap.test.ts` → PASS; `npx tsc --noEmit` — пусто.

- [ ] **Шаг 5: красный прогон (мутации, каждую откатить):**
  - `Math.floor` → `Math.round` в `discountPercent` → падает «→ 39».
  - в `mergeEntitlement` убрать первую строку (`dev`) → падают «DEV-право магазин не перетирает».
  - в `planOf` поменять порядок веток на `month` первым → «$rc_annual» остаётся зелёным, но
    `premium:month`… не падает — значит мутация слепая; вместо неё: `/month/i` → `/year/i` → падают
    `premium:month`, `$rc_monthly` и «отменённая → month».
  Ожидание: каждая мутация роняет ровно свои тесты; зелёный на мутации = ошибка в тесте, чинить тест.

- [ ] **Шаг 6: коммит.**
```bash
git add src/lib/purchasesMap.ts src/lib/__tests__/purchasesMap.test.ts
git commit -m "feat: чистые преобразования ответов магазина purchasesMap + тесты (spec 53б)"
```

---

### Задача 3: пакет, `.env.example`, `purchasesEnv.ts`

**Файлы:**
- Modify: `package.json:49` (dependencies)
- Create: `.env.example`
- Create: `src/lib/purchasesEnv.ts`

**Интерфейсы:**
- Produces: `apiKey(): string | undefined`, `isExpoGo(): boolean`, `platform: string`.

- [ ] **Шаг 1: `package.json`** — в `dependencies` после `"react-native-gesture-handler": "~2.28.0",` вставить
  `"react-native-purchases": "^10.8.0",`.

- [ ] **Шаг 2:** `npm install` → в `package-lock.json` появился `react-native-purchases` 10.8.x с
  `@revenuecat/purchases-typescript-internal`; `npx expo-doctor` → 18/18 (пакет не в списке
  совместимости Expo — предупреждения о версии быть не должно; если появилось «unknown package» —
  это не ошибка, зафиксировать в отчёте).

- [ ] **Шаг 3: `.env.example`** (коммитится, значений нет):

```
# Публичные SDK-ключи RevenueCat (спека 53б): RevenueCat → Project → API keys.
# Локально — скопировать в .env (в .gitignore и .easignore); для сборок EAS —
#   eas env:set --name EXPO_PUBLIC_RC_ANDROID_KEY --value goog_… --environment production --environment preview --visibility plaintext
# Ключа нет → PURCHASES_AVAILABLE=false → пейвол показывает «скоро» (не падает).
EXPO_PUBLIC_RC_ANDROID_KEY=
EXPO_PUBLIC_RC_IOS_KEY=
```

- [ ] **Шаг 4: `src/lib/purchasesEnv.ts`:**

```ts
/** Окружение адаптера покупок (спека 53б): ключ SDK по платформе и признак Expo Go. Отдельный
 *  файл, чтобы purchasesMap.ts оставался чистым, а purchases.ts в тестах мокал только этот модуль.
 *  ⚠️ EXPO_PUBLIC_* подставляет Metro при сборке бандла ТОЛЬКО в буквальном виде
 *  `process.env.ИМЯ` — динамический `process.env[name]` останется undefined в сборке. */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

export const platform: string = Platform.OS;

export function apiKey(): string | undefined {
  const key = Platform.OS === 'android' ? process.env.EXPO_PUBLIC_RC_ANDROID_KEY : process.env.EXPO_PUBLIC_RC_IOS_KEY;
  return key ? key : undefined;
}

/** Expo Go: SDK переходит в Preview API Mode, а `configure` с боевым ключом бросает — там магазина нет. */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}
```

- [ ] **Шаг 5:** `npx tsc --noEmit` — пусто; `python scripts/check_easignore.py` — код 0, `.env` в списке
  исключённых, `.env.example` — в архиве (это норма: значений в нём нет).

- [ ] **Шаг 6: коммит.**
```bash
git add package.json package-lock.json .env.example src/lib/purchasesEnv.ts
git commit -m "feat: react-native-purchases 10.8, ключи через EXPO_PUBLIC_RC_* (spec 53б)"
```
Сказать Артёму: **менялся `package.json` — нужен `npm install` и перезапуск `npx expo start --tunnel`.**

---

### Задача 4: адаптер `purchases.ts` на SDK, веб-заглушка, тесты с моком

**Файлы:**
- Modify: `src/lib/purchases.ts` (переписать целиком)
- Create: `src/lib/purchases.web.ts`
- Modify: `src/lib/__tests__/purchases.test.ts:1-79` (первый describe и импорты; блок «цены не зашиты» не трогать)
- Modify: `app/paywall.tsx:176` (бейдж: `discount` → `discountPct`) и `src/lib/i18n.ts` (ключ `paywall.discount` ×4)

**Интерфейсы:**
- Consumes: `purchasesEnv` (задача 3), `purchasesMap` (задача 2), `PlanId`/`PremiumState` (задача 1).
- Produces: `PURCHASES_AVAILABLE: boolean`, `PurchaseResult`, `init()`, `getOffers()`, `purchase(id)`,
  `restore()`, `refreshEntitlement()`, `onEntitlementChange(cb): () => void`, `manageUrl()`;
  реэкспорт `PlanId`, `Offer`.

- [ ] **Шаг 1: тесты.** В `src/lib/__tests__/purchases.test.ts` заменить докстроку-шапку (первые 20 строк
  до `import fs`) и первый `describe` (строки 63–79, «адаптер покупок без магазина») на:

```ts
/** Контракт адаптера покупок (спеки 62, 53б).
 *  (1) Без ключа / в Expo Go / на вебе адаптер — заглушка 62: getOffers → [], покупка и
 *      восстановление — 'unavailable', права из магазина нет (null).
 *  (2) С ключом адаптер говорит с SDK (здесь — jest-мок): configure ровно один раз, ошибки SDK
 *      мапятся в 'cancelled' / 'error', восстановление без права — 'none'.
 *  (3) Цены не зашиты ни в адаптер, ни в экран, ни в строки: в `paywall.*` цена бывает только
 *      подстановкой `{{price}}` из ответа магазина. Периметр — ВСЕ .ts/.tsx под src/** и app/**
 *      (кроме __tests__) и ВСЕ строковые значения ресурсов каждого языка.
 *  Красный прогон (см. план 53б, задача 4): подмена 'cancelled' на 'error' в адаптере роняет
 *  «userCancelled → cancelled»; снятая проверка ключа роняет всю группу «без ключа». */
import fs from 'fs';
import path from 'path';
import { resources } from '../i18n';
import { PREMIUM_NONE } from '../premium';
import type { CustomerInfoLike, OfferingLike } from '../purchasesMap';

// переменная с префиксом mock — единственное, на что фабрике jest.mock разрешено ссылаться
const mockEnv = { key: undefined as string | undefined, expoGo: false, platform: 'android' };
jest.mock('../purchasesEnv', () => ({
  apiKey: () => mockEnv.key,
  isExpoGo: () => mockEnv.expoGo,
  get platform() {
    return mockEnv.platform;
  },
}));
const mockSdk = {
  configure: jest.fn(),
  setLogLevel: jest.fn(async () => undefined),
  getOfferings: jest.fn(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
  getCustomerInfo: jest.fn(),
  addCustomerInfoUpdateListener: jest.fn(),
  removeCustomerInfoUpdateListener: jest.fn(),
};
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: mockSdk,
  LOG_LEVEL: { DEBUG: 'DEBUG', ERROR: 'ERROR' },
}));

type Adapter = typeof import('../purchases');
/** Адаптер считает PURCHASES_AVAILABLE на загрузке модуля — каждый сценарий грузит его заново. */
function load(env: Partial<typeof mockEnv>): Adapter {
  Object.assign(mockEnv, { key: undefined, expoGo: false, platform: 'android' }, env);
  jest.resetAllMocks(); // и реализации тоже: mockResolvedValue прошлого сценария не должен пережить load()
  mockSdk.setLogLevel.mockResolvedValue(undefined);
  let m!: Adapter;
  jest.isolateModules(() => {
    m = require('../purchases');
  });
  return m;
}

const YEAR = { product: { identifier: 'premium:year', price: 2890, priceString: '2 890,00 ₽', currencyCode: 'RUB', pricePerMonth: 240.83, pricePerMonthString: '240,83 ₽' } };
const MONTH = { product: { identifier: 'premium:month', price: 399, priceString: '399,00 ₽', currencyCode: 'RUB', pricePerMonth: 399, pricePerMonthString: '399,00 ₽' } };
const OFFERING: OfferingLike = { annual: YEAR, monthly: MONTH };
const ACTIVE_INFO: CustomerInfoLike & { managementURL: string | null } = {
  entitlements: { active: { premium: { productIdentifier: 'premium:month', expirationDate: '2026-09-27T12:00:00Z', willRenew: true } } },
  managementURL: 'https://play.google.com/store/account/subscriptions?sku=premium&package=app.arcanum.tarot',
};
const NONE_INFO: CustomerInfoLike & { managementURL: string | null } = { entitlements: { active: {} }, managementURL: null };

describe('без магазина — заглушка 62', () => {
  it.each([
    ['ключа нет', { key: undefined }],
    ['Expo Go', { key: 'goog_x', expoGo: true }],
    ['веб', { key: 'goog_x', platform: 'web' }],
  ])('%s: PURCHASES_AVAILABLE false, [] / unavailable / null, SDK не трогается', async (_n, env) => {
    const a = load(env);
    expect(a.PURCHASES_AVAILABLE).toBe(false);
    await a.init();
    expect(await a.getOffers()).toEqual([]);
    expect(await a.purchase('year')).toEqual({ ok: false, reason: 'unavailable' });
    expect(await a.restore()).toEqual({ ok: false, reason: 'unavailable' });
    expect(await a.refreshEntitlement()).toBeNull();
    expect(await a.manageUrl()).toBeNull();
    expect(mockSdk.configure).not.toHaveBeenCalled();
  });
});

describe('с ключом — SDK (мок)', () => {
  it('configure ровно один раз, с ключом платформы; setLogLevel вызван', async () => {
    const a = load({ key: 'goog_test' });
    expect(a.PURCHASES_AVAILABLE).toBe(true);
    await a.init();
    await a.init();
    expect(mockSdk.configure).toHaveBeenCalledTimes(1);
    expect(mockSdk.configure).toHaveBeenCalledWith({ apiKey: 'goog_test' });
    expect(mockSdk.setLogLevel).toHaveBeenCalledTimes(1);
  });

  it('getOffers: current → пара тарифов; сбой SDK → []', async () => {
    const a = load({ key: 'goog_test' });
    mockSdk.getOfferings.mockResolvedValueOnce({ current: OFFERING });
    expect((await a.getOffers()).map((o) => o.id)).toEqual(['year', 'month']);
    mockSdk.getOfferings.mockRejectedValueOnce(new Error('offline'));
    expect(await a.getOffers()).toEqual([]);
  });

  it('purchase: пакет по id, успех → право магазина', async () => {
    const a = load({ key: 'goog_test' });
    mockSdk.getOfferings.mockResolvedValue({ current: OFFERING });
    mockSdk.purchasePackage.mockResolvedValueOnce({ productIdentifier: 'premium:month', customerInfo: ACTIVE_INFO });
    const r = await a.purchase('month');
    expect(mockSdk.purchasePackage).toHaveBeenCalledWith(MONTH);
    expect(r).toEqual({ ok: true, premium: { active: true, source: 'store', until: '2026-09-27', plan: 'month', willRenew: true } });
  });

  it('purchase: userCancelled → cancelled, прочий throw → error, нет пакета → error', async () => {
    const a = load({ key: 'goog_test' });
    mockSdk.getOfferings.mockResolvedValue({ current: OFFERING });
    mockSdk.purchasePackage.mockRejectedValueOnce({ userCancelled: true, message: 'cancelled' });
    expect(await a.purchase('year')).toEqual({ ok: false, reason: 'cancelled' });
    mockSdk.purchasePackage.mockRejectedValueOnce(new Error('billing unavailable'));
    expect(await a.purchase('year')).toEqual({ ok: false, reason: 'error' });
    mockSdk.getOfferings.mockResolvedValueOnce({ current: null });
    expect(await a.purchase('year')).toEqual({ ok: false, reason: 'error' });
  });

  it('restore: право есть → ok, права нет → none, throw → error', async () => {
    const a = load({ key: 'goog_test' });
    mockSdk.restorePurchases.mockResolvedValueOnce(ACTIVE_INFO);
    expect((await a.restore()).ok).toBe(true);
    mockSdk.restorePurchases.mockResolvedValueOnce(NONE_INFO);
    expect(await a.restore()).toEqual({ ok: false, reason: 'none' });
    mockSdk.restorePurchases.mockRejectedValueOnce(new Error('offline'));
    expect(await a.restore()).toEqual({ ok: false, reason: 'error' });
  });

  it('refreshEntitlement: ответ → право (NONE при отсутствии), throw → null', async () => {
    const a = load({ key: 'goog_test' });
    mockSdk.getCustomerInfo.mockResolvedValueOnce(NONE_INFO);
    // isolateModules грузит свой экземпляр '../premium' — сравнивать по значению, не по ссылке
    expect(await a.refreshEntitlement()).toEqual(PREMIUM_NONE);
    mockSdk.getCustomerInfo.mockRejectedValueOnce(new Error('offline'));
    expect(await a.refreshEntitlement()).toBeNull();
  });

  it('onEntitlementChange: подписка → право; отписка снимает слушателя', () => {
    const a = load({ key: 'goog_test' });
    const cb = jest.fn();
    const off = a.onEntitlementChange(cb);
    const listener = mockSdk.addCustomerInfoUpdateListener.mock.calls[0][0] as (i: unknown) => void;
    listener(ACTIVE_INFO);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ active: true, source: 'store', plan: 'month' }));
    off();
    expect(mockSdk.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(listener);
  });

  it('manageUrl: managementURL магазина, без него — страница подписок платформы', async () => {
    const a = load({ key: 'goog_test' });
    mockSdk.getCustomerInfo.mockResolvedValueOnce(ACTIVE_INFO);
    expect(await a.manageUrl()).toBe(ACTIVE_INFO.managementURL);
    mockSdk.getCustomerInfo.mockResolvedValueOnce(NONE_INFO);
    expect(await a.manageUrl()).toBe('https://play.google.com/store/account/subscriptions?package=app.arcanum.tarot');
    const ios = load({ key: 'appl_test', platform: 'ios' });
    mockSdk.getCustomerInfo.mockRejectedValueOnce(new Error('offline'));
    expect(await ios.manageUrl()).toBe('https://apps.apple.com/account/subscriptions');
  });
});
```
  Строки `import { getOffers, purchase, PURCHASES_AVAILABLE, refreshEntitlement, restore } from '../purchases';`
  и старый первый `describe` удалить; `ROOT`, `CURRENCY`, `walkSources`, `SOURCE_FILES`, `rel`,
  `collectStrings` и describe «цены не зашиты в код» остаются как были.

- [ ] **Шаг 2:** `npx jest src/lib/__tests__/purchases.test.ts` → FAIL (нет `init`, `onEntitlementChange`,
  `manageUrl`; `configure` не вызывается).

- [ ] **Шаг 3: `src/lib/purchases.ts`** — переписать целиком:

```ts
/** Адаптер покупок (спеки 53, 62, 53б) — ЕДИНСТВЕННЫЙ файл с импортом react-native-purchases.
 *  Экраны и хук синхронизации говорят только с ним; веб получает purchases.web.ts (без SDK,
 *  приём pushes.web.ts). Метро выбирает файл по суффиксу — dev-сервер веба после появления
 *  .web.ts перезапускать с --clear (урок 06б).
 *
 *  Живой магазин есть только в нативной сборке с ключом (purchasesAvailable): в Expo Go SDK
 *  уходит в Preview API Mode, но `configure` с боевым ключом бросает, а на вебе продукты
 *  недоступны — там адаптер ведёт себя как заглушка 62: [] / 'unavailable' / null, экран
 *  рисует «скоро». Так же ведёт себя сборка без ключа — деградация честная, без падения.
 *
 *  Правило спеки 62: пейвол не показывает цену, которой не назвал магазин, и не предлагает
 *  кнопку, которая не может купить. Цен и идентификаторов продуктов здесь нет: пакеты —
 *  offering.annual / offering.monthly, право — entitlement «premium» (purchasesMap). */
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import type { PlanId, PremiumState } from './premium';
import { apiKey, isExpoGo, platform } from './purchasesEnv';
import { purchasesAvailable, toOffers, toPremium, type Offer } from './purchasesMap';

export type { PlanId } from './premium';
export type { Offer } from './purchasesMap';

export type PurchaseResult =
  | { ok: true; premium: PremiumState }
  /** none — только у restore: магазин ответил, активной подписки у аккаунта нет */
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'error' | 'none' };

const KEY = apiKey();
export const PURCHASES_AVAILABLE = purchasesAvailable({ platform, expoGo: isExpoGo(), apiKey: KEY });

/** Страница подписок магазина, если SDK не дал managementURL (аккаунт без покупок). */
const MANAGE_FALLBACK =
  platform === 'android'
    ? 'https://play.google.com/store/account/subscriptions?package=app.arcanum.tarot'
    : 'https://apps.apple.com/account/subscriptions';

let configured = false;
/** configure — синхронный и ровно один раз; повторный вызов SDK считает ошибкой. */
export async function init(): Promise<void> {
  if (!PURCHASES_AVAILABLE || configured) return;
  configured = true;
  Purchases.configure({ apiKey: KEY as string });
  await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
}

async function packageFor(id: PlanId): Promise<PurchasesPackage | null> {
  const current = (await Purchases.getOfferings()).current;
  return (id === 'year' ? current?.annual : current?.monthly) ?? null;
}

/** Предложения магазина; сбой сети, страна без продаж, неодобренный продукт — [] («скоро», 62 Д1). */
export async function getOffers(): Promise<Offer[]> {
  if (!PURCHASES_AVAILABLE) return [];
  try {
    await init();
    return toOffers((await Purchases.getOfferings()).current);
  } catch {
    return [];
  }
}

export async function purchase(id: PlanId): Promise<PurchaseResult> {
  if (!PURCHASES_AVAILABLE) return { ok: false, reason: 'unavailable' };
  try {
    await init();
    const pkg = await packageFor(id);
    if (!pkg) return { ok: false, reason: 'error' };
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { ok: true, premium: toPremium(customerInfo) };
  } catch (e) {
    // закрытый лист оплаты — не ошибка: экран молчит (спека 53б, решение 10)
    return { ok: false, reason: (e as { userCancelled?: boolean }).userCancelled ? 'cancelled' : 'error' };
  }
}

export async function restore(): Promise<PurchaseResult> {
  if (!PURCHASES_AVAILABLE) return { ok: false, reason: 'unavailable' };
  try {
    await init();
    const premium = toPremium(await Purchases.restorePurchases());
    return premium.active ? { ok: true, premium } : { ok: false, reason: 'none' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** null — источника нет или SDK не ответил (стор не трогать, mergeEntitlement решит по until);
 *  PREMIUM_NONE — ответил «не куплено». */
export async function refreshEntitlement(): Promise<PremiumState | null> {
  if (!PURCHASES_AVAILABLE) return null;
  try {
    await init();
    return toPremium(await Purchases.getCustomerInfo());
  } catch {
    return null;
  }
}

/** Push от SDK: покупка, продление, отмена, восстановление. Вызывать после init(). */
export function onEntitlementChange(cb: (premium: PremiumState) => void): () => void {
  if (!PURCHASES_AVAILABLE) return () => undefined;
  const listener = (info: CustomerInfo) => cb(toPremium(info));
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

export async function manageUrl(): Promise<string | null> {
  if (!PURCHASES_AVAILABLE) return null;
  try {
    await init();
    return (await Purchases.getCustomerInfo()).managementURL ?? MANAGE_FALLBACK;
  } catch {
    return MANAGE_FALLBACK;
  }
}
```

- [ ] **Шаг 4: `src/lib/purchases.web.ts`:**

```ts
/** Веб-версия адаптера покупок — заглушка 62 БЕЗ единого импорта react-native-purchases:
 *  на вебе продуктов и покупок нет, а сам импорт SDK тянул бы его в веб-бандл (приём
 *  pushes.web.ts). Сигнатуры — те же, что у purchases.ts. */
import type { PremiumState } from './premium';
import type { Offer } from './purchasesMap';

export type { PlanId } from './premium';
export type { Offer } from './purchasesMap';
export type PurchaseResult =
  | { ok: true; premium: PremiumState }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'error' | 'none' };

export const PURCHASES_AVAILABLE = false;
export async function init(): Promise<void> {}
export async function getOffers(): Promise<Offer[]> {
  return [];
}
export async function purchase(): Promise<PurchaseResult> {
  return { ok: false, reason: 'unavailable' };
}
export async function restore(): Promise<PurchaseResult> {
  return { ok: false, reason: 'unavailable' };
}
export async function refreshEntitlement(): Promise<PremiumState | null> {
  return null;
}
export function onEntitlementChange(): () => void {
  return () => undefined;
}
export async function manageUrl(): Promise<string | null> {
  return null;
}
```

- [ ] **Шаг 4б: бейдж пейвола и ключ `discount`** — без этого `tsc` красный: тип `Offer` больше не несёт
  `discount`. В `src/lib/i18n.ts` после `soonSub` каждого языка добавить одну строку:
  ru `discount: "−{{pct}} %",` · en `discount: "−{{pct}}%",` · es `discount: "−{{pct}} %",` ·
  pt `discount: "−{{pct}} %",` (минус — U+2212, как в макете). В `app/paywall.tsx` строку
  `{o.discount && <PremiumBadge label={o.discount} style={st.planBadge} solid />}` заменить на:

```tsx
                        {o.discountPct !== undefined && (
                          <PremiumBadge label={tr('paywall.discount', { pct: o.discountPct })} style={st.planBadge} solid />
                        )}
```

- [ ] **Шаг 5:** `npx jest src/lib/__tests__/purchases.test.ts` → PASS (включая «цены не зашиты»: в новом
  адаптере знаков валют нет; `$rc_` в коде отсутствует); `npx tsc --noEmit` — пусто (структурные типы
  `CustomerInfo`/`PurchasesOffering` SDK подходят к `*Like` без кастов — если `tsc` спорит о
  `productCategory`/лишних полях, это сигнал, что `*Like` объявили с лишним обязательным полем: убрать
  поле из `*Like`, не кастовать).

- [ ] **Шаг 6: красный прогон:** в `purchase` заменить `'cancelled'` на `'error'` → падает
  «userCancelled → cancelled»; в `purchasesAvailable`-вызове передать `apiKey: 'x'` → падает вся группа
  «без магазина». Откатить.

- [ ] **Шаг 7: коммит.**
```bash
git add src/lib/purchases.ts src/lib/purchases.web.ts src/lib/__tests__/purchases.test.ts app/paywall.tsx src/lib/i18n.ts
git commit -m "feat: адаптер покупок на react-native-purchases, веб-заглушка, тесты с моком SDK (spec 53б)"
```

---

### Задача 5: хук `usePremiumSync` в корневом layout

**Файлы:**
- Create: `src/lib/usePremiumSync.ts`
- Modify: `app/_layout.tsx:22-23,60`

**Интерфейсы:**
- Consumes: `init`, `onEntitlementChange`, `refreshEntitlement` (задача 4); `mergeEntitlement`,
  `samePremium` (задача 2); `useAppActive`; `localDateISO`.
- Produces: `usePremiumSync(): void`, `applyEntitlement(fromStore: PremiumState | null): void`.

- [ ] **Шаг 1: `src/lib/usePremiumSync.ts`:**

```ts
/** Синхронизация права Premium с магазином (спека 53б). Живёт в корневом layout, один раз.
 *  Три точки: монтирование (старт), возврат из фона (правило 10: истечение подписки — тоже
 *  временнóе, useFocusEffect его не ловит) и push SDK (покупка, продление, отмена).
 *  Без магазина (Expo Go, веб, нет ключа) — no-op: адаптер отдаёт заглушки, стор не трогается,
 *  DEV-право тумблера живёт как жило. */
import React from 'react';
import { useApp } from '../store/useApp';
import { localDateISO } from './dates';
import type { PremiumState } from './premium';
import { init, onEntitlementChange, refreshEntitlement } from './purchases';
import { mergeEntitlement, samePremium } from './purchasesMap';
import { useAppActive } from './useAppActive';

/** Ответ магазина (или его отсутствие) → стор. Пишет только при реальной перемене: иначе каждый
 *  старт клал бы в persist одно и то же. */
export function applyEntitlement(fromStore: PremiumState | null): void {
  const { premium, setPremium } = useApp.getState();
  const next = mergeEntitlement(premium, fromStore, localDateISO());
  if (!samePremium(next, premium)) setPremium(next);
}

export function usePremiumSync(): void {
  React.useEffect(() => {
    let alive = true;
    let unsubscribe: () => void = () => undefined;
    (async () => {
      await init();
      if (!alive) return;
      unsubscribe = onEntitlementChange(applyEntitlement);
      applyEntitlement(await refreshEntitlement());
    })().catch((err) => console.warn('[purchases] синхронизация права не удалась:', err));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  useAppActive(() => {
    refreshEntitlement()
      .then(applyEntitlement)
      .catch((err) => console.warn('[purchases] синхронизация права не удалась:', err));
  });
}
```

- [ ] **Шаг 2: `app/_layout.tsx`** — импорт `import { usePremiumSync } from '../src/lib/usePremiumSync';`
  (по алфавиту после `usePushScheduler`); после строки `usePushScheduler();` добавить:

```tsx
  // право Premium ↔ магазин (спека 53б): старт, возврат из фона, push SDK; без магазина — no-op
  usePremiumSync();
```

- [ ] **Шаг 3:** `npx tsc --noEmit` — пусто; `npm test` — зелёный (`premiumSources.test.ts` периметр
  `app/` + `src/components/` хук в `src/lib` не видит — так и задумано).

- [ ] **Шаг 4: Expo Go, руками:** приложение открывается, консоль Metro без `[purchases]` и без
  предупреждений SDK (в Expo Go `init` — no-op, SDK не конфигурируется); DEV-тумблер Premium
  включается/выключается, свернуть/развернуть — право не сбрасывается (DEV магазин не трогает).

- [ ] **Шаг 5: коммит.**
```bash
git add src/lib/usePremiumSync.ts app/_layout.tsx
git commit -m "feat: usePremiumSync — право Premium следует за магазином (spec 53б)"
```

---

### Задача 6: строки ×4, пейвол (панель, бейдж, диалоги, «Управлять»), макет

**Файлы:**
- Modify: `src/lib/i18n.ts` — после строки `discount` (задача 4) в блоке `paywall` каждого языка
- Modify: `app/paywall.tsx:9,24,56,71-76,130-146,176,214-221`
- Modify: `docs/design-reference.html:1138`

**Интерфейсы:**
- Consumes: `Offer.discountPct`, `PurchaseResult.reason` (`'none'`), `manageUrl` (задача 4); `premium.plan`/`willRenew` (задача 1).

- [ ] **Шаг 1: i18n.** После `discount` вставить (в каждом языке — свой столбец; комментарий — только в ru):

ru:
```ts
        // 53б: панель «активна» называет тариф и различает продление/истечение (willRenew);
        // error/none — ответы магазина (бейдж discount — из цен магазина, см. purchasesMap)
        activeYear: "Годовая подписка",
        activeMonth: "Месячная подписка",
        activeExpires: "Действует до {{date}}",
        errorTitle: "Не получилось",
        errorText: "Магазин не ответил. Проверьте связь и попробуйте ещё раз.",
        restoreNoneTitle: "Подписка не найдена",
        restoreNoneText: "У этого аккаунта App Store / Google Play нет активной подписки Arcanum Premium.",
```
en:
```ts
        activeYear: "Annual subscription",
        activeMonth: "Monthly subscription",
        activeExpires: "Valid until {{date}}",
        errorTitle: "Something went wrong",
        errorText: "The store didn't respond. Check your connection and try again.",
        restoreNoneTitle: "No subscription found",
        restoreNoneText: "This App Store / Google Play account has no active Arcanum Premium subscription.",
```
es:
```ts
        activeYear: "Suscripción anual",
        activeMonth: "Suscripción mensual",
        activeExpires: "Válida hasta {{date}}",
        errorTitle: "Algo salió mal",
        errorText: "La tienda no respondió. Revisa tu conexión e inténtalo de nuevo.",
        restoreNoneTitle: "No se encontró la suscripción",
        restoreNoneText: "Esta cuenta de App Store / Google Play no tiene una suscripción activa de Arcanum Premium.",
```
pt:
```ts
        activeYear: "Assinatura anual",
        activeMonth: "Assinatura mensal",
        activeExpires: "Válida até {{date}}",
        errorTitle: "Algo deu errado",
        errorText: "A loja não respondeu. Verifique sua conexão e tente de novo.",
        restoreNoneTitle: "Assinatura não encontrada",
        restoreNoneText: "Esta conta da App Store / Google Play não tem uma assinatura ativa do Arcanum Premium.",
```
  Знак минуса — U+2212 «−», как в бейдже макета. `npm test` → `i18nLangs`/контракт ключей зелёные
  (ключи есть во всех четырёх языках), `purchases.test.ts` «строки без валют» зелёный (в новых строках
  нет знаков валют).

- [ ] **Шаг 2: `app/paywall.tsx` — импорты.** В импорт из `react-native` добавить `Linking`; импорт адаптера:
  `import { getOffers, manageUrl, purchase, PURCHASES_AVAILABLE, restore, type Offer, type PlanId } from '../src/lib/purchases';`.

- [ ] **Шаг 3: состояние диалога** — заменить `const [unavailable, setUnavailable] = React.useState(false);` на:

на уровне модуля (рядом с `BACK_TITLES`):

```tsx
/** Тексты диалога по ответу магазина (спека 53б): нет магазина / не ответил / подписки нет. */
const DIALOG_TEXT = {
  unavailable: { title: 'paywall.unavailableTitle', text: 'paywall.unavailableText' },
  error: { title: 'paywall.errorTitle', text: 'paywall.errorText' },
  none: { title: 'paywall.restoreNoneTitle', text: 'paywall.restoreNoneText' },
} as const;
type DialogKind = keyof typeof DIALOG_TEXT;
```

и внутри компонента:

```tsx
  // один диалог на три ответа магазина; вид хранится отдельно от «открыт», чтобы текст не
  // пропадал на кадре закрытия
  const [dialog, setDialog] = React.useState<DialogKind>('unavailable');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const showDialog = (kind: DialogKind) => {
    setDialog(kind);
    setDialogOpen(true);
  };
```

- [ ] **Шаг 4: `run()`** — заменить на:

```tsx
  // один обработчик на покупку и восстановление: успех — право в стор; закрытый лист оплаты
  // (cancelled) — тишина; unavailable / error / none — свой диалог (спека 53б, решение 10)
  const run = async (action: () => ReturnType<typeof purchase>) => {
    const r = await action();
    if (r.ok) setPremium(r.premium);
    else if (r.reason !== 'cancelled') showDialog(r.reason);
  };
```

- [ ] **Шаг 5: панель «активна»** — заменить две `Txt` внутри `st.panel` и `onPress` кнопки «Управлять»:

```tsx
            <View style={[st.panel, { backgroundColor: t.panel, borderColor: t.line }]}>
              {/* тариф из магазина (53б); без плана (DEV) — нейтральный заголовок 53а */}
              <Txt style={[st.panelTitle, { color: t.head }]}>
                {premium.plan === 'year'
                  ? tr('paywall.activeYear')
                  : premium.plan === 'month'
                    ? tr('paywall.activeMonth')
                    : tr('paywall.activeTitle')}
              </Txt>
              {/* «Продлится» — только при включённом продлении; отменённая, но действующая —
                  «Действует до» (иначе панель врала бы, спека 53б, решение 9) */}
              <Txt style={[st.panelSub, { color: t.muted }]}>
                {premium.source === 'store' && premium.until
                  ? tr(premium.willRenew ? 'paywall.activeUntil' : 'paywall.activeExpires', {
                      date: formatFullDate(premium.until, lang),
                    })
                  : tr('paywall.activeDev')}
              </Txt>
            </View>
            <PressableScale
              onPress={() => {
                hapticTap();
                // страница подписок магазина (managementURL SDK или страница платформы);
                // null — магазина нет (Expo Go) → прежний диалог «Пока недоступно»
                manageUrl()
                  .then((url) => (url ? Linking.openURL(url) : showDialog('unavailable')))
                  .catch(() => showDialog('error'));
              }}
              style={[st.secondary, { borderColor: t.line }]}
            >
```

- [ ] **Шаг 6:** бейдж скидки уже переведён на `discountPct` в задаче 4 (шаг 4б) — здесь ничего.

- [ ] **Шаг 7: диалог** — заменить `ConfirmDialog` внизу на:

```tsx
      <ConfirmDialog
        visible={dialogOpen}
        title={tr(DIALOG_TEXT[dialog].title)}
        message={tr(DIALOG_TEXT[dialog].text)}
        confirmLabel={tr('paywall.ok')}
        confirmTone="accent"
        onConfirm={() => setDialogOpen(false)}
      />
```
  (`DIALOG_TEXT` и `DialogKind` объявлены в шаге 3).

- [ ] **Шаг 8: макет** `docs/design-reference.html:1138` — после строки `.pwstate` внутри `#pwOn` добавить
  комментарий-вариант (состояние текстовое, композиция та же):

```html
      <!-- 53б: вторая строка зависит от продления — «Продлится 22 сентября 2027» (willRenew) или
           «Действует до 22 сентября 2027» (подписка отменена, но действует); без тарифа (DEV) —
           заголовок «Подписка активна». Бейдж «−40 %» в #pwOff — из цен магазина, вниз, ≥ 5 % -->
```

- [ ] **Шаг 9:** `npx tsc --noEmit` — пусто; `npm test` — зелёный; `grep -n "unavailable" app/paywall.tsx`
  показывает только `showDialog('unavailable')` и ключ в `DIALOG_TEXT` (старый стейт снят).

- [ ] **Шаг 10: Expo Go, руками** (Артём или сессия через веб — см. задачу 7): DEV-тумблер → пейвол:
  «Подписка активна · DEV-режим», «Управлять подпиской» → диалог «Пока недоступно» (в Expo Go
  `manageUrl` = null); выключить → «скоро».

- [ ] **Шаг 11: коммит.**
```bash
git add src/lib/i18n.ts app/paywall.tsx docs/design-reference.html
git commit -m "feat: пейвол — тариф и продление из магазина, бейдж из цен, диалоги ответов магазина (spec 53б)"
```

---

### Задача 7: документы, веб-регресс, сборка, лайв 6в, слияние

**Файлы:**
- Modify: `docs/logic-spec.md` (§7 версия, §14), `docs/product-spec.md` §5а, `docs/release-checklist.md` (пункт «Подписка (53б)», анкета Data Safety), `docs/backlog.md` (53), `CLAUDE.md` «Статус», `docs/changelog.md`, `docs/lessons.md`, `AGENTS.md`, `docs/specs/53b-revenuecat.md` (отчёт).

- [ ] **Шаг 1: веб-регресс 62.** Dev-сервер заново: `npm run kill:dev` → `npx expo start --web --clear`;
  `NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" node scripts/check_62_web.js`
  → зелёный без правок сценария (веб = «скоро»). Дополнительно: в бандле веба нет SDK —
  `curl -s "http://localhost:8081/index.bundle?platform=web" | grep -c "react-native-purchases"` → 0
  (если Metro отдаёт бандл под другим URL — взять его из вкладки Network браузера).

- [ ] **Шаг 2: документы** (тексты вставок):
  - `docs/logic-spec.md` §14, абзац «Право»: `PremiumState = {active, source, until, plan, willRenew}`;
    добавить: «`plan` — тариф из магазина (`'year' | 'month' | null`), `willRenew` — продление включено;
    у `'dev'`/`'none'` — `null`/`false`. `until` — ЛОКАЛЬНАЯ дата `YYYY-MM-DD` (`localDateISO` от
    `expirationDate` магазина). Persist **12** (53б): `mergePremium` доливает поля внутри `premium`.
    Слияние с магазином — `mergeEntitlement` (`purchasesMap.ts`): `dev` не трогается; ответ есть —
    он и правда; ответа нет — store-право живёт до `until`, дальше снимается локально.» Абзац
    «Адаптер покупок»: «53б: `purchases.ts` на `react-native-purchases` (единственный импорт SDK),
    `purchases.web.ts` — заглушка; `PURCHASES_AVAILABLE` = натив ∧ не Expo Go ∧ ключ
    `EXPO_PUBLIC_RC_*`; хук `usePremiumSync` — старт, `AppState`, push SDK.» В §7 строку про
    persist 11 → «persist 12 (53б)».
  - `docs/product-spec.md` §5а: абзац «Поведение кнопок в 53а» заменить на «**Поведение в сборке из
    магазина (53б):** CTA → лист оплаты магазина; закрыт — ничего; магазин не ответил — диалог
    «Не получилось»; «Восстановить покупки» → право или диалог «Подписка не найдена»; «Управлять
    подпиской» → страница подписок магазина. В Expo Go и вебе — состояние «скоро» и диалог «Пока
    недоступно» (62). Панель «активна»: «Годовая/Месячная подписка», «Продлится {дата}» при включённом
    продлении, «Действует до {дата}» у отменённой; тариф и дата — из магазина.» Абзац про «−40 %»:
    «бейдж считается из цен магазина (вниз, ≥ 5 %, одна валюта), иначе не рисуется».
  - `docs/release-checklist.md`, пункт «Подписка (задача 53б…)»: в начало добавить «**Код — сделано
    (53б, дата)**: адаптер RevenueCat, ключи `EXPO_PUBLIC_RC_*` через `eas env:set`, без dev-client;
    **консоль**: [ ] RevenueCat + service-account, [ ] продукты `premium`/`year`/`month` + цены,
    [ ] лицензионный тестер, [ ] `eas env:set` ANDROID, [ ] Apple — после активации.» В пункт
    анкеты приватности: «**Data Safety после 53б:** «История покупок» — собирается, не передаётся
    третьим лицам как продавцу (RevenueCat — поставщик услуг), обязательно, цель «Работа приложения»;
    по гайду RevenueCat «Google Play's Data Safety». Переписать ДО отправки сборки с SDK в любой трек.»
  - `AGENTS.md`, раздел «Команды»: строка «Ключи RevenueCat (спека 53б): `eas env:set --name
    EXPO_PUBLIC_RC_ANDROID_KEY --value goog_… --environment production --environment preview
    --visibility plaintext` (`env:create` устарел); локально — `.env` по образцу `.env.example`.
    Доставка ключа в сборку проверяется до заливки: `python -c "import zipfile,sys;
    print(b'goog_' in zipfile.ZipFile(sys.argv[1]).read('base/assets/index.android.bundle'))" <aab>`
    → `True`. В Expo Go SDK не конфигурируется (с боевым ключом `configure` бросает) — покупки
    только в сборке из трека.»
  - `docs/lessons.md`: раздел 2 «Веб ≠ натив» — «⚠️ 53б: `react-native-purchases` в Expo Go сам
    переходит в Preview API Mode, dev-client ради него не нужен; но `configure` с боевым ключом
    в Expo Go бросает — признак Expo Go читать из `expo-constants` и не конфигурировать»; раздел 13
    «Алгоритмы» — «⚠️ 53б: `formatFullDate`/`parseISODate` разбирают только `YYYY-MM-DD`; момент
    ISO с временем даёт NaN — даты магазина хранить локальной датой через `localDateISO`»; раздел 12
    «Процесс» — «⚠️ 53б: у результата-объединения (`ok | unavailable | cancelled | error`) ветка без
    обработчика молчит — `error` пейвола 53а глотался; правило: у `switch` по `reason` — каждая ветка
    или явный `default`».
  - `docs/backlog.md` 53: «**53б — код сделан (дата)**, ждёт консольной части и лайва 6в»;
    `CLAUDE.md` «Статус»: «53б: код в ветке `feat/53b-revenuecat`, persist 12, тестов N в M сьютах;
    ждёт RevenueCat/продукты/ключ (Артём) → `production`-сборка → лайв»; `docs/changelog.md` —
    запись задачи; спека 53б — раздел «Отчёт» (числа тестов, мутации, что отложено).

- [ ] **Шаг 3:** `npm test` — зелёный; `npx tsc --noEmit`; `python scripts/check_easignore.py`; коммит:
```bash
git add docs/logic-spec.md docs/product-spec.md docs/release-checklist.md docs/backlog.md CLAUDE.md docs/changelog.md docs/lessons.md AGENTS.md docs/specs/53b-revenuecat.md
git commit -m "docs: 53б — persist 12, адаптер RevenueCat, Data Safety, команды env (spec 53б)"
git push -u origin feat/53b-revenuecat
```

- [ ] **Шаг 4: консольная часть — Артём** (чек-лист «Артём — до кода» в спеке): RevenueCat, продукты, цены,
  лицензионный тестер, `eas env:set` для `production` и `preview`. Сессия проверяет:
  `npx eas-cli@latest env:list --environment production` показывает `EXPO_PUBLIC_RC_ANDROID_KEY`.

- [ ] **Шаг 5: сборка** из ветки: `npx eas-cli@latest build -p android --profile production --non-interactive`
  → лог «Uploading to EAS Build (0 / ~29 MB)»; скачать AAB; проверка ключа в бандле командой из
  AGENTS.md (шаг 2) → `True`; манифест — `com.android.vending.BILLING` присутствует (`aapt` не нужен:
  `python -c "import zipfile,sys; print(b'BILLING' in zipfile.ZipFile(sys.argv[1]).read('base/manifest/AndroidManifest.xml'))"`).
  Артём кладёт AAB во внутренний трек руками (артефакт EAS без CORS — урок 61).

- [ ] **Шаг 6: лайв 6в (Артём, сценарий из спеки — критерий «6в Android»):** тарифы с ценами магазина →
  покупка месячного тестовой картой → панель «Месячная подписка · Продлится …», «✦ АКТИВНА», М3
  открыт, «Ещё N» работает → «Управлять подпиской» → отмена в Play → свернуть/развернуть → «Действует
  до …» → через ~30 мин право снято само → удалить/поставить → «Восстановить покупки» → право
  вернулось → авиарежим: приложение живёт, пейвол «скоро». Сначала эмулятор с Play Store, сорвётся —
  телефон. Результат — в отчёт спеки.

- [ ] **Шаг 7: слияние** после зелёного лайва: `git checkout main && git merge --no-ff feat/53b-revenuecat`
  → `git push`; бэклог 53 → `[x]` (iOS — хвост 63б), CLAUDE.md «Статус», changelog — отдельным
  docs-коммитом.
