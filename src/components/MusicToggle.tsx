/** Кнопка-иконка звука в шапке «Учёбы»: включает и выключает фоновую музыку
 *  (settings.musicOn). Значок 22 px, зона нажатия 44×44 (задача 74). */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { hapticTap } from '../lib/haptics';
import { useApp } from '../store/useApp';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';

export function MusicToggle() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const musicOn = useApp((s) => s.settings.musicOn);
  const setMusicOn = useApp((s) => s.setMusicOn);

  return (
    <PressableScale
      testID="music-toggle"
      accessibilityRole="switch"
      accessibilityState={{ checked: musicOn }}
      // react-native-web 0.21 не переводит accessibilityState в DOM — отдельный aria-checked
      aria-checked={musicOn}
      accessibilityLabel={tr('settings.music')}
      hitSlop={11}
      onPress={() => {
        hapticTap();
        setMusicOn(!musicOn);
      }}
      style={st.btn}
    >
      <Ionicons
        name={musicOn ? 'volume-medium-outline' : 'volume-mute-outline'}
        size={22}
        color={musicOn ? t.accent : t.muted}
      />
    </PressableScale>
  );
}

const st = StyleSheet.create({
  // видимая область 22 px + hitSlop 11 с каждой стороны = зона 44×44
  btn: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
});
