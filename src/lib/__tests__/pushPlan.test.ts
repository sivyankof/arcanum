import {
  capPerDay,
  COMEBACK_AFTER_DAYS,
  MAX_PER_DAY,
  MORNING_AHEAD_DAYS,
  planPushes,
  type PlannedPush,
  type PlanInput,
} from '../pushPlan';

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
});
