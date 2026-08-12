/** Веб-версия адаптера пушей — пустышки, БЕЗ единого импорта из `expo-notifications`.
 *
 *  Раньше единственным файлом был `pushes.ts` с проверками `Platform.OS === 'web'` внутри
 *  каждой функции — защита работала, но сам факт `import * as Notifications from 'expo-notifications'`
 *  наверху файла заставлял Metro включить модуль в веб-бандл целиком. У модуля есть побочный
 *  эффект уже на этапе импорта (регистрирует слушателя изменений push-токена), поэтому в консоли
 *  браузера на каждой загрузке появлялось предупреждение `[expo-notifications] Listening to push
 *  token changes is not yet fully supported on web` — притом что ни одна функция файла на вебе
 *  токены не спрашивает. Metro сам выбирает этот файл для веб-платформы по суффиксу `.web.ts`
 *  (тот же приём, что и `TimePicker`/`TimePicker.web.tsx`, спека 06б), поэтому `expo-notifications`
 *  в веб-бандл больше не попадает вовсе.
 *
 *  Публичный набор экспортов и возвращаемые значения — те же, что у `pushes.ts` на вебе
 *  (`getPermission` нарочно отдаёт `'undetermined'`, а не `'denied'` — см. комментарий там же):
 *  поведение экрана настроек не меняется, меняется только то, что тянет за собой бандл.
 *  Нативные `Platform.OS === 'web'`-проверки в `pushes.ts` остаются как есть (защита на случай,
 *  если платформенное разрешение когда-нибудь подведёт) — пункт H финального ревью 06б.
 */
import { cardById } from './content';
import i18n from './i18n';
import { pickPhrase } from './phrases';
import type { PlannedPush } from './pushPlan';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export function initPushes(): Promise<void> {
  return Promise.resolve();
}

export async function getPermission(): Promise<PermissionState> {
  return 'undetermined';
}

export async function requestPermission(): Promise<PermissionState> {
  return 'denied';
}

/** Чистая сборка текста — экспортируется для паритета публичного API с `pushes.ts`,
 *  хотя на вебе её никто не зовёт: `applyPlan` и `sendTestPush` ниже ничего не планируют.
 *  Логика — точная копия `pushBody` из `pushes.ts` (та же плюрализация {days}, пункт C
 *  финального ревью 06б): держать её одинаковой в обоих файлах важнее, чем не повторяться,
 *  иначе веб-копия однажды молча разойдётся с той, что реально шлёт уведомления. */
export function pushBody(p: PlannedPush, lang: 'ru' | 'en'): string {
  const card = p.cardId ? cardById.get(p.cardId) : undefined;
  const n = p.n ?? 0;
  return pickPhrase(p.phraseKey, p.date, lang, {
    card: card ? card.name[lang] : '',
    n,
    days: i18n.getFixedT(lang)('push.streakDays', { count: n }),
  });
}

export function applyPlan(_plan: PlannedPush[], _lang: 'ru' | 'en'): Promise<void> {
  return Promise.resolve();
}

/** Для DEV-строки «План пушей»: на вебе очередь ОС всегда пуста, строки плана печатаются
 *  всё равно (см. комментарий в app/settings.tsx) — это ожидаемое поведение, не баг. */
export async function listScheduled(): Promise<unknown[]> {
  return [];
}

export async function sendTestPush(_lang: 'ru' | 'en'): Promise<void> {
  return Promise.resolve();
}
