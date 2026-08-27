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

  it('configure бросает на первом вызове → следующий init() пробует configure снова, а не считает себя настроенным', async () => {
    const a = load({ key: 'goog_test' });
    mockSdk.configure.mockImplementationOnce(() => {
      throw new Error('billing unavailable');
    });
    await expect(a.init()).rejects.toThrow('billing unavailable');
    await a.init();
    expect(mockSdk.configure).toHaveBeenCalledTimes(2);
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

const ROOT = path.join(__dirname, '../../..');
/** Знаки валют (прямые и постфиксные) и цифра ПОСЛЕ доллара (только префиксная форма — так пишут
 *  цены все магазины, `$29.90`). Альтернативу «цифра перед долларом» с заплаткой (?!\{) сняли
 *  целиком (правка финального ревью задачи 62): постфиксный доллар («2890 $») не печатает ни
 *  Apple, ни Google — USD у обоих всегда префиксом, — а ловила эта альтернатива почти
 *  исключительно шум шаблонных литералов: «0 0 ${cssBlur}px» (glow.ts, textGlow) и
 *  «#000 ${fadeTop}px» (GlassPanel.tsx) дают «цифра-пробел-$», и заплатка (?!\{) их глушила ценой
 *  слепоты к настоящей находке — цене, приклеенной к шаблонной переменной (`2890${currencySymbol}`).
 *  Эта слепота остаётся осознанной границей контракта: зашитая в код цена несёт ЛИТЕРАЛЬНЫЙ знак
 *  валюты, и его ловит класс символов ниже — он и есть основная защита, не тронут. */
const CURRENCY = /[₽€£¥₴₸₺₩₪₹]|\$\s?\d|R\$\s?\d|\d\s?zł|\d\s?Kč/;

/** Обход дерева исходников (приём langSources.test.ts/premiumSources.test.ts): __tests__ и
 *  node_modules пропускаются, остальные .ts/.tsx каталоги и файлы — рекурсивно. */
function walkSources(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      if (name !== '__tests__' && name !== 'node_modules') walkSources(p, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}
const SOURCE_FILES = ['app', 'src'].flatMap((d) => walkSources(path.join(ROOT, d)));
const rel = (p: string) => path.relative(ROOT, p).replace(/\\/g, '/');

/** Рекурсивно собирает все строковые значения объекта ресурсов языка с адресом ключа
 *  (`paywall.soonTitle` и т.п.) — периметр «вся строковая часть языка», а не один блок. */
function collectStrings(obj: unknown, prefix: string, out: Array<{ key: string; value: string }>) {
  if (typeof obj === 'string') {
    out.push({ key: prefix, value: obj });
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      collectStrings(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
}

describe('цены не зашиты в код (спека 62)', () => {
  it('исходники найдены (иначе тест проверял бы пустоту)', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(30);
  });

  it.each(SOURCE_FILES.map(rel))('%s без знаков валют', (relPath) => {
    const src = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
    expect(src.match(CURRENCY)).toBeNull();
  });

  it.each(Object.keys(resources))(
    '%s: во всех строках интерфейса нет валют (цена — только {{price}} в paywall.*)',
    (lng) => {
      const translation = (resources as Record<string, { translation: unknown }>)[lng].translation;
      const strings: Array<{ key: string; value: string }> = [];
      collectStrings(translation, '', strings);
      expect(strings.length).toBeGreaterThan(50); // периметр: не пустой набор строк языка
      const bad = strings.filter((s) => CURRENCY.test(s.value));
      expect(bad.map((s) => `${s.key}: ${s.value}`)).toEqual([]);
    },
  );
});
