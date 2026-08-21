/** Очередь карт «момента переворота» (спека 46в): `completeLesson` кладёт сюда id впервые
 *  изученных карт, экран справочника забирает их на фокусе и играет волну раскрытия.
 *  Транзиентный модуль-синглтон (прецедент — cardTransition.ts): ничего не персистится,
 *  перезапуск приложения очередь теряет — сознательно, «момент» сиюминутен. */

let queue: string[] = [];

/** Дописать id в очередь без дублей (вызывается из completeLesson). */
export function queueReveal(ids: string[]) {
  for (const id of ids) if (!queue.includes(id)) queue.push(id);
}

/** Забрать всю очередь и сразу очистить — потребляется ровно один раз, на первом фокусе экрана. */
export function takeReveal(): string[] {
  const taken = queue;
  queue = [];
  return taken;
}

/** Потолок каскада: волна играет у первых REVEAL_CAP ячеек, остальные появляются сразу
 *  в конечном виде (motion-spec §4). */
export const REVEAL_CAP = 8;

/** Ступеньки стаггера для карт из `ids`, найденных в `rows`. Обходит ячейки в порядке сетки
 *  (ряды сверху вниз, в ряду слева направо) и раздаёт присутствующим в `ids` ступеньки 0..cap-1;
 *  карты сверх `cap` в Map не попадают — появляются сразу. Карты, которых нет в `rows`
 *  (скрыты фильтром/поиском), ступенек не получают. */
export function revealOrder<T extends { id: string }>(
  rows: T[][],
  ids: Set<string>,
  cap: number = REVEAL_CAP,
): Map<string, number> {
  const order = new Map<string, number>();
  for (const row of rows) {
    for (const cell of row) {
      if (order.size >= cap) return order;
      if (ids.has(cell.id)) order.set(cell.id, order.size);
    }
  }
  return order;
}
