/** Контракт адаптера покупок (спека 62): пейвол не показывает цену, которой не назвал магазин.
 *  Пока SDK покупок нет (`PURCHASES_AVAILABLE === false`, 53а/62), `getOffers` обязан отдавать
 *  пустой список — плейсхолдеры «2 890 ₽» задачи 53а не должны доехать до пользователей, а фолбэк
 *  на выдуманную цену пережил бы и 53б («магазин не ответил → показали рубли»).
 *  Вторая половина — цены не зашиты ни в адаптер, ни в экран, ни в строки: в `paywall.*` цена
 *  бывает только подстановкой `{{price}}` из ответа магазина.
 *  Красный прогон (код 53а): падают «getOffers → []» и «purchases.ts без знаков валют». */
import fs from 'fs';
import path from 'path';
import { resources } from '../i18n';
import { getOffers, purchase, PURCHASES_AVAILABLE, refreshEntitlement, restore } from '../purchases';

const ROOT = path.join(__dirname, '../../..');
/** Знаки валют и число рядом с долларом; голый `$` законен (`${}` шаблонных строк). */
const CURRENCY = /[₽€£¥]|\d\s?\$|\$\s?\d/;

describe('адаптер покупок без магазина (спека 62)', () => {
  it('SDK покупок в этой редакции нет — 53б перепишет сьют вместе с флагом', () => {
    expect(PURCHASES_AVAILABLE).toBe(false);
  });

  it('без SDK предложений нет: getOffers → []', async () => {
    expect(await getOffers()).toEqual([]);
  });

  it('оформить/восстановить отвечают unavailable, права из магазина нет', async () => {
    expect(await purchase('year')).toEqual({ ok: false, reason: 'unavailable' });
    expect(await purchase('month')).toEqual({ ok: false, reason: 'unavailable' });
    expect(await restore()).toEqual({ ok: false, reason: 'unavailable' });
    expect(await refreshEntitlement()).toBeNull();
  });
});

describe('цены не зашиты в код (спека 62)', () => {
  it.each(['src/lib/purchases.ts', 'app/paywall.tsx'])('%s без знаков валют', (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    expect(src.match(CURRENCY)).toBeNull();
  });

  it.each(Object.keys(resources))('%s: строки paywall.* без валют, цена только через {{price}}', (lng) => {
    const pw = (resources as Record<string, { translation: { paywall: Record<string, string> } }>)[lng]
      .translation.paywall;
    expect(Object.keys(pw).length).toBeGreaterThan(20); // периметр: не пустой объект
    for (const [k, v] of Object.entries(pw)) expect(`${k}: ${v}`).not.toMatch(CURRENCY);
  });
});
