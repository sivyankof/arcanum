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
