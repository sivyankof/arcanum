/** Выбор варианта системного текста — правило вариативности (logic-spec §9).
 *
 *  Один смысл живёт в content/phrases.json несколькими формулировками, а вариант выбирается
 *  ХЕШЕМ от даты и ключа, а не `Math.random`: в течение дня текст стабилен (вернулся на экран —
 *  та же фраза), назавтра, как правило, другая. Math.random здесь запрещён спекой.
 */
import phrasesJson from '../../content/phrases.json';
import { fnv1a32 } from './content';
import { inLang, type Lang, type Localized } from './lang';

/** Список вариантов по пути через точку: 'reflect.question', 'empty.filter'. */
function variantsAt(key: string): Localized[] {
  let node: unknown = phrasesJson;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return [];
    node = (node as Record<string, unknown>)[part];
  }
  return Array.isArray(node) ? (node as Localized[]) : [];
}

/** Выбор варианта из готового списка: hash(seedKey) % число вариантов, плейсхолдеры {card},
 *  {name}, {n}, {x}, {rank} подставляются ПОСЛЕ выбора (logic-spec §9). Неизвестный плейсхолдер
 *  остаётся в тексте как есть — это заметно при вычитке, в отличие от тихого «undefined».
 *  Общий для phrases.json (pickPhrase) и composition.json (composition.ts, спека 36). */
export function pickVariant(
  variants: Localized[],
  seedKey: string,
  lang: Lang,
  vars: Record<string, string | number> = {},
): string {
  if (variants.length === 0) return '';
  const text = inLang(variants[fnv1a32(seedKey) % variants.length], lang);
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/** Вариант системной фразы по ключу phrases.json: сид — дата и ключ, поэтому в течение дня
 *  формулировка стабильна, назавтра, как правило, другая. */
export function pickPhrase(
  key: string,
  dateISO: string,
  lang: Lang,
  vars: Record<string, string | number> = {},
): string {
  return pickVariant(variantsAt(key), `${dateISO}:${key}`, lang, vars);
}
