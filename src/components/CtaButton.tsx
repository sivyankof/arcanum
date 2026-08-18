/** Золотая CTA-кнопка (`.btn` эталона, design-system §5): градиент gold.gradient,
 *  блик по верхней кромке, тень glow, пружинное нажатие. Одна CTA на экран.
 *
 *  Тень живёт на внешней View: `overflow: 'hidden'` для обрезки градиента срезал бы её,
 *  поэтому обрезка вынесена во вложенный слой (та же схема, что у карты дня). */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { gold, radius } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function CtaButton({
  label,
  onPress,
  style,
  disabled,
}: {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const t = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[st.cta, { boxShadow: `0px 12px 30px ${t.glow}` }, style, disabled && st.disabled]}
    >
      <View style={st.clip}>
        <LinearGradient colors={gold.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.6 }} style={st.grad}>
          {/* inset 0 1px 0 rgba(255,255,255,.5) из эталона — блик по верхней кромке */}
          <View style={st.gloss} />
          <Txt style={st.txt}>{label}</Txt>
        </LinearGradient>
      </View>
    </PressableScale>
  );
}

const st = StyleSheet.create({
  cta: { marginTop: 14, borderRadius: radius.l },
  clip: { borderRadius: radius.l, overflow: 'hidden' },
  grad: { paddingVertical: 15, alignItems: 'center' },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.5)' },
  txt: { color: gold.text, fontWeight: '800', fontSize: 13, letterSpacing: 1.5 },
  // `s3saved`: opacity .75 — кнопка после сохранения гаснет и перестаёт нажиматься
  disabled: { opacity: 0.75 },
});
