/** Бэкап (спека 11): формат файла экспорта, дефолты персистуемой схемы и строгая
 *  валидация при импорте. Чистый модуль без импортов expo/react — целиком под юнит-тестами.
 *  Ошибки отдаются КОДАМИ (ключи i18n), а не готовым текстом — приём pushPlan.
 *
 *  Здесь же живут SCHEMA_VERSION и PERSIST_DEFAULTS, которыми пользуется стор:
 *  версия схемы и дефолты лежат по одному разу, а бэкап по построению совпадает
 *  с тем, что реально персистится. */
import type { Profile } from './birthArcana';
import type { LessonProgressMap } from './courseProgress';
import { localDateISO } from './dates';
import type { DailyDraw } from './journal';
import { DEFAULT_SETTINGS, type AppSettings } from './settings';
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
