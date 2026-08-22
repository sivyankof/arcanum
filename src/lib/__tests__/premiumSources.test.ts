/** Страж правила спеки 53: экраны не решают доступ по флагу free и не читают premium.active сами —
 *  только через src/lib/premium.ts. Образец — langSources.test.ts. */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../../..');
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
const files = ['app', 'src/components'].flatMap((d) => walk(path.join(ROOT, d)));
const rel = (p: string) => path.relative(ROOT, p).replace(/\\/g, '/');

describe('доступ Premium решается только в premium.ts (спека 53)', () => {
  it('исходники найдены (иначе тест проверял бы пустоту)', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it('никто не сравнивает .free в условиях доступа', () => {
    // плашка «ПРЕМИУМ» показывает флаг — это разрешено, если строка помечена комментарием-маркером
    // на той же строке (маркер здесь не пишется буквально — иначе тест поймал бы сам себя)
    const marker = ['показ', 'флага'].join(' ');
    const bad = files.filter((f) => {
      const src = fs.readFileSync(f, 'utf8');
      const unmarked = src.replace(new RegExp(`.*// ${marker}.*`, 'g'), '');
      return /!\w+\.free\b|\.free\s*(===|!==|&&|\|\||\?)/.test(unmarked);
    });
    expect(bad.map(rel)).toEqual([]);
  });

  it('premium.active читают только пейвол и настройки', () => {
    const bad = files.filter((f) => /premium\.active/.test(fs.readFileSync(f, 'utf8')));
    expect(bad.map(rel).sort()).toEqual(['app/paywall.tsx', 'app/settings.tsx']);
  });
});
