/** Контракт исходников карт (спека 42): все 78 файлов assets/cards/<id>.jpg — JPEG шириной ровно
 *  900 px и пропорцией 1.68–1.76 (кадр по чёрной рамке рисунка). Ловит откат конвейера к мелким
 *  сканам и странный кадр отдельной карты. Парсер заголовка — общий `imageHeaders.ts`.
 *  Тест писался ДО замены ассетов и был красным на 73 картах шириной 300 (проверка честности). */
import fs from 'fs';
import path from 'path';
import { cards } from '../content';
import { jpegSize } from '../imageHeaders';

const DIR = path.join(__dirname, '../../../assets/cards');
const WIDTH = 900;
const ASPECT: [number, number] = [1.68, 1.76];

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
