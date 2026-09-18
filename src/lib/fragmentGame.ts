/** Игра «Угадай карту по фрагменту» (спека 72) — чистая логика: сборка сессии, геометрия кропа,
 *  счёт. Ни одного импорта react/expo. Фрагмент задаётся центром и стороной квадрата в ДОЛЯХ скана:
 *  cx/cy — доли ширины/высоты, size — доля ШИРИНЫ (квадрат в пикселях ⇒ по высоте он size / ratio). */
import { shuffle } from './shuffle';
import { XP_REVIEW } from './xp';

export interface FragmentBox { cx: number; cy: number; size: number }
export type FragmentPool = Record<string, FragmentBox[]>;
export interface FragmentQuestion {
  cardId: string;
  box: FragmentBox;
  /** id карт-вариантов, перемешаны */
  options: string[];
  /** индекс верного варианта в options */
  correct: number;
}

export const FRAGMENT_SESSION = 10;
export const FRAGMENT_OPTIONS = 4;
/** высота / ширина скана; замер 18.09 по 22 старшим арканам: 1.719–1.721 (страж пропорции — cardAssets.test) */
export const CARD_RATIO = 1.72;
/** Запретные полосы: вверху напечатан номер аркана, внизу — имя карты (иначе ответ виден в кадре —
 *  дефект задачи 58). Замер 18.09: линия рамки над подписью не выше 0.088 высоты (21 карта из 22),
 *  верхняя — до 0.092; берём 0.10 с обеих сторон. */
export const FRAGMENT_TOP = 0.1;
export const FRAGMENT_BOTTOM = 0.1;
/** меньше — каша из пикселей при увеличении, больше — узнаётся вся композиция */
export const FRAGMENT_SIZE_MIN = 0.22;
export const FRAGMENT_SIZE_MAX = 0.45;

/** Края квадрата в долях скана. */
export function boxEdges(box: FragmentBox, ratio: number = CARD_RATIO) {
  const halfW = box.size / 2;
  const halfH = box.size / ratio / 2;
  return { left: box.cx - halfW, right: box.cx + halfW, top: box.cy - halfH, bottom: box.cy + halfH };
}

/** Сессия: карты без повтора, у карты случайный фрагмент, три дистрактора — другие карты пула.
 *  Верный индекс ВЫЧИСЛЯЕТСЯ после перемешивания, а не хранится рядом (задачи 29/31). */
export function buildFragmentSession(
  pool: FragmentPool,
  rng: () => number = Math.random,
  size: number = FRAGMENT_SESSION,
): FragmentQuestion[] {
  const ids = Object.keys(pool).filter((id) => pool[id].length > 0);
  if (ids.length < FRAGMENT_OPTIONS) return [];
  return shuffle(ids, rng)
    .slice(0, size)
    .map((cardId) => {
      const boxes = pool[cardId];
      const box = boxes[Math.floor(rng() * boxes.length)];
      const others = shuffle(ids.filter((id) => id !== cardId), rng).slice(0, FRAGMENT_OPTIONS - 1);
      const options = shuffle([cardId, ...others], rng);
      return { cardId, box, options, correct: options.indexOf(cardId) };
    });
}

/** Прямоугольник картинки внутри квадратного окна со стороной `view` (overflow: hidden).
 *  t = 0 — фрагмент заполняет окно; t = 1 — карта целиком вписана по высоте и стоит по центру;
 *  между ними — линейно (экран ведёт t анимацией «отъезда»). */
export function fragmentLayout(box: FragmentBox, view: number, ratio: number = CARD_RATIO, t: number = 0) {
  const w0 = view / box.size;
  const h0 = w0 * ratio;
  // центр фрагмента — в центр окна; у края скана прижимаем, чтобы окно не оголилось
  const left0 = Math.min(0, Math.max(view - w0, view / 2 - box.cx * w0));
  const top0 = Math.min(0, Math.max(view - h0, view / 2 - box.cy * h0));
  const h1 = view;
  const w1 = view / ratio;
  const left1 = (view - w1) / 2;
  const mix = (a: number, b: number) => a + (b - a) * t;
  return { width: mix(w0, w1), height: mix(h0, h1), left: mix(left0, left1), top: mix(top0, 0) };
}

export function sessionScore(log: readonly boolean[]) {
  const right = log.filter(Boolean).length;
  return { right, total: log.length, xp: right * XP_REVIEW };
}
