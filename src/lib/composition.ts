/** «Состав расклада» — офлайн-наблюдения без ИИ (logic-spec §1б, спека 36 А). Чистый модуль:
 *  правила отдают КЛЮЧИ и числа, тексты берутся из content/composition.json детерминированно
 *  (hash(дата расклада + ключ) — при повторном открытии из дневника текст не меняется).
 *  Тон текстов — редактор; здесь только арифметика. */
import compositionJson from '../../content/composition.json';
import { cardById, type TarotCard } from './content';
import { inLang, type Lang, type Localized } from './lang';
import { pickVariant } from './phrases';
import type { DrawnCard } from './spread';

export type Suit = NonNullable<TarotCard['suit']>;
export type ObservationKey =
  | 'majors'
  | `suit.${Suit}`
  | 'reversed'
  | 'ranks.aces'
  | 'ranks.tens'
  | 'ranks.courts'
  | 'ranks.generic'
  | 'neutral';

export interface Observation {
  key: ObservationKey;
  /** x — счёт, n — знаменатель (число карт), rank — номер номинала у generic */
  vars: Record<string, number>;
}

const SUITS: Suit[] = ['wands', 'cups', 'swords', 'pentacles'];
const RANK_ACE = 1;
const RANK_TEN = 10;
const COURT_FROM = 11; // Паж 11 · Рыцарь 12 · Королева 13 · Король 14

/** Правило 4: одно наблюдение о номиналах — группа с наибольшим счётом; при равенстве
 *  порядок aces → tens → courts → номиналы 2–9 по возрастанию (порядок добавления кандидатов). */
function rankObservation(minors: TarotCard[]): Observation | null {
  const count = (pred: (c: TarotCard) => boolean) => minors.filter(pred).length;
  const candidates: Observation[] = [];
  const aces = count((c) => c.number === RANK_ACE);
  if (aces >= 2) candidates.push({ key: 'ranks.aces', vars: { x: aces } });
  const tens = count((c) => c.number === RANK_TEN);
  if (tens >= 2) candidates.push({ key: 'ranks.tens', vars: { x: tens } });
  const courts = count((c) => c.number >= COURT_FROM);
  if (courts >= 2) candidates.push({ key: 'ranks.courts', vars: { x: courts } });
  for (let rank = 2; rank < RANK_TEN; rank++) {
    const k = count((c) => c.number === rank);
    if (k >= 2) candidates.push({ key: 'ranks.generic', vars: { x: k, rank } });
  }
  if (candidates.length === 0) return null;
  return candidates.reduce((best, cand) => (cand.vars.x > best.vars.x ? cand : best));
}

/** Наблюдения по правилам 1–4 в этом порядке (все сработавшие, 1–4 штуки);
 *  ничего не сработало → одно neutral. Пороги — спека 36 А. */
export function analyzeSpread(drawn: DrawnCard[]): Observation[] {
  const cards = drawn.map((d) => cardById.get(d.cardId)).filter((c): c is TarotCard => !!c);
  const n = cards.length;
  const out: Observation[] = [];

  // 1. Старшие арканы — не меньше половины карт
  const majors = cards.filter((c) => c.arcana === 'major').length;
  if (n > 0 && majors * 2 >= n) out.push({ key: 'majors', vars: { x: majors, n } });

  // 2. Одна масть — единственный лидер, не меньше двух карт и не меньше половины младших
  const minors = cards.filter((c) => c.arcana === 'minor');
  if (minors.length >= 2) {
    const bySuit = SUITS.map((s) => ({ s, k: minors.filter((c) => c.suit === s).length }));
    const best = Math.max(...bySuit.map((b) => b.k));
    const leaders = bySuit.filter((b) => b.k === best);
    if (best >= 2 && best * 2 >= minors.length && leaders.length === 1) {
      out.push({ key: `suit.${leaders[0].s}`, vars: { x: best, n: minors.length } });
    }
  }

  // 3. Перевёрнутых — не меньше половины
  const reversed = drawn.filter((d) => d.reversed).length;
  if (n > 0 && reversed * 2 >= n) out.push({ key: 'reversed', vars: { x: reversed, n } });

  // 4. Совпадение номиналов (только младшие)
  const rank = rankObservation(minors);
  if (rank) out.push(rank);

  return out.length > 0 ? out : [{ key: 'neutral', vars: {} }];
}

type VariantsNode = { variants: Localized[] };
const json = compositionJson as unknown as {
  majors: VariantsNode;
  reversed: VariantsNode;
  neutral: VariantsNode;
  suit: Record<Suit, VariantsNode>;
  ranks: Record<'aces' | 'tens' | 'courts' | 'generic', VariantsNode>;
  rankNames: Record<string, Localized>;
};

function variantsFor(key: ObservationKey): Localized[] {
  if (key.startsWith('suit.')) return json.suit[key.slice('suit.'.length) as Suit].variants;
  if (key.startsWith('ranks.')) return json.ranks[key.slice('ranks.'.length) as 'aces'].variants;
  return json[key as 'majors' | 'reversed' | 'neutral'].variants;
}

/** Тексты наблюдений: вариант — fnv1a(дата:ключ) % число вариантов (logic-spec §9),
 *  {rank} — имя номинала на языке из rankNames, {x}/{n} — числа. */
export function compositionTexts(obs: Observation[], dateISO: string, lang: Lang): string[] {
  return obs.map((o) => {
    const vars: Record<string, string | number> = { ...o.vars };
    if (o.vars.rank !== undefined) vars.rank = inLang(json.rankNames[String(o.vars.rank)], lang);
    return pickVariant(variantsFor(o.key), `${dateISO}:${o.key}`, lang, vars);
  });
}
