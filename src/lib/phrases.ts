/** Выбор варианта системного текста — правило вариативности (logic-spec §9).
 *
 *  Один смысл живёт в content/phrases.json несколькими формулировками, а вариант выбирается
 *  ХЕШЕМ от даты и ключа, а не `Math.random`: в течение дня текст стабилен (вернулся на экран —
 *  та же фраза), назавтра, как правило, другая. Math.random здесь запрещён спекой.
 */
import phrasesJson from '../../content/phrases.json';
import { fnv1a32 } from './content';
import type { CanonLang, Lang } from './lang';

interface Phrase { ru: string; en: string }

/** Список вариантов по пути через точку: 'reflect.question', 'empty.filter'. */
function variantsAt(key: string): Phrase[] {
  let node: unknown = phrasesJson;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return [];
    node = (node as Record<string, unknown>)[part];
  }
  return Array.isArray(node) ? (node as Phrase[]) : [];
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
  // Phrase хранит только ru/en (es/pt появятся с переводами, задача 28) — узкий индекс
  // безопасен и сейчас: lang шире стал только на уровне сигнатуры (спека 27, задача 2)
  const text = variants[fnv1a32(`${dateISO}:${key}`) % variants.length][lang as CanonLang];
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}
