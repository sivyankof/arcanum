import {
  DEFAULT_SETTINGS,
  formatHHMM,
  mergeSettings,
  parseHHMM,
  timeLabel,
} from '../settings';

describe('mergeSettings', () => {
  it('без сохранённого объекта отдаёт дефолт', () => {
    expect(mergeSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('дописывает ключи, которых не было в сохранённой версии', () => {
    // так выглядит settings у пользователя, установившего приложение на версии 06а
    const saved = { reflectionOn: false };
    expect(mergeSettings(saved)).toEqual({
      reflectionOn: false,
      pushesOn: true,
      pushMorning: '09:00',
      pushEvening: '21:00',
      pushAsked: false,
    });
  });

  it('не затирает сохранённые значения дефолтными', () => {
    const saved = { pushMorning: '07:00', pushAsked: true };
    const merged = mergeSettings(saved);
    expect(merged.pushMorning).toBe('07:00');
    expect(merged.pushAsked).toBe(true);
  });
});

describe('parseHHMM', () => {
  it('разбирает корректное время', () => {
    expect(parseHHMM('09:00', 9)).toEqual({ hour: 9, minute: 0 });
    expect(parseHHMM('21:30', 21)).toEqual({ hour: 21, minute: 30 });
  });

  it('мусор в хранилище откатывается к запасному часу, а не роняет планировщик', () => {
    expect(parseHHMM('', 9)).toEqual({ hour: 9, minute: 0 });
    expect(parseHHMM('25:99', 21)).toEqual({ hour: 21, minute: 0 });
    expect(parseHHMM('девять', 9)).toEqual({ hour: 9, minute: 0 });
  });
});

describe('formatHHMM и timeLabel', () => {
  it('хранение — с ведущим нулём, показ — без него (как в макете «9:00 · 21:00»)', () => {
    expect(formatHHMM(9, 0)).toBe('09:00');
    expect(formatHHMM(21, 30)).toBe('21:30');
    expect(timeLabel('09:00')).toBe('9:00');
    expect(timeLabel('21:30')).toBe('21:30');
  });
});
