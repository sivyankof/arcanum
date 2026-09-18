/** Общая нажимаемая панель-строка (эталон `.mhead`/`.revcard`): overline + строка + необязательный
 *  подстрочник + иконка справа, геометрия `moduleBox` — та же, что у шапки модуля курса.
 *  Раньше `ReviewPanel` и `FragmentPanel` держали ПОЧТИ идентичную вёрстку каждый у себя
 *  (задача 72, финальное ревью, находка F14) — теперь общий каркас, а панели остаются тонкими
 *  обёртками над своими текстами и состояниями. `tappable` решает PressableScale/View явно,
 *  а не по наличию `onPress`: панель ReviewPanel в состоянии «всё повторено» обязана остаться
 *  простой `View` — без пружины, обещающей переход, которого нет. */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { fonts } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { moduleBox } from './ModuleHeader';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function PanelRow({
  overline,
  line,
  sub,
  lineColor,
  icon,
  tappable,
  onPress,
  style,
}: {
  overline: string;
  line: string;
  /** третья строка (только у FragmentPanel) — ReviewPanel её не несёт */
  sub?: string;
  /** цвет строки `line`; по умолчанию `t.head` (ReviewPanel красит её в success на «всё повторено») */
  lineColor?: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tappable: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();

  const body = (
    <>
      <View style={{ flex: 1 }}>
        <Txt style={[st.overline, { color: t.accent }]}>{overline}</Txt>
        <Txt style={[st.line, { color: lineColor ?? t.head }]}>{line}</Txt>
        {sub !== undefined && <Txt style={[st.sub, { color: t.muted }]}>{sub}</Txt>}
      </View>
      <Ionicons name={icon} size={18} color={t.muted} />
    </>
  );
  const box = [st.box, { backgroundColor: t.panel, borderColor: t.line }, style];

  return tappable ? (
    <PressableScale onPress={onPress} accessibilityRole="button" style={box}>
      {body}
    </PressableScale>
  ) : (
    <View style={box}>{body}</View>
  );
}

const st = StyleSheet.create({
  box: moduleBox,
  // `.revcard`/`.mhead` эталона: overline 8.5/ls2 accent, строка Cormorant 600 15
  overline: { fontSize: 8.5, letterSpacing: 2 },
  line: { fontFamily: fonts.displaySemi, fontSize: 15, marginTop: 2 },
  sub: { fontSize: 12, marginTop: 2 },
});
