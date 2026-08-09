/** Бесконечные циклические анимации (маятник и вращение).
 *
 *  ГЛАВНОЕ ПРАВИЛО: цикл НЕЛЬЗЯ собирать как `withRepeat(withSequence(туда, обратно), -1)`.
 *  `withRepeat` начинает каждый следующий круг не с конца предыдущего, а со значения,
 *  которое было в момент запуска анимации (`animation.startValue`, см. repeat.ts в reanimated).
 *  Последовательность же всегда заканчивается своей последней точкой. Совпадает это только
 *  если запуск случился ровно в этой точке. Стоит эффекту перезапуститься посреди полёта
 *  (Fast Refresh во время разработки, повторный вызов), и цикл НАВСЕГДА становится «пилой»:
 *  плавная фаза, а в конце круга мгновенный прыжок обратно в точку старта.
 *  Размер прыжка равен значению на момент запуска — потому баг и выглядит каждый раз по-разному.
 */
import {
  Easing,
  ReduceMotion,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type EasingFunction,
  type EasingFunctionFactory,
  type SharedValue,
} from 'react-native-reanimated';

/** Маятник: значение ходит между текущей точкой и `to` и обратно, бесконечно.
 *  Развороты делает сам `withRepeat(reverse: true)`, поэтому разрыва не бывает
 *  ни при каком значении на момент запуска. */
export function pingPong(to: number, duration: number, easing: EasingFunction = Easing.inOut(Easing.quad)) {
  return withRepeat(
    withTiming(to, { duration, easing, reduceMotion: ReduceMotion.System }),
    -1,
    true,
  );
}

/** Проход с паузой: значение идёт 0 → 1 за `duration`, держится `pause` и цикл начинается заново.
 *  Годится для «пролетающих» слоёв (блик по карте дня): в крайних точках элемент уведён за края,
 *  поэтому мгновенный возврат 1 → 0 в конце паузы не виден.
 *
 *  Ловушка `withRepeat` из шапки файла тут не срабатывает: последовательность заканчивается нулём —
 *  ровно тем значением, с которого её запускают (перед вызовом shared value обнулить).
 *  Пауза сделана задержкой, а не «таймингом на месте»: так она не зависит от того, как
 *  reanimated поведёт себя с анимацией в уже достигнутую точку. */
export function sweepLoop(
  duration: number,
  pause: number,
  easing: EasingFunction | EasingFunctionFactory,
) {
  return withRepeat(
    withSequence(
      withTiming(1, { duration, easing, reduceMotion: ReduceMotion.System }),
      withDelay(pause, withTiming(0, { duration: 0, reduceMotion: ReduceMotion.System })),
    ),
    -1,
  );
}

/** Бесконечное вращение 0 → 360°. Значение перед стартом обнуляем: иначе каждый круг
 *  начнётся с текущего угла и в конце прыгнет назад — та же ловушка `withRepeat`. */
export function startSpin(angle: SharedValue<number>, duration: number) {
  angle.value = 0;
  angle.value = withRepeat(
    withTiming(360, { duration, easing: Easing.linear, reduceMotion: ReduceMotion.System }),
    -1,
  );
}
