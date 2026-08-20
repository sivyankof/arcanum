import {
  capPerDay,
  COMEBACK_AFTER_DAYS,
  MAX_PER_DAY,
  MOON_PHRASE,
  MOON_TITLE,
  TITLE_KEY,
  MORNING_AHEAD_DAYS,
  moonDaysIn,
  planInputFromStore,
  planPushes,
  type PlannedPush,
  type PlanInput,
} from '../pushPlan';
import { localDateISO, plusDaysISO } from '../dates';
import i18n, { resources } from '../i18n';
import { pickPhrase } from '../phrases';
import { DEFAULT_SETTINGS } from '../settings';

// 12 августа 2026, 08:00 локального времени — до утреннего пуша
const MORNING_8AM = new Date(2026, 7, 12, 8, 0);
// то же число, 19:00 — после утреннего, до вечернего
const EVENING_7PM = new Date(2026, 7, 12, 19, 0);

/** База: напоминания и рефлексия включены, карта дня НЕ открыта, серии нет. */
const base: PlanInput = {
  pushesOn: true,
  reflectionOn: true,
  morning: '09:00',
  evening: '21:00',
  streak: 0,
  freezes: 0,
  lastDrawDate: null,
  moonDays: [],
};

const kinds = (input: PlanInput, now: Date) => planPushes(input, now).map((p) => p.kind);
const onDate = (input: PlanInput, now: Date, date: string) =>
  planPushes(input, now).filter((p) => p.date === date);

describe('planPushes — утренний', () => {
  it('карта не открыта — сегодняшний утренний стоит', () => {
    const today = onDate(base, MORNING_8AM, '2026-08-12');
    expect(today.map((p) => p.kind)).toContain('morning');
    expect(today[0].hour).toBe(9);
    expect(today[0].minute).toBe(0);
  });

  it('карта уже открыта — сегодняшнего утреннего нет', () => {
    const today = onDate({ ...base, todayCardId: 'the-tower' }, MORNING_8AM, '2026-08-12');
    expect(today.map((p) => p.kind)).not.toContain('morning');
  });

  it('время сегодняшнего утреннего уже прошло — не планируется', () => {
    const today = onDate(base, EVENING_7PM, '2026-08-12');
    expect(today.map((p) => p.kind)).not.toContain('morning');
  });

  it('утренние ставятся ровно на три дня вперёд', () => {
    const future = planPushes(base, MORNING_8AM).filter(
      (p) => p.kind === 'morning' && p.date > '2026-08-12',
    );
    expect(future.map((p) => p.date)).toEqual(['2026-08-13', '2026-08-14', '2026-08-15']);
    expect(MORNING_AHEAD_DAYS).toBe(3);
  });
});

describe('planPushes — вечерний', () => {
  it('карта открыта, ответа нет — вечерний стоит с названием карты', () => {
    const plan = planPushes({ ...base, todayCardId: 'the-tower' }, MORNING_8AM);
    const evening = plan.find((p) => p.kind === 'evening');
    expect(evening).toBeDefined();
    expect(evening!.date).toBe('2026-08-12');
    expect(evening!.hour).toBe(21);
    expect(evening!.cardId).toBe('the-tower');
  });

  it('карта не открыта — вечернего нет', () => {
    expect(kinds(base, MORNING_8AM)).not.toContain('evening');
  });

  it('ответ уже дан — вечернего нет', () => {
    const input = { ...base, todayCardId: 'the-tower', todayOutcome: 'yes' as const };
    expect(kinds(input, MORNING_8AM)).not.toContain('evening');
  });

  it('рефлексия выключена — вечернего нет', () => {
    const input = { ...base, reflectionOn: false, todayCardId: 'the-tower' };
    expect(kinds(input, MORNING_8AM)).not.toContain('evening');
  });

  it('вечерний ставится только на сегодня, на будущие дни его нет', () => {
    const plan = planPushes({ ...base, todayCardId: 'the-tower' }, MORNING_8AM);
    expect(plan.filter((p) => p.kind === 'evening')).toHaveLength(1);
  });
});

describe('planPushes — спасение серии', () => {
  it('серия 3 и карта не открыта — спасение в 20:00 с числом дней, и только на сегодня', () => {
    const plan = planPushes({ ...base, streak: 3 }, MORNING_8AM);
    const streakPushes = plan.filter((p) => p.kind === 'streak');
    expect(streakPushes).toHaveLength(1);
    expect(streakPushes[0].date).toBe('2026-08-12');
    expect(streakPushes[0].hour).toBe(20);
    expect(streakPushes[0].n).toBe(3);
  });

  it('серия 2 — спасения нет', () => {
    expect(kinds({ ...base, streak: 2 }, MORNING_8AM)).not.toContain('streak');
  });

  it('карта открыта — спасать нечего', () => {
    const input = { ...base, streak: 7, todayCardId: 'the-tower' };
    expect(kinds(input, MORNING_8AM)).not.toContain('streak');
  });
});

describe('planPushes — возврат и инварианты', () => {
  it('возвратный ровно один и на четвёртый день', () => {
    const plan = planPushes(base, MORNING_8AM);
    const back = plan.filter((p) => p.kind === 'comeback');
    expect(back).toHaveLength(1);
    expect(back[0].date).toBe('2026-08-16');
    expect(COMEBACK_AFTER_DAYS).toBe(4);
  });

  it('в сутки не больше двух пушей — жёсткий инвариант logic-spec §8', () => {
    // самое населённое состояние: карта не открыта, серия длинная
    const plan = planPushes({ ...base, streak: 12 }, MORNING_8AM);
    const perDay = new Map<string, number>();
    for (const p of plan) perDay.set(p.date, (perDay.get(p.date) ?? 0) + 1);
    for (const count of perDay.values()) expect(count).toBeLessThanOrEqual(MAX_PER_DAY);
  });

  it('напоминания выключены — план пустой', () => {
    expect(planPushes({ ...base, pushesOn: false, streak: 12 }, MORNING_8AM)).toEqual([]);
  });

  it('один и тот же вход даёт один и тот же план (детерминизм)', () => {
    const a = planPushes({ ...base, streak: 5 }, MORNING_8AM);
    const b = planPushes({ ...base, streak: 5 }, MORNING_8AM);
    expect(a).toEqual(b);
  });

  it('у каждого пуша есть ключ фразы из content/phrases.json', () => {
    const plan = planPushes({ ...base, streak: 5 }, MORNING_8AM);
    expect(plan.length).toBeGreaterThan(0);
    for (const p of plan) expect(p.phraseKey.startsWith('push.')).toBe(true);
  });

  it('время утреннего, вечернего и возвратного пушей берётся из настроек, а не захардкожено', () => {
    const custom: PlanInput = { ...base, morning: '07:45', evening: '22:30' };
    // 07:00 — до настроенного утреннего (07:45), сегодняшний утренний ещё не прошёл
    const earlyMorning = new Date(2026, 7, 12, 7, 0);

    // карта не открыта: сегодняшний утренний, будущие утренние и возвратный — время из morning
    const notDrawn = planPushes(custom, earlyMorning);
    const todayMorning = notDrawn.find((p) => p.kind === 'morning' && p.date === '2026-08-12');
    expect(todayMorning!.hour).toBe(7);
    expect(todayMorning!.minute).toBe(45);

    const futureMorning = notDrawn.filter((p) => p.kind === 'morning' && p.date > '2026-08-12');
    expect(futureMorning.length).toBeGreaterThan(0);
    for (const p of futureMorning) {
      expect(p.hour).toBe(7);
      expect(p.minute).toBe(45);
    }

    const comeback = notDrawn.find((p) => p.kind === 'comeback');
    expect(comeback!.hour).toBe(7);
    expect(comeback!.minute).toBe(45);

    // карта открыта: вечерний — время из evening
    const drawn = planPushes({ ...custom, todayCardId: 'the-tower' }, earlyMorning);
    const evening = drawn.find((p) => p.kind === 'evening');
    expect(evening!.hour).toBe(22);
    expect(evening!.minute).toBe(30);
  });
});

describe('capPerDay — обрезка на искусственном входе', () => {
  // planPushes никогда не рождает больше двух претендентов на день (спасение серии живёт при
  // закрытой карте, вечерний — при открытой), поэтому тест выше («в сутки не больше двух пушей»)
  // проверяет только СЧЁТ на реалистичном входе и никогда не заходит внутрь ветки обрезки —
  // её можно было бы стереть, и тот тест остался бы зелёным. Здесь день собирается руками,
  // с четырьмя претендентами сразу, специально в обход planPushes.
  const day = '2026-08-20';
  const four: PlannedPush[] = [
    { kind: 'comeback', date: day, hour: 9, minute: 0, phraseKey: 'push.winback' },
    { kind: 'morning', date: day, hour: 9, minute: 0, phraseKey: 'push.morning_card' },
    { kind: 'evening', date: day, hour: 21, minute: 0, phraseKey: 'push.evening_reflect', cardId: 'the-tower' },
    { kind: 'streak', date: day, hour: 20, minute: 0, phraseKey: 'push.streak_save', n: 5 },
  ];

  it('из четырёх претендентов остаются ровно два', () => {
    expect(capPerDay(four)).toHaveLength(MAX_PER_DAY);
  });

  it('выживают именно streak и evening — верх PRIORITY, а не первые по списку или по времени', () => {
    const kinds = capPerDay(four).map((p) => p.kind);
    expect(kinds).toEqual(expect.arrayContaining(['streak', 'evening']));
    expect(kinds).not.toEqual(expect.arrayContaining(['morning']));
    expect(kinds).not.toEqual(expect.arrayContaining(['comeback']));
  });

  it('без спасения серии в претендентах выживают evening и morning, а comeback обрезается', () => {
    const three = four.filter((p) => p.kind !== 'streak');
    const kinds = capPerDay(three).map((p) => p.kind);
    expect(kinds).toHaveLength(MAX_PER_DAY);
    expect(kinds).toEqual(expect.arrayContaining(['evening', 'morning']));
    expect(kinds).not.toEqual(expect.arrayContaining(['comeback']));
  });

  it('два претендента и меньше — обрезка ничего не убирает', () => {
    const two = four.filter((p) => p.kind === 'streak' || p.kind === 'morning');
    expect(capPerDay(two)).toHaveLength(2);
  });

  it('freeze в PRIORITY выше утреннего: из freeze+morning+comeback выживают freeze и morning', () => {
    const three: PlannedPush[] = [
      { kind: 'comeback', date: day, hour: 9, minute: 0, phraseKey: 'push.winback' },
      { kind: 'morning', date: day, hour: 9, minute: 0, phraseKey: 'push.morning_card' },
      { kind: 'freeze', date: day, hour: 9, minute: 0, phraseKey: 'push.freeze_saved', n: 5 },
    ];
    const kept = capPerDay(three).map((p) => p.kind);
    expect(kept).toEqual(expect.arrayContaining(['freeze', 'morning']));
    expect(kept).not.toEqual(expect.arrayContaining(['comeback']));
  });
});

describe('planPushes — пуш «серию спасла заморозка» (спека 10)', () => {
  // MORNING_8AM = 12 августа; «вчера» = 11-е, «позавчера» = 10-е

  it('карта открыта — freeze-пуш на послезавтра вместо утреннего', () => {
    const input = { ...base, streak: 5, freezes: 1, lastDrawDate: '2026-08-12', todayCardId: 'the-tower' };
    const plan = planPushes(input, MORNING_8AM);
    const freeze = plan.filter((p) => p.kind === 'freeze');
    expect(freeze).toHaveLength(1);
    expect(freeze[0].date).toBe('2026-08-14');
    expect(freeze[0].hour).toBe(9);
    expect(freeze[0].n).toBe(5);
    // замена, а не добавка: обычного утреннего в этот день нет
    expect(onDate(input, MORNING_8AM, '2026-08-14').map((p) => p.kind)).toEqual(['freeze']);
  });

  it('карта не открыта, вчера открывали — freeze-пуш на завтра вместо утреннего', () => {
    const input = { ...base, streak: 5, freezes: 1, lastDrawDate: '2026-08-11' };
    const plan = planPushes(input, MORNING_8AM);
    const freeze = plan.filter((p) => p.kind === 'freeze');
    expect(freeze).toHaveLength(1);
    expect(freeze[0].date).toBe('2026-08-13');
    expect(onDate(input, MORNING_8AM, '2026-08-13').map((p) => p.kind)).toEqual(['freeze']);
  });

  it('последнее открытие позавчера — к утру серию уже не спасти, freeze-пуша нет', () => {
    const input = { ...base, streak: 5, freezes: 1, lastDrawDate: '2026-08-10' };
    expect(kinds(input, MORNING_8AM)).not.toContain('freeze');
  });

  it('заморозок нет — freeze-пуша нет', () => {
    const input = { ...base, streak: 5, freezes: 0, lastDrawDate: '2026-08-11' };
    expect(kinds(input, MORNING_8AM)).not.toContain('freeze');
  });

  it('серии нет — freeze-пуша нет', () => {
    const input = { ...base, streak: 0, freezes: 2, lastDrawDate: '2026-08-11' };
    expect(kinds(input, MORNING_8AM)).not.toContain('freeze');
  });

  it('ключ фразы push.freeze_saved существует в phrases.json', () => {
    const input = { ...base, streak: 5, freezes: 1, lastDrawDate: '2026-08-11' };
    const freeze = planPushes(input, MORNING_8AM).find((p) => p.kind === 'freeze')!;
    expect(freeze.phraseKey).toBe('push.freeze_saved');
    expect(pickPhrase('push.freeze_saved', freeze.date, 'ru', { days: '5 дней' })).not.toBe('');
    expect(pickPhrase('push.freeze_saved', freeze.date, 'en', { days: '5 days' })).not.toBe('');
  });
});

describe('planPushes — лунные пуши (спека 47б)', () => {
  it('день события в горизонте — утренний этого дня становится лунным', () => {
    const input = { ...base, moonDays: [{ date: '2026-08-13', kind: 'new' as const }] };
    const day = onDate(input, MORNING_8AM, '2026-08-13');
    expect(day).toHaveLength(1);
    expect(day[0].kind).toBe('moon');
    expect(day[0].phraseKey).toBe('push.moon_new');
    expect(day[0].titleKey).toBe('push.titleMoonNew');
    expect(day[0].hour).toBe(9);
    expect(day[0].minute).toBe(0);
  });

  it('полнолуние даёт свою пару ключей', () => {
    const input = { ...base, moonDays: [{ date: '2026-08-14', kind: 'full' as const }] };
    const day = onDate(input, MORNING_8AM, '2026-08-14');
    expect(day[0].kind).toBe('moon');
    expect(day[0].phraseKey).toBe('push.moon_full');
    expect(day[0].titleKey).toBe('push.titleMoonFull');
  });

  it('сегодняшний лунный стоит, пока карта не открыта, и вытесняет обычный утренний', () => {
    const input = { ...base, moonDays: [{ date: '2026-08-12', kind: 'new' as const }] };
    const today = onDate(input, MORNING_8AM, '2026-08-12');
    expect(today.map((p) => p.kind)).toContain('moon');
    expect(today.map((p) => p.kind)).not.toContain('morning');
  });

  it('карта открыта — сегодняшнего лунного нет (правило утреннего)', () => {
    const input = {
      ...base,
      todayCardId: 'the-tower',
      moonDays: [{ date: '2026-08-12', kind: 'full' as const }],
    };
    expect(onDate(input, MORNING_8AM, '2026-08-12').map((p) => p.kind)).not.toContain('moon');
  });

  it('freeze-день совпал с днём события — побеждает freeze', () => {
    // карта открыта сегодня → freezeDay = послезавтра, 2026-08-14 (спека 10)
    const input = {
      ...base,
      todayCardId: 'the-tower',
      streak: 5,
      freezes: 1,
      moonDays: [{ date: '2026-08-14', kind: 'full' as const }],
    };
    expect(onDate(input, MORNING_8AM, '2026-08-14').map((p) => p.kind)).toEqual(['freeze']);
  });

  it('возвратный (4-й день) лунным не подменяется', () => {
    const input = { ...base, moonDays: [{ date: '2026-08-16', kind: 'new' as const }] };
    expect(onDate(input, MORNING_8AM, '2026-08-16').map((p) => p.kind)).toEqual(['comeback']);
  });

  it('день события вне горизонта утренних — лунного в плане нет', () => {
    const input = { ...base, moonDays: [{ date: '2026-08-17', kind: 'new' as const }] };
    expect(kinds(input, MORNING_8AM)).not.toContain('moon');
  });

  it('capPerDay: лунный уступает спасению серии и вечернему', () => {
    const mk = (kind: PlannedPush['kind'], hour: number): PlannedPush => ({
      kind,
      date: '2026-08-12',
      hour,
      minute: 0,
      phraseKey: 'x',
    });
    const kept = capPerDay([mk('moon', 9), mk('evening', 21), mk('streak', 20)]);
    expect(kept.map((p) => p.kind).sort()).toEqual(['evening', 'streak']);
  });

  it('детерминизм: один вход — один план', () => {
    const input = { ...base, moonDays: [{ date: '2026-08-13', kind: 'new' as const }] };
    expect(planPushes(input, MORNING_8AM)).toEqual(planPushes(input, MORNING_8AM));
  });
});

describe('planInputFromStore — moonDays (спека 47б)', () => {
  // Точный момент новолуния 12.08.2026 17:37 UTC (logic-spec §6). Его ЛОКАЛЬНЫЙ день зависит
  // от пояса машины, поэтому ожидание строится тем же localDateISO, что и реализация, —
  // тест проверяет ОКНО (от начала дня, границы горизонта), а не сам маппинг момента в день.
  const NEW_MOON = new Date(Date.UTC(2026, 7, 12, 17, 37));
  const eventDay = localDateISO(NEW_MOON);
  const at = (iso: string, h: number) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d, h, 0);
  };
  const moonDaysAt = (now: Date) =>
    planInputFromStore(DEFAULT_SETTINGS, 0, [], 0, null, now).moonDays;

  it('событие раньше now, но в том же локальном дне — в окне (окно от НАЧАЛА дня)', () => {
    expect(moonDaysAt(at(eventDay, 23))).toContainEqual({ date: eventDay, kind: 'new' });
  });

  it('событие во вчерашнем дне — вне окна', () => {
    expect(moonDaysAt(at(plusDaysISO(eventDay, 1), 8)).map((d) => d.date)).not.toContain(eventDay);
  });

  it('день +3 — в окне, день +4 — уже нет', () => {
    expect(moonDaysAt(at(plusDaysISO(eventDay, -3), 8))).toContainEqual({
      date: eventDay,
      kind: 'new',
    });
    expect(moonDaysAt(at(plusDaysISO(eventDay, -4), 8)).map((d) => d.date)).not.toContain(eventDay);
  });
});

describe('moonDaysIn — окно и маппинг момента в локальный день (спека 47б)', () => {
  // 20 августа 2026, 15:00 локально — день без настоящих событий, источник подменяется
  const NOW = new Date(2026, 7, 20, 15, 0);

  it('окно — от локальной полуночи сегодня на MORNING_AHEAD_DAYS + 1 суток', () => {
    let seen: { from: Date; to: Date } | undefined;
    moonDaysIn(NOW, (from, to) => {
      seen = { from, to };
      return [];
    });
    // границы проверяются компонентами даты, а не сравнением с localMidnight: иначе тест
    // повторял бы реализацию и молчал бы на её подмене
    expect([seen!.from.getHours(), seen!.from.getMinutes(), seen!.from.getSeconds()]).toEqual([0, 0, 0]);
    expect(seen!.from.getDate()).toBe(20);
    expect([seen!.to.getHours(), seen!.to.getMinutes()]).toEqual([0, 0]);
    expect(seen!.to.getDate()).toBe(20 + MORNING_AHEAD_DAYS + 1);
  });

  it('момент события переводится в ЛОКАЛЬНЫЙ день, а не в UTC-день', () => {
    // два синтетических события у краёв локальных суток: при ЛЮБОМ ненулевом смещении пояса
    // хотя бы у одного UTC-день отличается от локального, поэтому подмена реализации на срез
    // ISO-строки (UTC) обязана уронить этот тест. Ожидание — литералы, а не вызов localDateISO:
    // иначе обе стороны сравнения менялись бы синхронно и проверка была бы тавтологией.
    // ⚠️ На машине ровно в UTC две реализации неразличимы в принципе — там тест просто пройдёт.
    const days = moonDaysIn(NOW, () => [
      { kind: 'new', at: new Date(2026, 7, 21, 0, 30) },
      { kind: 'full', at: new Date(2026, 7, 22, 23, 30) },
    ]);
    expect(days).toEqual([
      { date: '2026-08-21', kind: 'new' },
      { date: '2026-08-22', kind: 'full' },
    ]);
  });

  it('planInputFromStore берёт окно у moonDaysIn (настоящий источник событий)', () => {
    const real = planInputFromStore(DEFAULT_SETTINGS, 0, [], 0, null, NOW).moonDays;
    expect(real).toEqual(moonDaysIn(NOW));
  });
});

describe('ключи заголовков пушей существуют в контенте и i18n (спека 47б, хвост 06б)', () => {
  // Шов, который не закрыт больше ничем: тело пуша ловится pickPhrase (пустая строка на
  // неизвестном ключе), а i18n.t на отсутствующем ключе молча возвращает САМ КЛЮЧ — опечатка
  // в titleMoonFull уехала бы в баннер как литерал «push.titleMoonFull». Ни веб-проверка
  // (expo-notifications на вебе no-op), ни лайв-проверка (событие вне горизонта) это не видят.
  // Языки обходятся по Object.keys(resources), а не по литералам 'ru'/'en' (правило hf-02):
  // иначе третий язык проехал бы мимо проверки.
  const LANGS = Object.keys(resources) as Array<keyof typeof resources>;
  // Дежурные заголовки (TITLE_KEY) — тот же класс дыры, закрыт выносом константы из pushes.ts
  // (хвост 47б). Set: TITLE_KEY.moon — фолбэк на значение из MOON_TITLE, ключи пересекаются.
  const ALL_TITLE_KEYS = [...new Set([...Object.values(TITLE_KEY), ...Object.values(MOON_TITLE)])];

  it.each(LANGS)('%s: заголовок лежит в ресурсах САМОГО языка, а не берётся фолбэком', (lang) => {
    // проверять через i18n.t нельзя: fallbackLng: 'en' подставляет английскую строку вместо
    // пропавшего русского ключа, t() возвращает осмысленный текст, и тест остаётся зелёным —
    // ровно тот тихий уход в английский, который ловила hf-02. Поэтому смотрим сами ресурсы.
    for (const key of ALL_TITLE_KEYS) {
      const path = key.split('.');
      const leaf = path.pop()!;
      const parent = path.reduce<unknown>(
        (node, part) => (node as Record<string, unknown>)?.[part],
        resources[lang].translation,
      ) as Record<string, unknown> | undefined;
      expect(parent).toBeDefined();
      // ключ с {{count}} лежит в ресурсах ТОЛЬКО плюральным семейством (push.titleStreak_one/
      // _few/_many) — точного узла push.titleStreak не существует. Считаем ключ существующим,
      // если есть точный узел ИЛИ хотя бы одна плюральная форма; ПОЛНОТУ семейства этот тест
      // не проверяет нарочно — это контракт сьюта i18nPlurals, дублировать его нельзя.
      const exact = parent?.[leaf];
      const pluralForms = Object.keys(parent ?? {}).filter(
        (k) => k.startsWith(`${leaf}_`) && typeof parent?.[k] === 'string',
      );
      const exists = typeof exact === 'string' ? exact.length > 0 : pluralForms.length > 0;
      expect(`${key} (${lang}): existing=${exists}`).toBe(`${key} (${lang}): existing=true`);
    }
  });

  it.each(LANGS)('%s: i18n действительно отдаёт заголовок, а не сам ключ', (lang) => {
    const t = i18n.getFixedT(lang);
    for (const key of ALL_TITLE_KEYS) {
      // count обязателен: без него плюральный ключ не резолвится (applyPlan передаёт его всегда)
      const text = t(key, { count: 2 });
      expect(text).not.toBe(key);
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it.each(LANGS)('%s: тела фраз непустые', (lang) => {
    for (const key of Object.values(MOON_PHRASE)) {
      expect(pickPhrase(key, '2026-08-12', lang).length).toBeGreaterThan(0);
    }
  });
});
