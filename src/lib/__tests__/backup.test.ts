import { localDateISO } from '../dates';
import { NOTE_MAX } from '../journal';
import { QUESTION_MAX, SPREADS_MAX } from '../spread';
import {
  BACKUP_KEYS,
  backupFileName,
  backupSummary,
  buildBackup,
  parseBackup,
  PERSIST_DEFAULTS,
  resolveImportedLang,
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
  spreadsHistory: [
    {
      ts: 1755100000000,
      date: '2026-08-14',
      spreadId: 'three-card',
      cards: [{ cardId: 'fool', reversed: false }, { cardId: 'magician', reversed: true }, { cardId: 'sun', reversed: false }],
      question: 'Стоит ли менять работу?',
      note: 'Колесо в настоящем',
    },
  ],
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
  it('ключи бэкапа = персистуемая схема v9 (спека 36: + spreadsHistory) — новое поле стора требует осознанного решения здесь', () => {
    expect([...BACKUP_KEYS].sort()).toEqual([
      'freezeMonth', 'freezeSpentDate', 'freezes', 'history', 'installSeed', 'lang',
      'lastDrawDate', 'lessonsProgress', 'profile', 'settings', 'spreadsHistory', 'streak',
      'themeMode', 'xp',
    ]);
  });
  it('дефолты совпадают с дефолтами стора до задачи 11', () => {
    expect(PERSIST_DEFAULTS.freezes).toBe(1);
    expect(PERSIST_DEFAULTS.settings.pushMorning).toBe('09:00');
    expect(PERSIST_DEFAULTS.profile).toEqual({ onboarded: false });
  });
  it('версия схемы 9: spreadsHistory (спека 36) — файл v9 старому ридеру откажет как «новее», а не «повреждён»', () => {
    expect(SCHEMA_VERSION).toBe(9);
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

const fileOf = (state: BackupState) => JSON.stringify(buildBackup(state, SCHEMA_VERSION, AT));

describe('parseBackup — круговой (спека 11)', () => {
  it('экспорт → импорт возвращает то же состояние', () => {
    expect(parseBackup(fileOf(VALID), SCHEMA_VERSION)).toEqual({ ok: true, state: VALID, exportedAt: AT });
  });
});

describe('parseBackup — отказы конверта', () => {
  it.each([
    ['не JSON', 'это не файл бэкапа'],
    ['JSON без конверта', JSON.stringify({ hello: 1 })],
    ['чужой kind', JSON.stringify({ app: 'arcanum', kind: 'export', schemaVersion: SCHEMA_VERSION, exportedAt: AT, state: {} })],
    ['exportedAt не дата', JSON.stringify({ app: 'arcanum', kind: 'backup', schemaVersion: SCHEMA_VERSION, exportedAt: 'вчера', state: {} })],
  ])('%s → notBackup', (_name, text) => {
    expect(parseBackup(text, SCHEMA_VERSION)).toEqual({ ok: false, error: 'notBackup' });
  });

  it('schemaVersion новее текущей → newerVersion (схему из будущего не накатываем)', () => {
    const f = { ...JSON.parse(fileOf(VALID)), schemaVersion: SCHEMA_VERSION + 1 };
    expect(parseBackup(JSON.stringify(f), SCHEMA_VERSION)).toEqual({ ok: false, error: 'newerVersion' });
  });
});

describe('parseBackup — доливка старых бэкапов (та же логика, что у гидрации persist)', () => {
  it('бэкап без поздних ключей получает дефолты, настройки — через mergeSettings', () => {
    const old = JSON.parse(fileOf(VALID));
    delete old.state.xp;
    delete old.state.freezes;
    delete old.state.freezeMonth;
    delete old.state.freezeSpentDate;
    old.state.settings = { reflectionOn: false };
    old.schemaVersion = 2;
    const r = parseBackup(JSON.stringify(old), SCHEMA_VERSION);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.xp).toBe(0);
    expect(r.state.freezes).toBe(1);
    expect(r.state.settings).toEqual({
      reflectionOn: false, pushesOn: true, pushMorning: '09:00', pushEvening: '21:00', pushAsked: false,
    });
  });
});

describe('parseBackup — битые данные → corrupt (всё или ничего)', () => {
  const broken = (patch: (s: Record<string, any>) => void) => {
    const f = JSON.parse(fileOf(VALID));
    patch(f.state);
    return JSON.stringify(f);
  };
  it.each<[string, (s: Record<string, any>) => void]>([
    ['дата записи не ISO', (s) => { s.history[0].date = '14.08.2026'; }],
    ['неизвестная карта', (s) => { s.history[0].cardId = 'nope'; }],
    ['reversed строкой', (s) => { s.history[0].reversed = 'yes'; }],
    ['outcome вне тройки', (s) => { s.history[0].outcome = 'maybe'; }],
    ['history длиннее лимита', (s) => {
      s.history = Array.from({ length: 366 }, () => ({ date: '2026-01-01', cardId: 'fool', reversed: false }));
    }],
    ['streak строкой', (s) => { s.streak = '5'; }],
    ['тема вне пары', (s) => { s.themeMode = 'blue'; }],
    ['урок без done', (s) => { s.lessonsProgress = { m1l1: { errors: 0, ts: 1 } }; }],
    ['profile без onboarded', (s) => { s.profile = { name: 'Аня' }; }],
    ['настройки битых типов', (s) => { s.settings = { reflectionOn: 'да' }; }],
    ['freezeMonth не YYYY-MM', (s) => { s.freezeMonth = 'август'; }],
    // волна фиксов финального ревью: потолки величин (B1) — без них огромный xp/streak/freezes
    // проходит валидацию, а levelFromXp (линейный while) вешает каждый рендер пилюли уровня
    ['xp за потолком', (s) => { s.xp = 1e15; }],
    ['streak за потолком', (s) => { s.streak = 1e9; }],
    ['freezes за потолком (больше FREEZE_MAX)', (s) => { s.freezes = 999; }],
    ['заметка длиннее лимита', (s) => { s.history[0].note = 'а'.repeat(NOTE_MAX + 1); }],
    ['lessonsProgress раздут сверх лимита', (s) => {
      s.lessonsProgress = Object.fromEntries(
        Array.from({ length: 1001 }, (_, i) => [`l${i}`, { done: true, errors: 0, ts: 1 }]),
      );
    }],
    // B2: settings не-объектом раньше молча подменялся дефолтами — противоречит «всё или ничего»
    ['settings не объект', (s) => { s.settings = 'строка'; }],
    // B3: строже регулярки — числа вне диапазона, а не только форма строки
    ['pushMorning вне диапазона часов/минут', (s) => { s.settings = { ...s.settings, pushMorning: '99:99' }; }],
    ['freezeSpentDate — месяц/день вне диапазона', (s) => { s.freezeSpentDate = '2026-13-45'; }],
    // спека 27: домен lang — четыре языка приложения, чужой код — чужой файл
    ['язык вне четвёрки', (s) => { s.lang = 'de'; }],
  ])('%s', (_name, patch) => {
    expect(parseBackup(broken(patch), SCHEMA_VERSION)).toEqual({ ok: false, error: 'corrupt' });
  });
});

describe('parseBackup — реальная форма состояния (спека 11, B6)', () => {
  it('разнородные id колоды (мажор и минор в history, birthArcanaId) проходят собственный parseBackup', () => {
    const state: BackupState = {
      ...VALID,
      history: [
        { date: '2026-08-14', cardId: 'hermit', reversed: false },
        { date: '2026-08-13', cardId: 'c02', reversed: true },
      ],
      profile: { ...VALID.profile, birthArcanaId: 'hermit' },
    };
    const text = JSON.stringify(buildBackup(state, SCHEMA_VERSION, AT));
    expect(parseBackup(text, SCHEMA_VERSION)).toEqual({ ok: true, state, exportedAt: AT });
  });
});

describe('lang из четырёх языков (спека 27)', () => {
  it.each(['ru', 'en', 'es', 'pt'])('%s проходит валидацию', (lang) => {
    const state = { ...VALID, lang } as BackupState;
    const text = JSON.stringify(buildBackup(state, SCHEMA_VERSION, AT));
    expect(parseBackup(text, SCHEMA_VERSION)).toEqual({ ok: true, state, exportedAt: AT });
  });
});

// Корень дефекта, найденного финальным ревью: parseBackup проверял, что lang — валидный язык
// (тесты выше), но ни один тест не проверял, что импортированный язык РЕАЛЬНО применяется —
// дыра была между «файл валиден» и «файл применён». Правило вынесено в чистую функцию именно
// затем, чтобы её можно было закрепить тестом без стора.
describe('resolveImportedLang — язык бэкапа применяется с ограничителем по доступным языкам', () => {
  it('язык файла доступен в текущей сборке — берём его', () => {
    expect(resolveImportedLang('es', 'ru', ['ru', 'en', 'es', 'pt'])).toBe('es');
  });

  it('язык файла НЕдоступен в текущей сборке — остаётся текущий язык устройства', () => {
    expect(resolveImportedLang('es', 'ru', ['ru', 'en'])).toBe('ru');
  });

  it('язык файла совпадает с текущим — результат тот же независимо от доступности', () => {
    expect(resolveImportedLang('ru', 'ru', ['ru', 'en'])).toBe('ru');
  });
});

describe('parseBackup — расклады (спека 36)', () => {
  const withSpreads = (spreadsHistory: unknown) =>
    parseBackup(JSON.stringify({ ...buildBackup(VALID, SCHEMA_VERSION, AT), state: { ...VALID, spreadsHistory } }), SCHEMA_VERSION);

  it('валидный расклад проходит и сохраняется', () => {
    const r = withSpreads(VALID.spreadsHistory);
    expect(r.ok && r.state.spreadsHistory).toEqual(VALID.spreadsHistory);
  });

  it('файл v8 без spreadsHistory доливается пустым списком', () => {
    const { spreadsHistory: _drop, ...old } = VALID;
    const raw = { ...buildBackup(VALID, 8, AT), schemaVersion: 8, state: old };
    const r = parseBackup(JSON.stringify(raw), SCHEMA_VERSION);
    expect(r.ok && r.state.spreadsHistory).toEqual([]);
  });

  const base = VALID.spreadsHistory[0];
  it.each([
    ['чужой spreadId', { ...base, spreadId: 'nope' }],
    ['число карт не совпадает с раскладом', { ...base, cards: base.cards.slice(0, 2) }],
    ['дубль карты внутри расклада', { ...base, cards: [base.cards[0], base.cards[0], base.cards[2]] }],
    ['чужой cardId', { ...base, cards: [{ cardId: 'нет', reversed: false }, base.cards[1], base.cards[2]] }],
    ['reversed не boolean', { ...base, cards: [{ cardId: 'fool', reversed: 1 }, base.cards[1], base.cards[2]] }],
    ['ts не число', { ...base, ts: '1' }],
    ['дата не ISO', { ...base, date: '14.08.2026' }],
    ['вопрос длиннее QUESTION_MAX', { ...base, question: 'в'.repeat(QUESTION_MAX + 1) }],
    ['заметка длиннее NOTE_MAX', { ...base, note: 'з'.repeat(NOTE_MAX + 1) }],
  ])('битый расклад: %s → corrupt', (_name, draw) => {
    expect(withSpreads([draw])).toEqual({ ok: false, error: 'corrupt' });
  });

  it('больше SPREADS_MAX раскладов → corrupt', () => {
    const many = Array.from({ length: SPREADS_MAX + 1 }, (_, i) => ({ ...base, ts: base.ts + i }));
    expect(withSpreads(many)).toEqual({ ok: false, error: 'corrupt' });
  });
});
