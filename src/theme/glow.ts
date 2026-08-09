/**
 * Свечение по контуру содержимого (альфа-маске), а НЕ по прямоугольнику элемента.
 *
 * В эталоне (docs/design-reference.html) такие места рисуются через CSS
 * `filter: drop-shadow(...)` — он обводит непрозрачные пиксели самой иконки/SVG.
 * RN-проп `boxShadow`, в отличие от него, всегда рисует тень по border-box, то есть
 * по прямоугольнику элемента — вокруг иконки с прозрачным фоном получается видимая
 * квадратная тень. Поэтому для контурного свечения boxShadow не подходит.
 *
 * RN `filter: dropShadow(...)` (аналог CSS) работает на Android 12+ и в react-native-web,
 * но НЕ на iOS — там из фильтров доступны только brightness/opacity. На iOS вместо этого
 * используем старые `shadow*`-пропы: они рисуют тень по альфа-маске слоя, то есть тоже
 * по контуру содержимого, а не по прямоугольнику.
 *
 * @param glowColor  цвет свечения для web/Android (обычно t.glow, с альфой)
 * @param iosColor   цвет тени для iOS (обычно t.accent — shadowColor не работает с rgba так же предсказуемо)
 * @param cssBlur    радиус размытия в CSS-пикселях, как в эталоне: drop-shadow(0 0 <cssBlur>px ...)
 * @param iosOpacity непрозрачность тени на iOS (shadowOpacity)
 */
import { Platform, type ViewStyle } from 'react-native';

export function glowShadow(glowColor: string, iosColor: string, cssBlur: number, iosOpacity: number): ViewStyle {
  if (Platform.OS === 'ios') {
    return {
      shadowColor: iosColor,
      shadowOpacity: iosOpacity,
      // shadowRadius в RN примерно вдвое меньше CSS blur-радиуса — правило проекта
      shadowRadius: cssBlur / 2,
      shadowOffset: { width: 0, height: 0 },
    };
  }
  return { filter: `drop-shadow(0px 0px ${cssBlur}px ${glowColor})` } as ViewStyle;
}
