/** Чистая сборка тела пуша — без единого импорта `expo-notifications` (вторая волна фиксов 06б,
 *  пункт 3). Раньше функция была продублирована руками: «боевая» версия в `pushes.ts` и
 *  копия в `pushes.web.ts` (комментарий там объяснял, что копия нужна только затем, чтобы
 *  `pushes.web.ts` не тянул `expo-notifications` в веб-бандл). Регресс-тест на плюрализацию
 *  {days} проверял копию — сломай текст в «боевой» версии, набор тестов остался бы зелёным.
 *  Это ровно тот случай, который запрещает правило проекта «повторяется 2+ раза — выносить
 *  на верхний уровень»: теперь оба адаптера реэкспортируют одну и ту же функцию отсюда,
 *  и тест целится в неё же.
 */
import { cardById } from './content';
import i18n from './i18n';
import type { Lang } from './lang';
import { pickPhrase } from './phrases';
import type { PlannedPush } from './pushPlan';

/** Тело пуша: вариант выбирается по дате самого пуша, поэтому текст стабилен в течение дня
 *  (logic-spec §9) и не меняется при каждом пересчёте плана. */
export function pushBody(p: PlannedPush, lang: Lang): string {
  const card = p.cardId ? cardById.get(p.cardId) : undefined;
  const n = p.n ?? 0;
  return pickPhrase(p.phraseKey, p.date, lang, {
    card: card ? card.name[lang] : '',
    n,
    // готовая плюрализованная форма для {days} у push.streak_save («Серия {days}» вместо
    // «Серия {n} дней» — «Серия 3 дней» было согласованием только для одного числа, см. пункт C
    // финального ревью 06б). Переводчик берём ЯВНО под нужный язык (getFixedT), а не окружающий
    // i18n.t: тело и заголовок пуша обязаны совпадать по языку (пункт D)
    days: i18n.getFixedT(lang)('push.streakDays', { count: n }),
  });
}
