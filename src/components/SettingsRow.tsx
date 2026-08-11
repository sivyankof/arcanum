/** Строка настройки (design-system §5): панель radius 15, иконка 18px accent + название +
 *  текущее значение справа. Живут на отдельном экране «Настройки» (вход — шестерёнка в профиле);
 *  профиль остаётся эмоциональным «путём» (решение product-spec §5). */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet } from 'react-native';
import { hapticTap } from '../lib/haptics';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function SettingsRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const t = useTheme();

  return (
    <PressableScale
      onPress={
        onPress &&
        (() => {
          hapticTap(); // строки настроек — переключатели, отклик как у фильтров
          onPress();
        })
      }
      style={[st.row, { backgroundColor: t.panel, borderColor: t.line }]}
    >
      <Ionicons name={icon} size={18} color={t.accent} />
      <Txt style={{ color: t.text, fontSize: 14, flex: 1 }}>{label}</Txt>
      <Txt style={{ color: t.muted, fontSize: 13, fontWeight: '600' }}>{value}</Txt>
    </PressableScale>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: radius.l,
    padding: spacing.l,
    marginTop: spacing.s,
  },
});
