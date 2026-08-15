/** Страж от копипасты каста языка в новый экран (спека 27). До задачи 27 выражение
 *  `(i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en'` жило в 11 файлах, и каждый новый
 *  экран приносил свою копию — третий язык молча становился английским, компилятор молчал.
 *  Теперь язык читается ТОЛЬКО через useLang() из src/lib/i18n.ts, а тип Lang объявлен ровно
 *  один раз в src/lib/lang.ts. Тест краснеет на первой же новой копии. */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../../..');
const DIRS = ['app', 'src'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      if (name !== '__tests__' && name !== 'node_modules') walk(p, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const files = DIRS.flatMap((d) => walk(path.join(ROOT, d)));
const rel = (p: string) => path.relative(ROOT, p).replace(/\\/g, '/');

describe('язык читается одним способом (спека 27)', () => {
  it('исходники найдены (иначе тест проверял бы пустоту)', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it('нет каста i18n.language.startsWith — только useLang()', () => {
    const bad = files.filter((f) => /i18n\.language\.startsWith\(/.test(fs.readFileSync(f, 'utf8')));
    expect(bad.map(rel)).toEqual([]);
  });

  it("нет инлайн-юниона 'ru' | 'en' — только тип Lang из src/lib/lang.ts", () => {
    const bad = files.filter((f) => /['"]ru['"]\s*\|\s*['"]en['"]/.test(fs.readFileSync(f, 'utf8')));
    // единственное законное место — сам lang.ts (CanonLang)
    expect(bad.map(rel)).toEqual(['src/lib/lang.ts']);
  });

  it('тип Lang объявлен ровно один раз', () => {
    const decl = files.filter((f) => /^\s*(export\s+)?type\s+Lang\s*=/m.test(fs.readFileSync(f, 'utf8')));
    expect(decl.map(rel)).toEqual(['src/lib/lang.ts']);
  });
});
