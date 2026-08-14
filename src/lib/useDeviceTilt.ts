/** Наклон устройства для параллакса просмотра карты (motion-spec §15).
 *  Вне iOS/Android (или без сенсора) отдаёт null — хозяин включает CSS-качание вместо. */
import React from 'react';
import { Platform } from 'react-native';
import { DeviceMotion } from 'expo-sensors';
import { SharedValue, useSharedValue, withSpring } from 'react-native-reanimated';

const MAX_DEG = 6;
const clampDeg = (v: number) => Math.min(MAX_DEG, Math.max(-MAX_DEG, v));

export function useDeviceTilt(
  enabled: boolean,
): { x: SharedValue<number>; y: SharedValue<number> } | null {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const native = Platform.OS === 'ios' || Platform.OS === 'android';

  React.useEffect(() => {
    if (!enabled || !native) return;
    DeviceMotion.setUpdateInterval(33); // 30Hz — motion-spec §15
    const sub = DeviceMotion.addListener((m) => {
      const rot = m.rotation; // радианы: beta — наклон к себе/от себя, gamma — вбок
      if (!rot) return;
      // пружина damping 20 — карта «догоняет» руку, а не дёргается за ней
      x.value = withSpring(clampDeg((rot.beta * 180) / Math.PI / 6), { damping: 20 });
      y.value = withSpring(clampDeg((rot.gamma * 180) / Math.PI / 6), { damping: 20 });
    });
    return () => sub.remove();
  }, [enabled, native, x, y]);

  return native ? { x, y } : null;
}
