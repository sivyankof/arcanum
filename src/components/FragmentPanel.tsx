/** Вход в игру «Угадай карту» (спека 72) — панель той же геометрии, что шапка модуля и «Повторение».
 *  Стоит на «Учёбе» и первым блоком ленты «Практики». Каркас — общий `PanelRow` (задача 72,
 *  финальное ревью, находка F14): раньше вёрстка была продублирована с `ReviewPanel` почти дословно. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { StyleProp, ViewStyle } from 'react-native';
import { PanelRow } from './PanelRow';

export function FragmentPanel({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const { t: tr } = useTranslation();
  return (
    <PanelRow
      overline={tr('game.overline')}
      line={tr('game.title')}
      sub={tr('game.sub')}
      icon="search-outline"
      tappable
      onPress={onPress}
      style={style}
    />
  );
}
