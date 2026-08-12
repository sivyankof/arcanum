/** Единственный модуль, знающий про expo-notifications.
 *
 *  Веб: `expo-notifications` браузер не поддерживает, поэтому все функции здесь на вебе —
 *  пустышки. Это не заглушка «на будущее», а условие проверяемости: экран настроек должен
 *  открываться и прокликиваться в браузере (шаг 6а процесса), даже когда пушей там нет.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { localDateISO } from './dates';
import i18n from './i18n';
import { pickPhrase } from './phrases';
import { pushBody } from './pushBody';
import type { PlannedPush, PushKind } from './pushPlan';

// реэкспорт: `pushBody` — чистая сборка текста, живёт в `pushBody.ts` без единого импорта
// expo-notifications, чтобы её мог напрямую проверять юнит-тест (пункт 3 второй волны фиксов
// 06б). Здесь только публикуем то же имя — паблик API модуля не меняется
export { pushBody };

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
    handleNotification: async () => {
      // ДИАГНОСТИКА (временно): доходит ли до нас запрос «показывать ли баннер»
      console.log('[push-debug] handleNotification: система спросила, отвечаю «показать»');
      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    },
    // ДИАГНОСТИКА (временно): сюда попадают сбой обработчика и таймаут ответа (3 секунды)
    handleError: (id, err) => console.log('[push-debug] handleNotification ОШИБКА:', id, err),
    handleSuccess: (id) => console.log('[push-debug] handleNotification успех:', id),
  });
  // ДИАГНОСТИКА (временно): подтверждение, что обработчик вообще зарегистрирован
  console.log('[push-debug] обработчик показа зарегистрирован');

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: i18n.t('settings.pushes'),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function getPermission(): Promise<PermissionState> {
  // 'undetermined', а не 'denied': на вебе систему в принципе не спросишь, а не «спросили и
  // отказали» — это разные состояния. Отдать здесь 'denied' удобно выглядело бы как честный
  // отказ, но экран настроек читает 'denied' как «прятать блок напоминаний и открывать системные
  // настройки по тапу», а react-native-web не даёт открыть то, чего у него нет (нет
  // Linking.openSettings) — так браузерная проверка этого экрана становится невозможной,
  // хотя весь смысл веб-заглушек модуля в том, чтобы экран оставался прокликиваемым в браузере.
  // НЕ возвращать сюда 'denied' обратно — это тот самый регресс.
  if (WEB) return 'undetermined';
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

  // ДИАГНОСТИКА (временно, разбор «тестовый пуш не приходит при открытом приложении»)
  console.log('[push-debug] applyPlan: снимаю очередь, seq', mySeq, 'план из', plan.length);
  await Notifications.cancelAllScheduledNotificationsAsync();
  if ((await getPermission()) !== 'granted') return;

  // фиксированный переводчик под ПЕРЕДАННЫЙ lang, а не окружающий i18n.t: заголовок и тело
  // должны быть на одном языке. `app/_layout.tsx` вызывает `usePushScheduler()` раньше эффекта,
  // который зовёт `i18n.changeLanguage`, — сразу после смены языка в настройках ambient-язык ещё
  // старый, и заголовок с i18n.t мог бы разъехаться с телом (пункт D финального ревью 06б)
  const tFixed = i18n.getFixedT(lang);

  for (const p of plan) {
    // тот же самый обгон может случиться и посреди цикла — длинный план не должен дописывать
    // уведомления после того, как более новый пересчёт уже встал в очередь позади нас
    if (mySeq !== planSeq) return;
    const [y, m, d] = p.date.split('-').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: tFixed(TITLE_KEY[p.kind], { count: p.n ?? 0 }),
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
  // ДИАГНОСТИКА (временно, разбор «тестовый пуш не приходит при открытом приложении»)
  console.log('[push-debug] sendTestPush: разрешение =', status);
  if (status !== 'granted') return;
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      // фиксированный переводчик под lang — та же причина, что в applyPlanImpl (пункт D)
      title: i18n.getFixedT(lang)('push.titleMorning'),
      body: pickPhrase('push.morning_card', localDateISO(), lang),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 10,
      channelId: CHANNEL_ID,
    },
  });
  // ДИАГНОСТИКА (временно): id поставленного уведомления и полный состав очереди сразу после
  console.log('[push-debug] sendTestPush: поставлен id =', id);
  const queue = await Notifications.getAllScheduledNotificationsAsync();
  console.log('[push-debug] в очереди сразу после постановки:', queue.length, queue.map((r) => r.identifier));
}
