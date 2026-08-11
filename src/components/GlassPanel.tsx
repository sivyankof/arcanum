/** Панель-«невидимое стекло» (design-system §5).
 *
 *  Правило: полупрозрачные панели НЕ используют navBg и линии — плотная подложка с границей
 *  на градиентном фоне читается как чужеродная полоса. Вместо этого — полупрозрачный оттенок
 *  фона (токен `glass`) + размытие, а края растворяются маской, чтобы границ не было видно вовсе:
 *  контент под панелью просто затуманивается.
 *
 *  Зоны растворения задаются В ПИКСЕЛЯХ и должны умещаться в вертикальные отступы панели:
 *  в процентах они зависят от высоты и заезжают на содержимое (фидбек Артёма 11.08). Маска
 *  накрывает панель целиком, вместе с содержимым, поэтому размытие нельзя рисовать отдельным
 *  слоем под контентом.
 *
 *  Платформы: в вебе это ровно тот же CSS, что в эталоне (`backdrop-filter` + `mask-image`),
 *  на iOS/Android — MaskedView поверх BlurView (у masked-view нет веб-реализации, отсюда развилка). */
import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';

/** Перевод размытия из CSS-пикселей в шкалу expo-blur 0–100 (замерено на задаче 04: 18 ↔ 40). */
const toIntensity = (cssBlur: number) => Math.round(cssBlur * (40 / 18));

export function GlassPanel({
  children,
  style,
  blur,
  fadeTop = 0,
  fadeBottom = 0,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** размытие фона в CSS-пикселях эталона */
  blur: number;
  /** высота растворения верхнего края, px (0 — край не растворяется) */
  fadeTop?: number;
  /** высота растворения нижнего края, px */
  fadeBottom?: number;
}) {
  const t = useTheme();
  // на нативе стопы градиента задаются долями, поэтому нужна измеренная высота панели
  const [h, setH] = React.useState(0);

  if (Platform.OS === 'web') {
    const stops = [
      fadeTop > 0 ? `transparent 0px, #000 ${fadeTop}px` : '#000 0px',
      fadeBottom > 0 ? `#000 calc(100% - ${fadeBottom}px), transparent 100%` : '#000 100%',
    ].join(', ');
    const mask = `linear-gradient(to bottom, ${stops})`;

    return (
      <View
        style={[
          style,
          {
            backgroundColor: t.glass,
            backdropFilter: `blur(${blur}px)`,
            maskImage: mask,
            WebkitMaskImage: mask,
          } as ViewStyle,
        ]}
      >
        {children}
      </View>
    );
  }

  // до первого замера растворяем края по долям — панель успевает отрисоваться без скачка
  const measured = h > fadeTop + fadeBottom;
  const colors: string[] = ['#000'];
  const locations: number[] = [0];
  if (fadeTop > 0) {
    colors.unshift('transparent');
    locations.unshift(0);
    locations[1] = measured ? fadeTop / h : 0.15;
  }
  if (fadeBottom > 0) {
    colors.push('#000', 'transparent');
    locations.push(measured ? (h - fadeBottom) / h : 0.85, 1);
  } else {
    colors.push('#000');
    locations.push(1);
  }

  return (
    // стиль (в т.ч. паддинги) — на внутренней View, а не на MaskedView: иначе размытие
    // и слой glass, растянутые по absoluteFill, не накроют отступы панели
    <MaskedView
      maskElement={
        <LinearGradient
          colors={colors as [string, string, ...string[]]}
          locations={locations as [number, number, ...number[]]}
          style={StyleSheet.absoluteFill}
        />
      }
    >
      <View style={style} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
        <BlurView
          intensity={toIntensity(blur)}
          tint={t.mode === 'dark' ? 'dark' : 'light'}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.glass }]} />
        {children}
      </View>
    </MaskedView>
  );
}
