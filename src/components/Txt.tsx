/** Текст интерфейса шрифтом Manrope (`--sans` эталона).
 *
 *  Зачем обёртка: в React Native глобальный шрифт задать нельзя, а начертания у кастомных
 *  шрифтов не синтезируются — каждому весу соответствует своё семейство. Если оставить
 *  `fontWeight: '700'` рядом с `fontFamily: 'Manrope_400Regular'`, iOS либо нарисует
 *  фальшивый жир, либо свалится на системный шрифт. Поэтому вес превращаем в имя семейства
 *  и убираем из стиля.
 *
 *  Заголовки набираются Cormorant: если в стиле уже задан `fontFamily`, ничего не трогаем.
 *  Декоративные символы (✦ ✧ ☽) тоже оставляем обычным `Text` — в Manrope их нет. */
import React from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { fonts } from '../theme/theme';

const BY_WEIGHT: Record<string, string> = {
  '100': fonts.sans,
  '200': fonts.sans,
  '300': fonts.sans,
  '400': fonts.sans,
  normal: fonts.sans,
  '500': fonts.sansMedium,
  '600': fonts.sansSemi,
  '700': fonts.sansBold,
  bold: fonts.sansBold,
  '800': fonts.sansExtra,
  '900': fonts.sansExtra,
};

export function Txt({ style, ...rest }: TextProps) {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;

  if (flat.fontFamily) return <Text style={style} {...rest} />;

  const { fontWeight, ...restStyle } = flat;
  const family = BY_WEIGHT[String(fontWeight ?? '400')] ?? fonts.sans;

  return <Text style={[{ fontFamily: family }, restStyle]} {...rest} />;
}
