/** Плашка «ПРЕМИУМ» — `.lk` эталона (design-reference.html): 8.5px, ls 1.5, accent, border 1
 *  frame, фон chipBg, радиус 10, паддинг 8×3. Повторяется 3+ раза (пейвол — чип «✦ АКТИВНА»
 *  и бейдж «−40 %» задачи 5, `app/(tabs)/spreads/index.tsx` — бейдж «ПРЕМИУМ» у платных
 *  раскладов), поэтому вынесена сюда одним компонентом (правило DRY). Задачи 6–8 переведут
 *  на неё ещё три места: шапку модуля курса, тренажёр повторения и лунную панель раскладов. */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Txt } from './Txt';
import { useTheme } from '../theme/useTheme';

/** `solid` — плашка НЕПРОЗРАЧНАЯ: нужна там, где она лежит ПОВЕРХ линии (бейдж «−40 %» сидит
 *  на верхней рамке карточки тарифа, `top: -9`). `chipBg` — заливка 10 % (`theme.ts`), сквозь неё
 *  рамка `line` просвечивала горизонтальной полосой посреди бейджа — нашлось на лайв-проверке
 *  Артёма 22.08, веб-прогон и скриншоты этого не показали. Плотный слой `bg` кладётся ПОД
 *  ту же заливку `chipBg`, поэтому оттенок плашки остаётся прежним, а фон под ней перестаёт
 *  просвечивать. Поднятие z-index не помогло бы: полоса видна не из-за порядка слоёв,
 *  а из-за прозрачности самой заливки. */
export function PremiumBadge({
  label,
  style,
  solid,
}: {
  label?: string;
  style?: StyleProp<ViewStyle>;
  solid?: boolean;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();

  return (
    <View style={[st.lk, { borderColor: t.frame, backgroundColor: solid ? t.bg : t.chipBg }, style]}>
      {solid && <View style={[StyleSheet.absoluteFill, st.fill, { backgroundColor: t.chipBg }]} />}
      <Txt style={[st.text, { color: t.accent }]}>{label ?? tr('spreads.premium')}</Txt>
    </View>
  );
}

const st = StyleSheet.create({
  lk: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  // радиус на 1 меньше внешнего: заливка лежит ВНУТРИ рамки в 1px, иначе её углы вылезут за скругление
  fill: { borderRadius: 9 },
  text: { fontSize: 8.5, letterSpacing: 1.5, fontWeight: '700' },
});
