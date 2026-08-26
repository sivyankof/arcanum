/** Размеры и формат картинки из заголовка файла — без декодера (для контракт-тестов ассетов).
 *  Вынесено из cardAssets.test.ts (JPEG) и notificationIcon.test.ts (PNG) задачей 63, когда
 *  потребителей стало три (правило DRY). Лежит в src/lib/, а НЕ в __tests__/: testMatch в этом
 *  проекте — jest-дефолт `**\/__tests__\/**\/*.[jt]s?(x)` (никакого требования на суффикс `test`,
 *  это не multi-project пресет jest-expo) — ЛЮБОЙ файл внутри __tests__/ становится сьютом и
 *  падает «must contain at least one test»; проверено прогоном при переносе задачей 63. */

/** JPEG: размер лежит в первом SOF-маркере (C0–CF, кроме C4/C8/CC):
 *  [len 2][precision 1][height 2][width 2]. */
export function jpegSize(buf: Buffer): { w: number; h: number } {
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

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** PNG: IHDR обязан быть первым чанком: [8 сигнатура][4 длина][4 "IHDR"][4 ширина][4 высота]
 *  [1 глубина][1 тип цвета]. colorType: 2 — RGB (24-bit, без альфы), 6 — RGBA (32-bit). */
export function pngHeader(buf: Buffer): { w: number; h: number; depth: number; colorType: number } {
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('не PNG: сигнатура не совпала');
  if (buf.toString('ascii', 12, 16) !== 'IHDR') throw new Error('первый чанк не IHDR');
  return {
    w: buf.readUInt32BE(16),
    h: buf.readUInt32BE(20),
    depth: buf.readUInt8(24),
    colorType: buf.readUInt8(25),
  };
}
