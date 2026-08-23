/** Аркан рождения (logic-spec §5): сумма ВСЕХ цифр даты рождения, пока результат больше 22 —
 *  суммируем его цифры; 22 — Дурак (number 0), 1–21 — старший аркан с этим номером.
 *  Чистые функции без импортов react/expo — как journal.ts и pushPlan.ts. */
import { cards } from './content';
import { normalizeText } from './journal';

/** Предел длины имени. Имя видно заголовком профиля в одну строку, поэтому лимит короткий;
 *  соседи — NOTE_MAX 500 и QUESTION_MAX 200 из journal.ts / spread.ts. */
export const NAME_MAX = 40;

/** Имя из поля ввода в вид, пригодный для хранения: пробелы по краям снять, длину обрезать.
 *  Своего trim().slice() не пишем — это ровно normalizeText, на котором живут заметки. */
export function normalizeName(raw: string): string {
  return normalizeText(raw, NAME_MAX);
}

/** Профиль пользователя (logic-spec §7). Пишется онбордингом одним куском (buildProfile);
 *  onboarded: false у дефолта стора — признак «онбординг ещё не пройден». */
export interface Profile {
  name?: string;
  /** YYYY-MM-DD, локальная дата — как все даты проекта */
  birthDate?: string;
  birthArcanaId?: string;
  onboarded: boolean;
}

const digitSum = (s: string) =>
  [...s].reduce((sum, ch) => (ch >= '0' && ch <= '9' ? sum + Number(ch) : sum), 0);

/** Число рождения 1–22. Сумма цифр не зависит от порядка, поэтому считаем прямо
 *  по строке YYYY-MM-DD — ДД.ММ.ГГГГ из спеки не собираем. */
export function birthNumber(dateISO: string): number {
  let n = digitSum(dateISO);
  while (n > 22) n = digitSum(String(n));
  return n;
}

/** id карты аркана рождения. 22 старших аркана с number 0–21 в колоде есть всегда —
 *  контракт-тест контента держит это инвариантом, поэтому `!` безопасен. */
export function birthArcanaId(dateISO: string): string {
  const n = birthNumber(dateISO);
  const number = n === 22 ? 0 : n;
  return cards.find((c) => c.arcana === 'major' && c.number === number)!.id;
}

/** Сборка профиля финальной CTA онбординга: пустое имя не хранится пустой строкой,
 *  аркан считается только при выбранной дате. Нормализация общая с настройками (спека 59):
 *  до неё онбординг длину имени не ограничивал вовсе. */
export function buildProfile(name: string, birthDate?: string): Profile {
  const trimmed = normalizeName(name);
  return {
    ...(trimmed ? { name: trimmed } : {}),
    ...(birthDate ? { birthDate, birthArcanaId: birthArcanaId(birthDate) } : {}),
    onboarded: true,
  };
}
