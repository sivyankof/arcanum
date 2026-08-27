/** Контракт разрешений Android (задача 64). Play Console открывает декларацию «Здоровье» не по
 *  функциям приложения, а по манифесту: `expo-sensors` добавляет `ACTIVITY_RECOGNITION` ради
 *  шагомера, а нам нужен только `DeviceMotion` (наклон карты, `useDeviceTilt`). Сдать «функций
 *  нет» консоль не даёт — «Далее» без выбранных функций неактивна, и она прямо просит убрать
 *  разрешение из манифеста. Тест держит обе половины решения: разрешение заблокировано в app.json
 *  И шагомер в коде не используется (иначе блокировка сломала бы фичу молча). Настоящая проверка —
 *  манифест собранного AAB (`base/manifest/AndroidManifest.xml` без этой строки), бэклог 64. */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../../..');
const BLOCKED = 'android.permission.ACTIVITY_RECOGNITION';

/** Все .ts/.tsx под каталогом, кроме тестов (этот файл сам содержит слово Pedometer). */
function sources(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (name !== '__tests__' && name !== 'node_modules') sources(full, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe('разрешения Android (задача 64)', () => {
  it('app.json блокирует ACTIVITY_RECOGNITION, который приносит expo-sensors', () => {
    const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
    expect(app.expo.android.blockedPermissions).toContain(BLOCKED);
  });

  it('expo-sensors действительно добавляет это разрешение — иначе блокировка была бы мёртвой строкой', () => {
    const manifest = fs.readFileSync(
      path.join(ROOT, 'node_modules/expo-sensors/android/src/main/AndroidManifest.xml'),
      'utf8',
    );
    expect(manifest).toContain(BLOCKED);
  });

  it('шагомер (Pedometer) в коде не используется — блокировка ничего не ломает', () => {
    const files = [...sources(path.join(ROOT, 'src')), ...sources(path.join(ROOT, 'app'))];
    const users = files.filter((f) => /Pedometer/.test(fs.readFileSync(f, 'utf8')));
    expect(users).toEqual([]);
  });
});
