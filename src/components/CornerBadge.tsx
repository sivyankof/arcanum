/** Угловой бейдж поверх картинки карты — эталон `.st2` (design-system §5).
 *  Служебная метка в правом верхнем углу: «полка» для бейджей одна, низ карт
 *  Райдер–Уэйт занят печатным названием.
 *
 *  Два варианта, оба через один компонент (правило «2+ раза → выносить»):
 *  - текстовый (`label`) — «ИЗУЧЕНО ✓» в сетке справочника (спека 08);
 *  - иконочный (`icon`) — ярлычок «можно увеличить» на входах в полноэкранный
 *    просмотр: герой страницы карты и лицевая грань открытой карты дня (спека 39).
 *
 *  Подложка-скрим И цвет содержимого задаются вне темы: скрим — затемнение поверх фото,
 *  одинаково тёмное в обеих темах, поэтому и золото на нём всегда светлое (`gold.onScrim`).
 *  Тем-зависимый `accent2` на светлой теме — ТЁМНОЕ золото: на скриме давал 1.35:1,
 *  бейдж «ИЗУЧЕНО ✓» был почти невидим (замер в спеке 48). */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { gold, radius } from '../theme/theme';
import { Txt } from './Txt';

const ICON_SIZE = 12;

export function CornerBadge({
  label,
  icon,
  style,
}: {
  /** Текстовый вариант — «ИЗУЧЕНО ✓». */
  label?: string;
  /** Иконочный вариант — имя Ionicons (у нас `expand-outline`). */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[st.badge, icon ? st.padIcon : st.padText, style]}>
      {icon ? (
        <Ionicons name={icon} size={ICON_SIZE} color={gold.onScrim} />
      ) : (
        <Txt style={[st.label, { color: gold.onScrim }]}>{label}</Txt>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: radius.s,
    // свойство внутри стиля, а не пропом: пропом react-native-web пишет предупреждение (спека 07)
    pointerEvents: 'none',
  },
  padText: { paddingVertical: 2, paddingHorizontal: 6 },
  padIcon: { padding: 3 },
  label: { fontSize: 8, letterSpacing: 0.5, fontWeight: '700' },
});
