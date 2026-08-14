import { localDateISO } from '../dates';
import {
  BACKUP_KEYS,
  backupFileName,
  backupSummary,
  buildBackup,
  PERSIST_DEFAULTS,
  SCHEMA_VERSION,
  type BackupState,
} from '../backup';

// момент экспорта задаём локальным конструктором: тест не должен зависеть от таймзоны раннера
const AT_DATE = new Date(2026, 7, 14, 12, 0, 0);
const AT = AT_DATE.toISOString();

// валидное состояние со всеми необязательными полями — общая опора и для тестов Task 3
export const VALID: BackupState = {
  themeMode: 'light',
  lang: 'en',
  installSeed: 123456,
  streak: 5,
  lastDrawDate: '2026-08-14',
  freezes: 2,
  freezeMonth: '2026-08',
  freezeSpentDate: null,
  history: [
    { date: '2026-08-14', cardId: 'fool', reversed: false, note: 'запись', outcome: 'yes' },
    { date: '2026-08-13', cardId: 'magician', reversed: false },
  ],
  lessonsProgress: { m1l1: { done: true, errors: 1, ts: 1755000000000, repeatDate: '2026-08-13' } },
  xp: 42,
  settings: { reflectionOn: false, pushesOn: true, pushMorning: '08:00', pushEvening: '22:00', pushAsked: true },
  profile: { name: 'Аня', birthDate: '1993-03-09', birthArcanaId: 'high-priestess', onboarded: true },
};

describe('buildBackup — сборка файла (спека 11)', () => {
  it('конверт заполнен, в state только белый список — dev-поля и функции не утекают', () => {
    const dirty = { ...VALID, devReflect: true, drawToday: () => {} } as unknown as BackupState;
    const f = buildBackup(dirty, SCHEMA_VERSION, AT);
    expect(f.app).toBe('arcanum');
    expect(f.kind).toBe('backup');
    expect(f.schemaVersion).toBe(SCHEMA_VERSION);
    expect(f.exportedAt).toBe(AT);
    expect(Object.keys(f.state).sort()).toEqual([...BACKUP_KEYS].sort());
  });
});

describe('белый список и дефолты', () => {
  it('ключи бэкапа = персистуемая схема v7 — новое поле стора требует осознанного решения здесь', () => {
    expect([...BACKUP_KEYS].sort()).toEqual([
      'freezeMonth', 'freezeSpentDate', 'freezes', 'history', 'installSeed', 'lang',
      'lastDrawDate', 'lessonsProgress', 'profile', 'settings', 'streak', 'themeMode', 'xp',
    ]);
  });
  it('дефолты совпадают с дефолтами стора до задачи 11', () => {
    expect(PERSIST_DEFAULTS.freezes).toBe(1);
    expect(PERSIST_DEFAULTS.settings.pushMorning).toBe('09:00');
    expect(PERSIST_DEFAULTS.profile).toEqual({ onboarded: false });
  });
});

describe('имя файла и сводка', () => {
  it('имя с локальной датой', () => {
    expect(backupFileName('2026-08-14')).toBe('arcanum-backup-2026-08-14.json');
  });
  it('сводка для диалога подтверждения; день бэкапа — локальный', () => {
    expect(backupSummary({ state: VALID, exportedAt: AT })).toEqual({
      entries: 2,
      streak: 5,
      dateISO: localDateISO(AT_DATE),
    });
  });
});
