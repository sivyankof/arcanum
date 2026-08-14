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
  // доступность сенсора (M1): пока неизвестна — считаем недоступным, так хук честно отдаёт
  // null и хозяин включает фолбэк-качание вместо мёртвого параллакса
  const [available, setAvailable] = React.useState(false);

  React.useEffect(() => {
    if (!enabled || !native) return;
    // база калибровки нулём (I1): абсолютный наклон при обычном хвате телефона (50–70°)
    // сразу упирается в клапан после деления на 6 — ось X будто мертва. Первый пришедший
    // сэмпл запоминаем как ноль отсчёта, дальше считаем наклон ОТ него
    let base: { beta: number; gamma: number } | null = null;
    DeviceMotion.isAvailableAsync().then((ok) => setAvailable(ok));
    DeviceMotion.setUpdateInterval(33); // 30Hz — motion-spec §15
    const sub = DeviceMotion.addListener((m) => {
      const rot = m.rotation; // радианы: beta — наклон к себе/от себя, gamma — вбок
      if (!rot) return;
      if (!base) base = { beta: rot.beta, gamma: rot.gamma };
      // пружина damping 20 — карта «догоняет» руку, а не дёргается за ней
      x.value = withSpring(clampDeg(((rot.beta - base.beta) * 180) / Math.PI / 6), { damping: 20 });
      y.value = withSpring(clampDeg(((rot.gamma - base.gamma) * 180) / Math.PI / 6), { damping: 20 });
    });
    return () => {
      sub.remove();
      base = null;
      setAvailable(false);
    };
  }, [enabled, native, x, y]);

  return native && available ? { x, y } : null;
}
