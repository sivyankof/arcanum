/** Разделитель под заголовком экрана — блок `.rule` из эталона:
 *  две гаснущие к краям линии и золотая звёздочка между ними.
 *  В макете стоит на «Сегодня», «Курс» и «Картах», поэтому живёт здесь, а не в экране. */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';

export function Rule() {
  const t = useTheme();
  // 'transparent' в градиенте на iOS даёт серый ореол, поэтому гасим через альфу самого цвета
  const clear = `${t.frame}00`;

  return (
    <View style={st.row}>
      <LinearGradient colors={[clear, t.frame]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.line} />
      <Text style={[st.star, { color: t.accent }]}>✦</Text>
      <LinearGradient colors={[t.frame, clear]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.line} />
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 190, alignSelf: 'center', marginTop: 10 },
  line: { flex: 1, height: 1 },
  star: { fontSize: 9 },
});
