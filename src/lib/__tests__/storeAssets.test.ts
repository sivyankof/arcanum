/** Контракт материалов витрины Google Play (спека 63): файлы в docs/store/ соответствуют требованиям
 *  магазина по заголовкам (размер, формат), подписи кадров есть на всех языках. Пиксели (альфа,
 *  полнота иконки) проверяет генератор scripts/store_assets.py — здесь только то, что дёшево без
 *  декодера. «Баннер стал 1024×512» или «кадр 1080×2340» выясняются тут, а не в консоли Play.
 *  Красный прогон получен МУТАЦИЕЙ (баннеры Playwright на 26.08 уже RGB, colorType 6 не воспроизводится
 *  само собой): `python -c "from PIL import Image; Image.open('docs/store/feature/ru.png').convert('RGBA').save('docs/store/feature/ru.png')"`
 *  роняет «ru: PNG 1024×500 без альфы» до `store_assets.py feature`; вторая мутация — не тот размер
 *  баннера — роняет проверку размера. */
import fs from 'fs';
import path from 'path';
import { LANGS } from '../lang';
import { jpegSize, pngHeader } from '../imageHeaders';

const ROOT = path.join(__dirname, '../../..');
const STORE = path.join(ROOT, 'docs/store');
const GOOGLE = { w: 1080, h: 1920, min: 2, max: 8 };
const APPLE = { w: 1290, h: 2796, min: 1, max: 10 };
const TITLE_MAX = 25; // бюджет строки при кеглях frame.html — тот же, что в store_assets.py
const SUB_MAX = 46;

const captions = JSON.parse(fs.readFileSync(path.join(STORE, 'captions.json'), 'utf8')) as {
  tagline: Record<string, string>;
  screens: Record<string, Record<string, [string, string]>>;
};

describe('иконка витрины 512', () => {
  it('PNG 512×512, 32-bit (RGBA), ≤ 1024 KB', () => {
    const buf = fs.readFileSync(path.join(STORE, 'icon-512.png'));
    expect(pngHeader(buf)).toEqual({ w: 512, h: 512, depth: 8, colorType: 6 });
    expect(buf.length).toBeLessThanOrEqual(1024 * 1024);
  });
});

describe('баннер 1024×500 на каждом языке', () => {
  it.each(LANGS)('%s: PNG 1024×500 без альфы (colorType 2)', (lang) => {
    const buf = fs.readFileSync(path.join(STORE, 'feature', `${lang}.png`));
    expect(pngHeader(buf)).toEqual({ w: 1024, h: 500, depth: 8, colorType: 2 });
  });
});

function checkShots(dir: string, spec: { w: number; h: number; min: number; max: number }) {
  for (const lang of LANGS) {
    const files = fs.readdirSync(path.join(dir, lang)).filter((f) => f.endsWith('.jpg')).sort();
    expect({ lang, ok: files.length >= spec.min && files.length <= spec.max, n: files.length })
      .toEqual({ lang, ok: true, n: files.length });
    for (const f of files) {
      const size = jpegSize(fs.readFileSync(path.join(dir, lang, f)));
      expect({ lang, f, ...size }).toEqual({ lang, f, w: spec.w, h: spec.h });
    }
  }
}

describe('скриншоты телефона', () => {
  it('Google: у каждого языка 2–8 JPEG ровно 1080×1920, набор одинаковый по языкам', () => {
    checkShots(path.join(STORE, 'google'), GOOGLE);
    const sets = LANGS.map((l) => fs.readdirSync(path.join(STORE, 'google', l)).sort().join());
    expect(new Set(sets).size).toBe(1);
  });
  it('Apple (если каталог есть — до 63б не коммитится): 1–10 JPEG 1290×2796', () => {
    const dir = path.join(STORE, 'apple');
    if (!fs.existsSync(dir)) return;
    checkShots(dir, APPLE);
  });
  it('число кадров = число экранов в captions.json', () => {
    const n = fs.readdirSync(path.join(STORE, 'google', 'ru')).filter((f) => f.endsWith('.jpg')).length;
    expect(n).toBe(Object.keys(captions.screens).length);
  });
});

describe('подписи кадров (captions.json)', () => {
  it('слоган баннера есть на каждом языке и совпадает с подзаголовком iOS из store-listing.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'docs/store-listing.md'), 'utf8');
    for (const lang of LANGS) {
      const m = md.match(new RegExp(`### ${lang} · подзаголовок iOS \\(30\\)\\r?\\n([^\\r\\n]+)`));
      expect({ lang, tagline: captions.tagline[lang] }).toEqual({ lang, tagline: m?.[1] });
    }
  });
  it('каждый экран несёт все языки, заголовок ≤ 25 и подстрока ≤ 46 символов', () => {
    for (const [id, byLang] of Object.entries(captions.screens)) {
      for (const lang of LANGS) {
        const pair = byLang[lang];
        expect({ id, lang, has: Array.isArray(pair) && pair.length === 2 }).toEqual({ id, lang, has: true });
        expect({ id, lang, title: [...pair[0]].length <= TITLE_MAX }).toEqual({ id, lang, title: true });
        expect({ id, lang, sub: [...pair[1]].length <= SUB_MAX }).toEqual({ id, lang, sub: true });
      }
    }
  });
});
