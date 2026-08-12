/** Единственный модуль, знающий про expo-notifications.
 *
 *  Веб: `expo-notifications` браузер не поддерживает, поэтому все функции здесь на вебе —
 *  пустышки. Это не заглушка «на будущее», а условие проверяемости: экран настроек должен
 *  открываться и прокликиваться в браузере (шаг 6а процесса), даже когда пушей там нет.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { cardById } from './content';
import { localDateISO } from './dates';
import i18n from './i18n';
import { pickPhrase } from './phrases';
import type { PlannedPush, PushKind } from './pushPlan';

const WEB = Platform.OS === 'web';

/** Канал уведомлений Android: без него на Android 8+ уведомления не показываются вовсе. */
const CHANNEL_ID = 'daily';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

let inited = false;

/** Хендлер + канал. Идемпотентна: вызывается из планировщика на каждом пересчёте. */
export async function initPushes(): Promise<void> {
  if (WEB || inited) return;
  inited = true;

  // ⚠️ без этого на iOS баннер не показывается, пока приложение открыто, — и DEV-проверка
  // выглядит так, будто пуш не пришёл вовсе
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: i18n.t('settings.pushes'),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function getPermission(): Promise<PermissionState> {
  if (WEB) return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return status as PermissionState;
}

export async function requestPermission(): Promise<PermissionState> {
  if (WEB) return 'denied';
  const { status } = await Notifications.requestPermissionsAsync();
  return status as PermissionState;
}

const TITLE_KEY: Record<PushKind, string> = {
  morning: 'push.titleMorning',
  evening: 'push.titleEvening',
  streak: 'push.titleStreak',
  comeback: 'push.titleComeback',
};

/** Тело пуша: вариант выбирается по дате самого пуша, поэтому текст стабилен в течение дня
 *  (logic-spec §9) и не меняется при каждом пересчёте плана. */
export function pushBody(p: PlannedPush, lang: 'ru' | 'en'): string {
  const card = p.cardId ? cardById.get(p.cardId) : undefined;
  return pickPhrase(p.phraseKey, p.date, lang, {
    card: card ? card.name[lang] : '',
    n: p.n ?? 0,
  });
}

/** Снимает всё запланированное и ставит план заново. Другого способа выразить условные
 *  правила logic-spec §8 нет: система условий не проверяет, она просто шлёт в срок. */
export async function applyPlan(plan: PlannedPush[], lang: 'ru' | 'en'): Promise<void> {
  if (WEB) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if ((await getPermission()) !== 'granted') return;

  for (const p of plan) {
    const [y, m, d] = p.date.split('-').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t(TITLE_KEY[p.kind], { count: p.n ?? 0 }),
        body: pushBody(p, lang),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(y, m - 1, d, p.hour, p.minute),
        channelId: CHANNEL_ID,
      },
    });
  }
}

/** Для DEV-строки «План пушей». */
export async function listScheduled(): Promise<Notifications.NotificationRequest[]> {
  if (WEB) return [];
  return Notifications.getAllScheduledNotificationsAsync();
}

/** DEV: пуш через 10 секунд — успеть свернуть приложение и увидеть настоящий баннер. */
export async function sendTestPush(lang: 'ru' | 'en'): Promise<void> {
  if (WEB) return;
  await initPushes();
  const status = (await getPermission()) === 'granted' ? 'granted' : await requestPermission();
  if (status !== 'granted') return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: i18n.t('push.titleMorning'),
      body: pickPhrase('push.morning_card', localDateISO(), lang),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 10,
      channelId: CHANNEL_ID,
    },
  });
}
