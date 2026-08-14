/** Бэкап (спека 11): формат файла экспорта, дефолты персистуемой схемы и строгая
 *  валидация при импорте. Чистый модуль без импортов expo/react — целиком под юнит-тестами.
 *  Ошибки отдаются КОДАМИ (ключи i18n), а не готовым текстом — приём pushPlan.
 *
 *  Здесь же живут SCHEMA_VERSION и PERSIST_DEFAULTS, которыми пользуется стор:
 *  версия схемы и дефолты лежат по одному разу, а бэкап по построению совпадает
 *  с тем, что реально персистится. */
import type { Profile } from './birthArcana';
import { cardById } from './content';
import type { LessonProgressMap } from './courseProgress';
import { localDateISO } from './dates';
import { HISTORY_MAX, type DailyDraw, type Outcome } from './journal';
import { DEFAULT_SETTINGS, mergeSettings, type AppSettings } from './settings';
import type { ThemeMode } from '../theme/theme';
// type-only импорт стирается при компиляции — runtime-цикла со стором нет,
// хотя стор импортирует этот модуль по-настоящему
import type { Lang } from '../store/useApp';

/** Версия персистуемой схемы (logic-spec §7). Единственный источник: стор берёт её отсюда.
 *  Следующая задача, меняющая схему, поднимает ЭТУ константу до 8. */
export const SCHEMA_VERSION = 7;

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
  lessonsProgress: LessonProgressMap;
  xp: number;
  settings: AppSettings;
  profile: Profile;
}

/** Дефолты персистуемой схемы — на них стоит и стор, и доливка старых бэкапов. */
export const PERSIST_DEFAULTS: BackupState = {
  themeMode: 'dark',
  lang: 'ru',
  installSeed: 0,
  streak: 0,
  lastDrawDate: null,
  freezes: 1,
  freezeMonth: null,
  freezeSpentDate: null,
  history: [],
  lessonsProgress: {},
  xp: 0,
  settings: DEFAULT_SETTINGS,
  profile: { onboarded: false },
};

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
const isISODay = (v: unknown): v is string => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isMonth = (v: unknown): v is string => isStr(v) && /^\d{4}-\d{2}$/.test(v);
const isHHMM = (v: unknown): v is string => isStr(v) && /^\d{1,2}:\d{2}$/.test(v);
const isOutcome = (v: unknown): v is Outcome => v === 'yes' || v === 'partly' || v === 'no';
const orNull = (v: unknown, check: (x: unknown) => boolean) => v === null || check(v);
const orAbsent = (v: unknown, check: (x: unknown) => boolean) => v === undefined || check(v);

// cardId проверяем по колоде: 78 карт — полный и вечный набор, чужой id означает чужой
// или битый файл. Id уроков против course НЕ проверяем сознательно: контент растёт без
// смены schemaVersion (М3–М6), и бэкап с новыми уроками обязан открываться старым контентом.
const isDraw = (v: unknown): boolean =>
  isObj(v) && isISODay(v.date) && isStr(v.cardId) && cardById.has(v.cardId) &&
  isBool(v.reversed) && orAbsent(v.outcome, isOutcome) && orAbsent(v.note, isStr);

const isLesson = (v: unknown): boolean =>
  isObj(v) && isBool(v.done) && isCount(v.errors) && isNum(v.ts) && orAbsent(v.repeatDate, isISODay);

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
  (s.lang === 'ru' || s.lang === 'en') &&
  isCount(s.installSeed) && isCount(s.streak) &&
  orNull(s.lastDrawDate, isISODay) &&
  isCount(s.freezes) && orNull(s.freezeMonth, isMonth) && orNull(s.freezeSpentDate, isISODay) &&
  Array.isArray(s.history) && s.history.length <= HISTORY_MAX && s.history.every(isDraw) &&
  isObj(s.lessonsProgress) && Object.values(s.lessonsProgress).every(isLesson) &&
  isCount(s.xp) && isSettings(s.settings) && isProfile(s.profile);

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
  // доливка — ровно та же, что у гидрации persist: поверхностно по верхнему уровню…
  const state: BackupState = { ...PERSIST_DEFAULTS };
  for (const k of BACKUP_KEYS) {
    if (src[k] !== undefined) (state as unknown as Record<string, unknown>)[k] = src[k];
  }
  // …и mergeSettings для вложенного settings (ловушка поверхностного слияния, logic-spec §7)
  state.settings = mergeSettings(isObj(src.settings) ? (src.settings as Partial<AppSettings>) : null);

  if (!validState(state)) return { ok: false, error: 'corrupt' };
  return { ok: true, state, exportedAt: raw.exportedAt };
}
