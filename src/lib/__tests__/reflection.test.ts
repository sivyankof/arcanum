import { REFLECT_HOUR, reflectionVisible } from '../reflection';

/** База: карта открыта, вечер, тумблер включён. Каждый тест ломает ровно одно условие. */
const base = { drawn: true, hour: 20, enabled: true };

describe('reflectionVisible', () => {
  it('вечером при открытой карте блок виден', () => {
    expect(reflectionVisible(base)).toBe(true);
  });

  it('карта дня не открыта — блока нет даже вечером', () => {
    expect(reflectionVisible({ ...base, drawn: false })).toBe(false);
  });

  it('карта дня не открыта — DEV-обход времени не помогает', () => {
    expect(reflectionVisible({ ...base, drawn: false, devForce: true })).toBe(false);
  });

  it('до 18:00 блока нет', () => {
    expect(reflectionVisible({ ...base, hour: REFLECT_HOUR - 1 })).toBe(false);
  });

  it('ровно в 18:00 блок появляется', () => {
    expect(reflectionVisible({ ...base, hour: REFLECT_HOUR })).toBe(true);
  });

  it('тумблер выключен — блока нет', () => {
    expect(reflectionVisible({ ...base, enabled: false })).toBe(false);
  });

  it('DEV-обход снимает только время, но не тумблер', () => {
    expect(reflectionVisible({ ...base, hour: 10, devForce: true })).toBe(true);
    expect(reflectionVisible({ ...base, hour: 10, enabled: false, devForce: true })).toBe(false);
  });
});
