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
import type { Lang } from './lang';
import { pushBody } from './pushBody';
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

// реэкспорт для паритета публичного API с `pushes.ts`, хотя на вебе её никто не зовёт:
// `applyPlan` и `sendTestPush` ниже ничего не планируют. Раньше здесь лежала ручная копия
// функции — регресс-тест на плюрализацию {days} проверял именно её, а не «боевую» версию из
// `pushes.ts`, поэтому баг там тест бы не поймал (пункт 3 второй волны фиксов 06б). Теперь
// обе версии — один и тот же код из `pushBody.ts` (модуль без единого импорта expo-notifications,
// поэтому его можно спокойно тянуть и в веб-бандл)
export { pushBody };

export function applyPlan(_plan: PlannedPush[], _lang: Lang): Promise<void> {
  return Promise.resolve();
}

/** Для DEV-строки «План пушей»: на вебе очередь ОС всегда пуста, строки плана печатаются
 *  всё равно (см. комментарий в app/settings.tsx) — это ожидаемое поведение, не баг. */
export async function listScheduled(): Promise<unknown[]> {
  return [];
}

export async function sendTestPush(_lang: Lang): Promise<void> {
  return Promise.resolve();
}
