/** Липкая панель «невидимое стекло» (design-system §5).
 *
 *  Правило: липкие панели НЕ используют navBg и линии — плотная подложка с границей на
 *  градиентном фоне читается как чужеродная полоса. Вместо этого — полупрозрачный оттенок
 *  фона (токен `glass`) + размытие, и ОБА края растворяются маской, чтобы границ не было видно
 *  вовсе: контент под панелью просто затуманивается.
 *
 *  Маска в эталоне: `linear-gradient(transparent, #000 22%, #000 78%, transparent)` —
 *  она накрывает панель целиком, вместе с содержимым (у поля поиска подтаивает верх,
 *  у чипов — низ). Поэтому размытие нельзя рисовать отдельным слоем под контентом.
 *
 *  Платформы: в вебе это ровно тот же CSS (`backdrop-filter` + `mask-image`), на iOS/Android —
 *  MaskedView поверх BlurView (у masked-view нет веб-реализации, отсюда развилка). */
import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';

/** Размытие фона под панелью: в вебе — CSS-пиксели эталона, на нативе — шкала expo-blur 0–100. */
const CSS_BLUR = 18;
const NATIVE_BLUR_INTENSITY = 40;

/** Высота зон растворения в пикселях. Считаем именно в px, а не в процентах: зона должна
 *  умещаться в вертикальные отступы панели, иначе полупрозрачность наползает на поле поиска
 *  сверху и на чипы снизу — они выглядят размытыми (правка по фидбеку Артёма 11.08). */
const FADE_TOP = 18;
const FADE_BOTTOM = 16;

const MASK_CSS =
  `linear-gradient(to bottom, transparent 0px, #000 ${FADE_TOP}px,` +
  ` #000 calc(100% - ${FADE_BOTTOM}px), transparent 100%)`;

export function StickyGlass({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  // на нативе стопы градиента задаются долями, поэтому нужна измеренная высота панели
  const [h, setH] = React.useState(0);

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          style,
          {
            backgroundColor: t.glass,
            backdropFilter: `blur(${CSS_BLUR}px)`,
            maskImage: MASK_CSS,
            WebkitMaskImage: MASK_CSS,
          } as ViewStyle,
        ]}
      >
        {children}
      </View>
    );
  }

  // до первого замера растворяем края по долям — панель успевает отрисоваться без скачка
  const stops: [number, number, number, number] =
    h > FADE_TOP + FADE_BOTTOM ? [0, FADE_TOP / h, (h - FADE_BOTTOM) / h, 1] : [0, 0.15, 0.85, 1];

  return (
    <MaskedView
      maskElement={
        <LinearGradient
          colors={['transparent', '#000', '#000', 'transparent']}
          locations={stops}
          style={StyleSheet.absoluteFill}
        />
      }
    >
      <View style={style} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
        <BlurView
          intensity={NATIVE_BLUR_INTENSITY}
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
