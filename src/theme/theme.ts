/**
 * Дизайн-токены Arcanum — направление «Небесное золото».
 * Единственный источник правды для цветов/типографики: экраны берут тему отсюда.
 */
export type ThemeMode = 'dark' | 'light';

export interface Theme {
  mode: ThemeMode;
  bg: string;
  bgTop: string;       // верх градиента фона
  bgBottom: string;    // низ градиента фона
  ring: string;        // пунктирные кольца вокруг карты дня
  text: string;
  head: string;        // заголовки (тёплый пергамент)
  muted: string;
  line: string;
  panel: string;
  accent: string;      // шампанское золото
  accent2: string;
  glow: string;
  frame: string;       // золочёные рамки
  navBg: string;
  chipBg: string;
  danger: string;
  success: string;
}

export const darkTheme: Theme = {
  mode: 'dark',
  bg: '#0e1129',
  bgTop: '#1c2244',
  bgBottom: '#070917',
  ring: '#39426f',
  text: '#e2e6f4',
  head: '#f5eacb',
  muted: '#7e86ab',
  line: '#262e56',
  panel: 'rgba(24,30,62,0.55)',
  accent: '#e2bd72',
  accent2: '#f0d9a4',
  glow: 'rgba(226,189,114,0.35)',
  frame: '#8f7439',
  navBg: 'rgba(7,9,23,0.66)',
  chipBg: 'rgba(226,189,114,0.10)',
  danger: '#e07a6a',
  success: '#5aa07e',
};

export const lightTheme: Theme = {
  mode: 'light',
  bg: '#f5eeda',
  bgTop: '#fcf8ee',
  bgBottom: '#efe8d2',
  ring: '#d8c89e',
  text: '#3d3d55',
  head: '#4a3a16',
  muted: '#a29878',
  line: '#e3d8ba',
  panel: 'rgba(255,255,255,0.66)',
  accent: '#a8802e',
  accent2: '#8a6a24',
  glow: 'rgba(168,128,46,0.25)',
  frame: '#c4a259',
  navBg: 'rgba(252,248,238,0.7)',
  chipBg: 'rgba(168,128,46,0.10)',
  danger: '#c05a4a',
  success: '#4d9370',
};

/** Шрифты эталона: Cormorant Garamond для «голоса таро», Manrope для интерфейса.
 *  Оба грузятся в app/_layout.tsx. Начертания не синтезируются, поэтому у каждого веса
 *  своё семейство — интерфейсный текст ставить через компонент `Txt`, он сам подберёт. */
export const fonts = {
  display: 'CormorantGaramond_500Medium',
  displaySemi: 'CormorantGaramond_600SemiBold',
  sans: 'Manrope_400Regular',
  sansMedium: 'Manrope_500Medium',
  sansSemi: 'Manrope_600SemiBold',
  sansBold: 'Manrope_700Bold',
  sansExtra: 'Manrope_800ExtraBold',
};

export const spacing = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const radius = { s: 8, m: 12, l: 16, xl: 20, card: 16 } as const;

/** Шампанское золото — одинаково в обеих темах (не зависит от dark/light).
 *  Используется для CTA-кнопок и активных элементов (вкладки, индикаторы). */
export const gold = {
  gradient: ['#caa45a', '#efd9a2', '#caa45a'] as readonly [string, string, string],
  text: '#241c0d', // цвет текста поверх золотой заливки
};
