/** Контракт «сигнатуры purchases.ts и purchases.web.ts совпадают» (спека 53б, ревью задачи 4).
 *  Причина, почему это держит именно тест, а не компилятор: `tsc` НЕ проверяет `.web.ts` против
 *  его потребителей — в `tsconfig.json` нет `moduleSuffixes`, поэтому типы веб-заглушки живут
 *  сами по себе и никогда не сверяются с `purchases.ts`. Metro подменяет файл по суффиксу
 *  ТОЛЬКО в веб-бандле (тот же приём, что `pushes.web.ts`) — значит забытая правка веб-версии
 *  (другая арность функции, лишний или потерянный экспорт) проходит `tsc` чисто и ломается
 *  только в браузере на рантайме. Родня по приёму — `premiumSources.test.ts`/`langSources.test.ts`.
 *
 *  Проверяется:
 *   - набор экспортированных ИМЁН совпадает (сравнение отсортированных `Object.keys`) —
 *     лишнее и потерянное имя одинаково находка;
 *   - у каждого имени совпадает `typeof` (функция против константы);
 *   - у функций совпадает арность `fn.length` — это и ловит выброшенные параметры
 *     (найдено в ревью: веб-заглушка `purchase()`/`onEntitlementChange()` растеряла параметры);
 *   - `PURCHASES_AVAILABLE` в веб-версии — всегда `false` (на вебе покупок нет по определению);
 *   - у purchases.web.ts нет импорта react-native-purchases: не теория — `react-native-purchases@10.8`
 *     тянет `@revenuecat/purchases-js`, и лишний импорт здесь — живой web-SDK в веб-бандле,
 *     а не просто лишний вес (приём чтения исходника — `purchases.test.ts`). */
import fs from 'fs';
import path from 'path';

jest.mock('../purchasesEnv', () => ({
  apiKey: () => 'goog_test',
  isExpoGo: () => false,
  platform: 'android',
}));
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(async () => undefined),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    getCustomerInfo: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
  },
  LOG_LEVEL: { DEBUG: 'DEBUG', ERROR: 'ERROR' },
}));

import * as native from '../purchases';
import * as web from '../purchases.web';

const nativeExports = native as Record<string, unknown>;
const webExports = web as Record<string, unknown>;

describe('контракт сигнатур: purchases.ts ⟺ purchases.web.ts (спека 53б)', () => {
  it('набор экспортированных имён совпадает', () => {
    expect(Object.keys(webExports).sort()).toEqual(Object.keys(nativeExports).sort());
  });

  it('у каждого имени совпадает typeof (функция против константы)', () => {
    for (const key of Object.keys(nativeExports)) {
      expect(typeof webExports[key]).toBe(typeof nativeExports[key]);
    }
  });

  it('у функций совпадает арность — ловит выброшенные параметры веб-заглушки', () => {
    for (const key of Object.keys(nativeExports)) {
      if (typeof nativeExports[key] === 'function') {
        expect((webExports[key] as (...a: unknown[]) => unknown).length).toBe(
          (nativeExports[key] as (...a: unknown[]) => unknown).length,
        );
      }
    }
  });

  it('PURCHASES_AVAILABLE веб-версии — всегда false', () => {
    expect(web.PURCHASES_AVAILABLE).toBe(false);
  });

  it('исходник purchases.web.ts не импортирует react-native-purchases', () => {
    const src = fs.readFileSync(path.join(__dirname, '../purchases.web.ts'), 'utf8');
    // имя пакета в комментарии — законно (см. шапку файла), ищем именно импорт/require
    expect(src).not.toMatch(/from\s+['"]react-native-purchases['"]/);
    expect(src).not.toMatch(/require\(\s*['"]react-native-purchases['"]\s*\)/);
  });
});
