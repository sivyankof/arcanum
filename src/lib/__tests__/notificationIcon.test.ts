/** Контракт иконки пуш-уведомления Android (спека 55). Android рисует в статус-баре силуэт:
 *  требование Google — «all-white design with a transparent background», иначе система покажет
 *  белый квадрат вместо рисунка. Увидеть это можно ТОЛЬКО на сборке (в Expo Go иконок нет
 *  в принципе, урок задачи 12), поэтому единственная проверка до сборки — здесь.
 *
 *  Разделение труда с генератором `scripts/gen_notification_icon.py`: тест держит формат и связку
 *  «app.json ↔ файл», а белизну пикселей проверяет сам генератор после записи — unfilter PNG
 *  в jest без зависимостей это 50 строк ради одной картинки. Правишь иконку руками, минуя
 *  скрипт, — цветной пиксель тест не поймает, поэтому иконка перерисовывается только скриптом. */
import fs from 'fs';
import path from 'path';
import { pngHeader } from '../imageHeaders';

const ROOT = path.join(__dirname, '../../..');
const ICON = path.join(ROOT, 'assets/images/notification-icon.png');

// размер и формат — pngHeader из imageHeaders.ts

describe('иконка пуша Android (спека 55)', () => {
  it('файл существует и это PNG 96×96 RGBA', () => {
    expect(fs.existsSync(ICON)).toBe(true);
    const h = pngHeader(fs.readFileSync(ICON));
    expect({ w: h.w, h: h.h }).toEqual({ w: 96, h: 96 });
    expect(h.depth).toBe(8);
    expect(h.colorType).toBe(6); // 6 = RGBA: без альфы Android залил бы фон сплошным белым
  });

  it('app.json подключает expo-notifications и указывает на существующий файл', () => {
    const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
    const entry = (app.expo.plugins as unknown[]).find(
      (p): p is [string, Record<string, string>] => Array.isArray(p) && p[0] === 'expo-notifications',
    );
    expect(entry).toBeDefined();
    const opts = entry![1];
    // путь из app.json проверяется на диске: опечатка в имени файла молча оставила бы
    // приложение с иконкой по умолчанию, и это выяснилось бы только на устройстве
    expect(fs.existsSync(path.join(ROOT, opts.icon))).toBe(true);
    expect(opts.color).toMatch(/^#[0-9a-f]{6}$/i);
    // канал тот же, что создаёт pushes.ts: расхождение оставило бы уведомления в канале
    // без настроек плагина
    expect(opts.defaultChannel).toBe('daily');
  });

  it('канал плагина совпадает с CHANNEL_ID в pushes.ts', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/lib/pushes.ts'), 'utf8');
    const m = src.match(/CHANNEL_ID\s*=\s*'([^']+)'/);
    expect(m?.[1]).toBe('daily');
  });
});
