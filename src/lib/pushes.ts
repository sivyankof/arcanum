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

// Промис инициализации (а не булев флаг): планировщик пересчитывает план реактивно и может
// вызвать initPushes несколько раз почти одновременно (типичный случай — холодный старт: эффект
// срабатывает на дефолтном состоянии стора, затем ещё раз сразу после гидрации persist). Булев
// флаг выставлялся синхронно ДО завершения `setNotificationChannelAsync`, поэтому второй
// параллельный вызов видел `inited === true` и запускал `applyPlan`, пока канал Android ещё
// не был создан первым вызовом — та самая гонка, которую упорядочивание
// `initPushes().then(() => applyPlan(...))` должно было исключить. Храня сам промис, все
// конкурентные вызовы дожидаются ОДНОЙ настоящей инициализации.
let initPromise: Promise<void> | null = null;

/** Хендлер + канал. Идемпотентна: вызывается из планировщика на каждом пересчёте. */
export function initPushes(): Promise<void> {
  if (WEB) return Promise.resolve();
  if (!initPromise) {
    initPromise = initPushesImpl().catch((err) => {
      // сбой (например, `setNotificationChannelAsync` упал) не должен НАВСЕГДА заблокировать
      // инициализацию — сбрасываем промис, чтобы следующий пересчёт получил шанс попробовать
      // снова, а не унаследовал один раз отклонённый результат
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

async function initPushesImpl(): Promise<void> {
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

// Номер последнего вызова applyPlan и хвост цепочки его применений. Планировщик вызывает
// applyPlan реактивно на каждое изменение стора, а сама она — «отменить всё, затем поставить
// всё заново», не атомарная операция. Без сериализации два близких по времени пересчёта могли
// бы чередовать свои await'ы (cancelAll одного посреди scheduleNotificationAsync другого), и
// в очереди ОС осталась бы мешанина вместо согласованного плана. Каждый вызов встаёт в хвост
// этой цепочки (гарантия «не чередуемся») и клеймится растущим номером: если, пока вызов ждал
// своей очереди, пришёл более новый пересчёт, номер уже не совпадает с последним выданным —
// такой вызов бросает свою работу вместо того, чтобы дописывать в очередь устаревший план.
let planSeq = 0;
let applyChain: Promise<void> = Promise.resolve();

/** Снимает всё запланированное и ставит план заново. Другого способа выразить условные
 *  правила logic-spec §8 нет: система условий не проверяет, она просто шлёт в срок. */
export function applyPlan(plan: PlannedPush[], lang: 'ru' | 'en'): Promise<void> {
  if (WEB) return Promise.resolve();
  const mySeq = ++planSeq;
  const run = applyChain.then(() => applyPlanImpl(plan, lang, mySeq));
  // хвост цепочки не должен оборваться из-за ошибки одного вызова — иначе все последующие
  // пересчёты зависнут навсегда, ожидая уже отклонённый applyChain; саму ошибку наружу видит
  // вызывающий через промис `run`, который возвращаем как есть
  applyChain = run.catch(() => {});
  return run;
}

async function applyPlanImpl(plan: PlannedPush[], lang: 'ru' | 'en', mySeq: number): Promise<void> {
  // нас обогнали, пока мы ждали своей очереди в цепочке — писать устаревший план не нужно
  if (mySeq !== planSeq) return;

  await Notifications.cancelAllScheduledNotificationsAsync();
  if ((await getPermission()) !== 'granted') return;

  for (const p of plan) {
    // тот же самый обгон может случиться и посреди цикла — длинный план не должен дописывать
    // уведомления после того, как более новый пересчёт уже встал в очередь позади нас
    if (mySeq !== planSeq) return;
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
