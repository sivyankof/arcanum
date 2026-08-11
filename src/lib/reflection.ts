/** Когда на «Сегодня» показывается блок вечерней рефлексии (product-spec §1, logic-spec §3).
 *
 *  Вынесено в чистую функцию, чтобы граничные случаи (17:59 / 18:00, карта не открыта,
 *  выключенный тумблер) проверялись тестами, а не наблюдением за часами.
 */

/** С этого часа местного времени появляется блок. */
export const REFLECT_HOUR = 18;

export interface ReflectionGate {
  /** Карта дня уже открыта — иначе рефлексировать не о чем. */
  drawn: boolean;
  /** Текущий локальный час, 0–23. */
  hour: number;
  /** Настройка «Вечерняя рефлексия». */
  enabled: boolean;
  /** DEV-обход времени (строка в настройках под __DEV__). Тумблер НЕ обходит. */
  devForce?: boolean;
}

export function reflectionVisible({ drawn, hour, enabled, devForce }: ReflectionGate): boolean {
  if (!drawn || !enabled) return false;
  return devForce === true || hour >= REFLECT_HOUR;
}
