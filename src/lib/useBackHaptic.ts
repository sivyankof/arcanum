/** Лёгкая вибрация при уходе со стекового экрана. Кнопка «назад» нативная, повесить на неё
 *  onPress нельзя, поэтому ловим сам уход с экрана — это покрывает и кнопку, и свайп-жест. */
import { useNavigation } from 'expo-router';
import React from 'react';
import { hapticTap } from './haptics';

export function useBackHaptic() {
  const navigation = useNavigation();
  React.useEffect(() => navigation.addListener('beforeRemove', () => { hapticTap(); }), [navigation]);
}
