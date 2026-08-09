/** Тесты карты дня: детерминизм по (дата, сид), разные сиды — разные последовательности,
 *  анти-повтор в окне 7 дней, распределение по 78 картам (hf-01/H3). */
import { cardOfDay, cards } from '../content';

describe('cardOfDay — детерминизм', () => {
  it('один и тот же сид + дата → 100 вызовов дают один и тот же id (§1)', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(cardOfDay('2026-08-08', 42).id);
    }
    expect(ids.size).toBe(1);
  });
});

describe('cardOfDay — разные сиды', () => {
  it('разные сиды на одном интервале дат дают разные последовательности карт', () => {
    const seqFor = (seed: number) => {
      const out: string[] = [];
      for (let d = 1; d <= 30; d++) {
        const dateISO = `2026-08-${String(d).padStart(2, '0')}`;
        out.push(cardOfDay(dateISO, seed).id);
      }
      return out;
    };
    const seq1 = seqFor(1);
    const seq2 = seqFor(2);
    expect(seq1).not.toEqual(seq2);
  });
});

describe('cardOfDay — анти-повтор', () => {
  it('если естественная карта в recentCardIds — возвращается другая карта', () => {
    const natural = cardOfDay('2026-08-08', 42);
    const withRepeat = cardOfDay('2026-08-08', 42, [natural.id]);
    expect(withRepeat.id).not.toBe(natural.id);
  });

  it('все 78 id в recentCardIds — не зависает и возвращает карту (лимит 10 ретраев)', () => {
    const allIds = cards.map((c) => c.id);
    const result = cardOfDay('2026-08-08', 42, allIds);
    expect(result).toBeDefined();
    expect(cards).toContainEqual(result);
  });
});

describe('cardOfDay — распределение (testing-strategy)', () => {
  it('1000 сидов на одну дату → ни одна карта не выпадает чаще 3% (≤30 из 1000)', () => {
    const counts = new Map<string, number>();
    for (let seed = 1; seed <= 1000; seed++) {
      const id = cardOfDay('2026-08-08', seed).id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const count of counts.values()) {
      expect(count).toBeLessThanOrEqual(30);
    }
  });
});
