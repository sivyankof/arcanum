import { advanceStreak, FREEZE_MAX, grantFreezes } from '../streak';

describe('advanceStreak — продолжение и спасение серии (logic-spec §2)', () => {
  it('вчера открывали — серия растёт, заморозки целы', () => {
    expect(advanceStreak({ streak: 5, lastDrawDate: '2026-08-13', freezes: 1 }, '2026-08-14'))
      .toEqual({ streak: 6, freezes: 1, freezeSpent: false });
  });

  it('пропущен ровно один день, заморозка есть — серия растёт, заморозка тратится', () => {
    expect(advanceStreak({ streak: 5, lastDrawDate: '2026-08-12', freezes: 1 }, '2026-08-14'))
      .toEqual({ streak: 6, freezes: 0, freezeSpent: true });
  });

  it('пропущен один день, заморозок нет — сброс в 1', () => {
    expect(advanceStreak({ streak: 5, lastDrawDate: '2026-08-12', freezes: 0 }, '2026-08-14'))
      .toEqual({ streak: 1, freezes: 0, freezeSpent: false });
  });

  it('пропущено два дня — сброс, заморозка НЕ тратится', () => {
    expect(advanceStreak({ streak: 5, lastDrawDate: '2026-08-11', freezes: 2 }, '2026-08-14'))
      .toEqual({ streak: 1, freezes: 2, freezeSpent: false });
  });

  it('первое открытие вообще — серия 1', () => {
    expect(advanceStreak({ streak: 0, lastDrawDate: null, freezes: 1 }, '2026-08-14'))
      .toEqual({ streak: 1, freezes: 1, freezeSpent: false });
  });

  it('пропуск через границу месяца: 31 июля → 2 августа — заморозка работает', () => {
    expect(advanceStreak({ streak: 3, lastDrawDate: '2026-07-31', freezes: 1 }, '2026-08-02'))
      .toEqual({ streak: 4, freezes: 0, freezeSpent: true });
  });
});

describe('grantFreezes — начисление 1-го числа месяца (логически; фактически — лениво)', () => {
  it('месяц ещё не записан — инициализация текущим БЕЗ начисления (стартовая 1 уже «за этот месяц»)', () => {
    expect(grantFreezes({ freezes: 1, freezeMonth: null }, '2026-08-14'))
      .toEqual({ freezes: 1, freezeMonth: '2026-08' });
  });

  it('тот же месяц — без изменений', () => {
    expect(grantFreezes({ freezes: 1, freezeMonth: '2026-08' }, '2026-08-31'))
      .toEqual({ freezes: 1, freezeMonth: '2026-08' });
  });

  it('новый месяц — +1', () => {
    expect(grantFreezes({ freezes: 0, freezeMonth: '2026-08' }, '2026-09-01'))
      .toEqual({ freezes: 1, freezeMonth: '2026-09' });
  });

  it('потолок 2 — сверх него не копится', () => {
    expect(grantFreezes({ freezes: 2, freezeMonth: '2026-08' }, '2026-09-05'))
      .toEqual({ freezes: 2, freezeMonth: '2026-09' });
    expect(FREEZE_MAX).toBe(2);
  });

  it('пропущено три месяца с нуля — доначисляется по одному за месяц, до потолка', () => {
    expect(grantFreezes({ freezes: 0, freezeMonth: '2026-05' }, '2026-08-14'))
      .toEqual({ freezes: 2, freezeMonth: '2026-08' });
  });

  it('граница года: декабрь → январь', () => {
    expect(grantFreezes({ freezes: 0, freezeMonth: '2026-12' }, '2027-01-02'))
      .toEqual({ freezes: 1, freezeMonth: '2027-01' });
  });

  it('часы перевели назад (записанный месяц в будущем) — ничего не меняем и не дарим повторно', () => {
    expect(grantFreezes({ freezes: 1, freezeMonth: '2026-08' }, '2026-07-30'))
      .toEqual({ freezes: 1, freezeMonth: '2026-08' });
  });
});
