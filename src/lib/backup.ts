/** Бэкап (спека 11): формат файла экспорта, дефолты персистуемой схемы и строгая
 *  валидация при импорте. Чистый модуль без импортов expo/react — целиком под юнит-тестами.
 *  Ошибки — КОДЫ (ParseError), а не готовый текст: отображение в тексты — карта ERR_TEXT
 *  на экране настроек (тот же приём, что у pushPlan — план тоже отдаёт ключи, а не строки).
 *
 *  Здесь же живут SCHEMA_VERSION и PERSIST_DEFAULTS, которыми пользуется стор:
 *  версия схемы и дефолты лежат по одному разу, а бэкап по построению совпадает
 *  с тем, что реально персистится. */
import type { Profile } from './birthArcana';
import { cardById, spreadById } from './content';
import type { LessonProgressMap } from './courseProgress';
import { localDateISO } from './dates';
import { HISTORY_MAX, NOTE_MAX, type DailyDraw, type Outcome } from './journal';
import { isLang, type Lang } from './lang';
import { mergeReviewDay, REVIEW_DAY_DEFAULT, type ReviewDay, type SrsMap } from './review';
import { DEFAULT_SETTINGS, mergeSettings, type AppSettings } from './settings';
import { QUESTION_MAX, SPREADS_MAX, type SpreadDraw } from './spread';
import { EASE_MAX, EASE_MIN, MAX_INTERVAL_DAYS } from './srs';
// FREEZE_MAX — runtime-импорт из чистого модуля streak.ts (без цикла со стором, как и с journal/content)
import { FREEZE_MAX } from './streak';
import type { ThemeMode } from '../theme/theme';

// потолки величин при импорте (волна фиксов финального ревью): без них абсурдное число
// в битом/подделанном файле проходит структурную проверку типов и уезжает в персист —
// например xp: 1e15 не ловится isCount (это просто целое ≥0), а levelFromXp линейным
// while вешает КАЖДЫЙ рендер пилюли уровня; лечится только переустановкой
const MAX_BACKUP_XP = 1_000_000;
const MAX_BACKUP_STREAK = 36_500; // сто лет серии — дальше файл точно не настоящий
const MAX_BACKUP_LESSONS = 1_000; // уроков в курсе на порядки меньше — подстраховка формата

/** Версия персистуемой схемы (logic-spec §7). Единственный источник: стор берёт её отсюда.
 *  v8 → v9 (спека 36): `spreadsHistory` — ключ верхнего уровня, дефолт `[]` доливается сам.
 *  v9 → v10 (спека 45): `srs` и `reviewDay` — ключи верхнего уровня, дефолты доливаются сами.
 *  v10 → v11 (спека 53): doneCount ВНУТРИ reviewDay — слияние руками (mergeReviewDay) в migrate
 *  и тут; premium — ключ стора ВНЕ бэкапа.
 *  v11 → v12 (спека 53б): plan и willRenew ВНУТРИ premium — слияние руками (mergePremium) в migrate;
 *  parseBackup не трогается — premium в файл бэкапа не входит (решение 4 спеки 53). */
export const SCHEMA_VERSION = 12;

/** Персистуемое состояние стора — ровно то, что уходит в бэкап (белый список).
 *  Dev-поля (devReflect) сюда не входят; полноту следит тип-контроль в useApp.ts. */
export interface BackupState {
  themeMode: ThemeMode;
  lang: Lang;
  installSeed: number;
  streak: number;
  lastDrawDate: string | null;
  freezes: number;
  freezeMonth: string | null;
  freezeSpentDate: string | null;
  history: DailyDraw[];
  spreadsHistory: SpreadDraw[];
  /** повторение (спека 45): состояние SM-2 по cardId и счётчик новых карт за день */
  srs: SrsMap;
  reviewDay: ReviewDay;
  lessonsProgress: LessonProgressMap;
  xp: number;
  settings: AppSettings;
  profile: Profile;
}

/** Дефолты персистуемой схемы — на них стоит и стор, и доливка старых бэкапов.
 *  Заморожены целиком, включая вложенные history/lessonsProgress/settings/profile: это
 *  мутабельный синглтон, который уходит по ССЫЛКЕ и в стор (`...PERSIST_DEFAULTS` — спред
 *  поверхностный, вложенные объекты не копируются), и в parseBackup при доливке старых
 *  бэкапов — случайная мутация на месте в одном месте испортила бы дефолты всего процесса.
 *  Существующий код мутаций на месте не делает (всюду спред), тест — весь npm test зелёный. */
export const PERSIST_DEFAULTS: BackupState = Object.freeze({
  themeMode: 'dark',
  lang: 'ru',
  installSeed: 0,
  streak: 0,
  lastDrawDate: null,
  freezes: 1,
  freezeMonth: null,
  freezeSpentDate: null,
  // readonly-массив структурно несовместим с DailyDraw[] (методы мутации отсутствуют
  // в типе) — двойной каст через unknown только для типов, где это бьёт компиляцию
  history: Object.freeze([]) as unknown as DailyDraw[],
  spreadsHistory: Object.freeze([]) as unknown as SpreadDraw[],
  srs: Object.freeze({}) as SrsMap,
  reviewDay: Object.freeze(REVIEW_DAY_DEFAULT) as ReviewDay,
  lessonsProgress: Object.freeze({}) as LessonProgressMap,
  xp: 0,
  settings: Object.freeze(DEFAULT_SETTINGS),
  profile: Object.freeze({ onboarded: false }) as Profile,
});

export const BACKUP_KEYS = Object.keys(PERSIST_DEFAULTS) as (keyof BackupState)[];

/** Конверт файла бэкапа (спека 11). */
export interface BackupFile {
  app: 'arcanum';
  kind: 'backup';
  schemaVersion: number;
  exportedAt: string;
  state: BackupState;
}

/** Собирает файл экспорта: из состояния стора берётся ТОЛЬКО белый список. */
export function buildBackup(state: BackupState, schemaVersion: number, exportedAt: string): BackupFile {
  const picked = {} as BackupState;
  // прогон по белому списку, а не spread: у getState() кроме данных есть экшены и dev-поля
  for (const k of BACKUP_KEYS) (picked as unknown as Record<string, unknown>)[k] = state[k];
  return { app: 'arcanum', kind: 'backup', schemaVersion, exportedAt, state: picked };
}

export function backupFileName(dateISO: string): string {
  return `arcanum-backup-${dateISO}.json`;
}

/** Сводка для диалога подтверждения импорта. День бэкапа — локальный, как все даты проекта. */
export function backupSummary(p: { state: BackupState; exportedAt: string }): {
  entries: number;
  streak: number;
  dateISO: string;
} {
  return {
    entries: p.state.history.length,
    streak: p.state.streak,
    dateISO: localDateISO(new Date(p.exportedAt)),
  };
}

/** Язык из файла бэкапа — восстанавливаемая настройка пользователя, такая же, как тема (спека 27,
 *  волна фиксов финального ревью): человек переезжает на новый телефон, первая установка
 *  определяет язык устройства, а восстановление бэкапа обязано вернуть ЕГО язык, иначе поверх
 *  русского дневника окажется английский интерфейс. Ограничитель: файл может нести язык,
 *  недоступного в ТЕКУЩЕЙ сборке (в релизе доступны только языки, у которых есть строки
 *  интерфейса, — `available`, снимок AVAILABLE_LANGS на момент импорта) — тогда строка настроек
 *  показала бы, например, «Español», а пункта под него в списке выбора не нашлось бы. В этом
 *  случае оставляем язык, который уже действует на устройстве.
 *  Чистая функция специально ради теста: раньше ни разу не проверялось не «файл валиден»
 *  (это покрывал parseBackup), а «файл ПРИМЕНЁН» — в этом и была дыра дефекта. */
export function resolveImportedLang(fileLang: Lang, currentLang: Lang, available: readonly Lang[]): Lang {
  return available.includes(fileLang) ? fileLang : currentLang;
}

export type ParseError = 'notBackup' | 'newerVersion' | 'corrupt';
export type ParsedBackup =
  | { ok: true; state: BackupState; exportedAt: string }
  | { ok: false; error: ParseError };

// узкие проверки: JSON пришёл снаружи, каждому полю — свой тип
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isCount = (v: unknown): v is number => isNum(v) && Number.isInteger(v) && v >= 0;
// разбор групп, а не Date: Date.parse('2026-13-45') NaN, но '2026-02-30' Date молча
// перекатывает на март — здесь нужна именно строгая проверка диапазона, не календаря
const isISODay = (v: unknown): v is string => {
  if (!isStr(v)) return false;
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const month = Number(m[1]);
  const day = Number(m[2]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
};
const isMonth = (v: unknown): v is string => isStr(v) && /^\d{4}-\d{2}$/.test(v);
const isHHMM = (v: unknown): v is string => {
  if (!isStr(v)) return false;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (!m) return false;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour <= 23 && minute <= 59;
};
const isOutcome = (v: unknown): v is Outcome => v === 'yes' || v === 'partly' || v === 'no';
const orNull = (v: unknown, check: (x: unknown) => boolean) => v === null || check(v);
const orAbsent = (v: unknown, check: (x: unknown) => boolean) => v === undefined || check(v);

// cardId проверяем по колоде: 78 карт — полный и вечный набор, чужой id означает чужой
// или битый файл. Id уроков против course НЕ проверяем сознательно: контент растёт без
// смены schemaVersion (М3–М6), и бэкап с новыми уроками обязан открываться старым контентом.
const isDraw = (v: unknown): boolean =>
  isObj(v) && isISODay(v.date) && isStr(v.cardId) && cardById.has(v.cardId) &&
  isBool(v.reversed) && orAbsent(v.outcome, isOutcome) &&
  orAbsent(v.note, (x) => isStr(x) && x.length <= NOTE_MAX);

const isDrawnCard = (v: unknown): boolean =>
  isObj(v) && isStr(v.cardId) && cardById.has(v.cardId) && isBool(v.reversed);

// расклад сверяем с каталогом: чужой spreadId или число карт не по раскладу — чужой/битый файл;
// дубль карты внутри расклада невозможен по построению (Фишер–Йетс, logic-spec §1а)
const isSpreadDraw = (v: unknown): boolean => {
  if (!isObj(v) || !isCount(v.ts) || !isISODay(v.date) || !isStr(v.spreadId)) return false;
  const spread = spreadById.get(v.spreadId);
  if (!spread || !Array.isArray(v.cards) || v.cards.length !== spread.cards || !v.cards.every(isDrawnCard)) return false;
  const ids = new Set((v.cards as { cardId: string }[]).map((c) => c.cardId));
  return (
    ids.size === v.cards.length &&
    orAbsent(v.question, (x) => isStr(x) && x.length <= QUESTION_MAX) &&
    orAbsent(v.note, (x) => isStr(x) && x.length <= NOTE_MAX)
  );
};

const isLesson = (v: unknown): boolean =>
  isObj(v) && isBool(v.done) && isCount(v.errors) && isNum(v.ts) && orAbsent(v.repeatDate, isISODay);

// повторение (спека 45): состояние карты — в коридорах алгоритма (ease 1.3..5, интервал ≤ 365),
// ключи — только id колоды; reviewDay.date пуст до первой новой карты
const isSrsState = (v: unknown): boolean =>
  isObj(v) && isCount(v.reps) && isCount(v.intervalDays) && v.intervalDays <= MAX_INTERVAL_DAYS &&
  isNum(v.ease) && v.ease >= EASE_MIN && v.ease <= EASE_MAX && isISODay(v.due);
const isSrsMap = (v: unknown): boolean =>
  isObj(v) && Object.keys(v).length <= cardById.size &&
  Object.entries(v).every(([id, s]) => cardById.has(id) && isSrsState(s));
const isReviewDay = (v: unknown): boolean =>
  isObj(v) && (v.date === '' || isISODay(v.date)) &&
  isCount(v.newCount) && v.newCount <= cardById.size &&
  isCount(v.doneCount) && v.doneCount <= cardById.size * 4; // карта может уйти и вернуться несколько раз за день

// после mergeSettings все ключи на месте — проверяем типы значений (слияние типы не проверяет)
const isSettings = (v: AppSettings): boolean =>
  isBool(v.reflectionOn) && isBool(v.pushesOn) &&
  isHHMM(v.pushMorning) && isHHMM(v.pushEvening) && isBool(v.pushAsked);

const isProfile = (v: unknown): boolean =>
  isObj(v) && isBool(v.onboarded) && orAbsent(v.name, isStr) &&
  orAbsent(v.birthDate, isISODay) &&
  orAbsent(v.birthArcanaId, (x) => isStr(x) && cardById.has(x));

const validState = (s: BackupState): boolean =>
  (s.themeMode === 'dark' || s.themeMode === 'light') &&
  isLang(s.lang) &&
  isCount(s.installSeed) && isCount(s.streak) && s.streak <= MAX_BACKUP_STREAK &&
  orNull(s.lastDrawDate, isISODay) &&
  isCount(s.freezes) && s.freezes <= FREEZE_MAX &&
  orNull(s.freezeMonth, isMonth) && orNull(s.freezeSpentDate, isISODay) &&
  Array.isArray(s.history) && s.history.length <= HISTORY_MAX && s.history.every(isDraw) &&
  Array.isArray(s.spreadsHistory) && s.spreadsHistory.length <= SPREADS_MAX && s.spreadsHistory.every(isSpreadDraw) &&
  isObj(s.lessonsProgress) && Object.keys(s.lessonsProgress).length <= MAX_BACKUP_LESSONS &&
  Object.values(s.lessonsProgress).every(isLesson) &&
  isSrsMap(s.srs) && isReviewDay(s.reviewDay) &&
  isCount(s.xp) && s.xp <= MAX_BACKUP_XP && isSettings(s.settings) && isProfile(s.profile);

/** Разбор и валидация файла бэкапа (спека 11): строгая, «всё или ничего».
 *  Порядок: конверт → версия → доливка дефолтов (как у гидрации persist) → типы полей. */
export function parseBackup(text: string, currentVersion: number): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'notBackup' };
  }
  if (
    !isObj(raw) || raw.app !== 'arcanum' || raw.kind !== 'backup' ||
    !isNum(raw.schemaVersion) || !isStr(raw.exportedAt) ||
    Number.isNaN(Date.parse(raw.exportedAt)) || !isObj(raw.state)
  ) {
    return { ok: false, error: 'notBackup' };
  }
  // схему из будущего не накатываем: поля, которых текущий код не знает, прошли бы молча
  if (raw.schemaVersion > currentVersion) return { ok: false, error: 'newerVersion' };

  const src = raw.state;
  // settings не-объектом раньше молча подменялся дефолтами через mergeSettings(null) —
  // противоречит решению спеки «всё или ничего»: чужой тип поля — признак битого файла,
  // а не повод тихо долить дефолты вместо него
  if (src.settings !== undefined && !isObj(src.settings)) return { ok: false, error: 'corrupt' };
  // та же ловушка для reviewDay (v11): mergeReviewDay не-объект тихо подменяет дефолтом
  // (это её роль в migrate стора, где persistedState доверенный) — здесь источник чужой,
  // и non-object обязан остаться corrupt, а не молча долиться до REVIEW_DAY_DEFAULT
  if (src.reviewDay !== undefined && !isObj(src.reviewDay)) return { ok: false, error: 'corrupt' };
  // доливка — ровно та же, что у гидрации persist: поверхностно по верхнему уровню…
  const state: BackupState = { ...PERSIST_DEFAULTS };
  for (const k of BACKUP_KEYS) {
    if (src[k] !== undefined) (state as unknown as Record<string, unknown>)[k] = src[k];
  }
  // …и mergeSettings для вложенного settings (ловушка поверхностного слияния, logic-spec §7)
  state.settings = mergeSettings(isObj(src.settings) ? (src.settings as Partial<AppSettings>) : null);
  // …и mergeReviewDay для вложенного reviewDay (v11: doneCount; правило-близнец logic-spec §7)
  state.reviewDay = mergeReviewDay(state.reviewDay);

  if (!validState(state)) return { ok: false, error: 'corrupt' };
  return { ok: true, state, exportedAt: raw.exportedAt };
}
