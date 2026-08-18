/** Контракт исходников карт (спека 42): все 78 файлов assets/cards/<id>.jpg — JPEG шириной ровно
 *  900 px и пропорцией 1.68–1.76 (кадр по чёрной рамке рисунка). Ловит откат конвейера к мелким
 *  сканам и странный кадр отдельной карты. Парсер SOF-заголовка — без библиотек: размер лежит
 *  в первом SOF-маркере (C0–CF, кроме C4/C8/CC): [len 2][precision 1][height 2][width 2].
 *  Тест писался ДО замены ассетов и был красным на 73 картах шириной 300 (проверка честности). */
import fs from 'fs';
import path from 'path';
import { cards } from '../content';

const DIR = path.join(__dirname, '../../../assets/cards');
const WIDTH = 900;
const ASPECT: [number, number] = [1.68, 1.76];

function jpegSize(buf: Buffer): { w: number; h: number } {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('не JPEG (нет SOI)');
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) throw new Error(`битый маркер на смещении ${i}`);
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i += 1; // байт-заполнитель между маркерами
      continue;
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error('SOF-маркер не найден');
}

describe('контракт исходников карт (assets/cards)', () => {
  it('всего 78 карт', () => {
    expect(cards).toHaveLength(78);
  });

  it.each(cards.map((c) => [c.id] as const))('%s: JPEG шириной 900, пропорция 1.68–1.76', (id) => {
    const file = path.join(DIR, `${id}.jpg`);
    expect(fs.existsSync(file)).toBe(true);
    const { w, h } = jpegSize(fs.readFileSync(file));
    expect(w).toBe(WIDTH);
    const aspect = h / w;
    expect(aspect).toBeGreaterThanOrEqual(ASPECT[0]);
    expect(aspect).toBeLessThanOrEqual(ASPECT[1]);
  });
});
