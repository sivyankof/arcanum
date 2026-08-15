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

/** Плейсхолдеры {card}, {name}, {n} подставляются ПОСЛЕ выбора варианта (logic-spec §9).
 *  Неизвестный плейсхолдер остаётся в тексте как есть — это заметно при вычитке,
 *  в отличие от тихой подстановки «undefined». */
export function pickPhrase(
  key: string,
  dateISO: string,
  lang: Lang,
  vars: Record<string, string | number> = {},
): string {
  const variants = variantsAt(key);
  if (variants.length === 0) return '';
  const text = inLang(variants[fnv1a32(`${dateISO}:${key}`) % variants.length], lang);
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}
