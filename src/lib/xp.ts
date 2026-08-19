/** XP и уровни (logic-spec §4). Чистые функции без импортов react/expo — под юнит-тестами.
 *  Источники v1: урок 10 − 2×ошибки (мин 4) · повтор урока +2 (раз в день на урок) ·
 *  карта дня +5 · первый ответ рефлексии дня +3 · расклад целиком +5 при сохранении
 *  в дневник (спека 36). */

export const XP_DRAW = 5;
export const XP_REFLECT = 3;
export const REPEAT_XP = 2;
export const XP_SPREAD = 5;

/** +1 за вспомненную карту повторения (спека 45): начисляется в момент оценки ≥1 карты, которая
 *  была к повторению; потолок в день естественный — оценённая карта уходит на дни. */
export const XP_REVIEW = 1;

/** XP за первое прохождение урока: 10 − 2×ошибки, но не меньше 4. */
export function lessonXp(errors: number): number {
  return Math.max(10 - 2 * errors, 4);
}

/** XP за ответ вечерней рефлексии: +3 только за ПЕРВЫЙ ответ дня (prevOutcome ещё не задан),
 *  смена уже данного ответа второй раз ничего не начисляет. */
export function reflectXp(prevOutcome: string | undefined): number {
  return prevOutcome === undefined ? XP_REFLECT : 0;
}

// Накопительные пороги: L1 = 0, L2 = 50, L3 = 150, L4 = 300, L5 = 500, дальше каждый +250.
// Даунгрейда нет, XP не сгорает.
const THRESHOLDS = [0, 50, 150, 300, 500];
const STEP_AFTER = 250;

/** Сумма XP, с которой начинается уровень level (нумерация с 1). */
function levelStart(level: number): number {
  if (level <= THRESHOLDS.length) return THRESHOLDS[level - 1];
  return THRESHOLDS[THRESHOLDS.length - 1] + STEP_AFTER * (level - THRESHOLDS.length);
}

/** Уровень по сумме XP + доля пути до следующего уровня (0..1) — для полосы XpPill. */
export function levelFromXp(xp: number): { level: number; progress: number } {
  let level = 1;
  while (xp >= levelStart(level + 1)) level++;
  const start = levelStart(level);
  return { level, progress: (xp - start) / (levelStart(level + 1) - start) };
}

/** Сумма XP, с которой начнётся следующий уровень — для подписи «X / Y XP» карточки
 *  уровня в профиле (спека 16): полоса там заполняется долей xp / nextLevelXp(level). */
export function nextLevelXp(level: number): number {
  return levelStart(level + 1);
}

/** Титул шестого уровня носят все уровни выше (logic-spec §4). */
export const LAST_TITLE = 6;

/** i18n-ключ титула уровня — общий для пилюли «Сегодня» и карточки уровня профиля. */
export function levelTitleKey(level: number): string {
  return `level.t${Math.min(level, LAST_TITLE)}`;
}
