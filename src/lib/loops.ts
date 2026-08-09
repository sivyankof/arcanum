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
  withRepeat,
  withTiming,
  type EasingFunction,
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

/** Бесконечное вращение 0 → 360°. Значение перед стартом обнуляем: иначе каждый круг
 *  начнётся с текущего угла и в конце прыгнет назад — та же ловушка `withRepeat`. */
export function startSpin(angle: SharedValue<number>, duration: number) {
  angle.value = 0;
  angle.value = withRepeat(
    withTiming(360, { duration, easing: Easing.linear, reduceMotion: ReduceMotion.System }),
    -1,
  );
}
