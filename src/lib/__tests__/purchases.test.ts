/** Контракт адаптера покупок (спека 62): пейвол не показывает цену, которой не назвал магазин.
 *  Пока SDK покупок нет (`PURCHASES_AVAILABLE === false`, 53а/62), `getOffers` обязан отдавать
 *  пустой список — плейсхолдеры «2 890 ₽» задачи 53а не должны доехать до пользователей, а фолбэк
 *  на выдуманную цену пережил бы и 53б («магазин не ответил → показали рубли»).
 *  Вторая половина — цены не зашиты ни в адаптер, ни в экран, ни в строки: в `paywall.*` цена
 *  бывает только подстановкой `{{price}}` из ответа магазина.
 *
 *  Периметр контракта «цен в коде нет» (правка финального ревью задачи 62):
 *   - файлы: ВСЕ `.ts`/`.tsx` под `src/**` и `app/**` (рекурсивно, приём walk() из
 *     langSources.test.ts/premiumSources.test.ts), кроме каталогов `__tests__` — упоминание цены
 *     в докстроке теста (как в этом самом файле, «2 890 ₽») законно и не утечка в рабочий код;
 *   - строки: ВСЕ строковые значения `resources[lng].translation` каждого языка (рекурсивный
 *     обход объекта), а не только блок `paywall.*` — цена мимо этого блока (другим ключом,
 *     другим модулем) раньше проходила бы контракт незамеченной;
 *   - знаки валют: ₽€£¥ (было) + ₴₸₺₩₪₹ (СНГ/Азия/Израиль/Индия) + постфиксные R$/zł/Kč рядом
 *     с числом (Бразилия/Польша/Чехия) — набор не исчерпывающий, расширять по факту; каждое
 *     добавление обязано остаться зелёным на текущем корпусе.
 *  Красный прогон (код 53а): падают «getOffers → []» и «без знаков валют» на purchases.ts. */
import fs from 'fs';
import path from 'path';
import { resources } from '../i18n';
import { getOffers, purchase, PURCHASES_AVAILABLE, refreshEntitlement, restore } from '../purchases';

const ROOT = path.join(__dirname, '../../..');
/** Знаки валют (прямые и постфиксные) и число рядом с долларом; голый `$` законен (`${}` шаблонных
 *  строк), а `\d\s?\$` без стража (?!\{) ловит и его — «0 0 ${cssBlur}px» (glow.ts) даёт «0 $»,
 *  найдено расширением периметра на весь src/**; постфиксный доллар «99$» стражу не мешает. */
const CURRENCY = /[₽€£¥₴₸₺₩₪₹]|\d\s?\$(?!\{)|\$\s?\d|R\$\s?\d|\d\s?zł|\d\s?Kč/;

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
