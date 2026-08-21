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
  navBg: string;       // плотная подложка таб-бара
  glass: string;       // «невидимое стекло» липких панелей: оттенок фона, без линий
  chipBg: string;
  danger: string;
  success: string;
  /** фон чипа МАСТЕР (`.mastery.m4` эталона) — подложка под текст цвета success */
  successBg: string;
}

export const darkTheme: Theme = {
  mode: 'dark',
  bg: '#0e1129',
  bgTop: '#1c2244',
  bgBottom: '#070917',
  ring: '#39426f',
  text: '#e2e6f4',
  head: '#f5eacb',
  // #7e86ab до задачи 50: в верхней, светлой части градиента фона (у «ВАШ ПУТЬ» профиля)
  // пиксельный замер давал 4.38:1 при норме 4.5 — плоский расчёт на bg (5.20) этого не видел.
  // Подбор с запасом по худшей замеренной точке — спека 50.
  muted: '#848cb2',
  line: '#262e56',
  panel: 'rgba(24,30,62,0.55)',
  accent: '#e2bd72',
  accent2: '#f0d9a4',
  glow: 'rgba(226,189,114,0.35)',
  frame: '#8f7439',
  navBg: 'rgba(7,9,23,0.66)',
  glass: 'rgba(12,15,34,0.42)',
  chipBg: 'rgba(226,189,114,0.10)',
  danger: '#e07a6a',
  // #5aa07e до задачи 50: на чипе МАСТЕР (successBg поверх панели поверх градиента) пиксельный
  // замер давал 4.15:1. Тинт successBg остаётся от старого hex — это фон, а не текст (спека 50).
  success: '#63ab89',
  successBg: 'rgba(90,160,126,0.12)',
};

export const lightTheme: Theme = {
  mode: 'light',
  bg: '#f5eeda',
  bgTop: '#fcf8ee',
  bgBottom: '#efe8d2',
  ring: '#d8c89e',
  text: '#3d3d55',
  head: '#4a3a16',
  // #a29878 до задачи 48: на светлом фоне давал 2.48:1 при норме 4.5:1 для текста —
  // мелкие Overline (дни недели календаря, «ВАШ ПУТЬ») почти пропадали. Замер и подбор
  // в спеке 48; тёмная тема не менялась (там 5.20:1).
  muted: '#6f664b',
  line: '#e3d8ba',
  panel: 'rgba(255,255,255,0.66)',
  // #a8802e до задачи 50: золотые чипы (мастерство, аркан рождения) на светлой теме давали
  // 2.84–3.17:1. Подбор по худшей замеренной точке (чип на композите chipBg+панель+градиент,
  // 4.73:1 с запасом); тинты chipBg/glow остаются от старого hex — это фоны/свечения (спека 50).
  accent: '#7c5e20',
  accent2: '#8a6a24',
  glow: 'rgba(168,128,46,0.25)',
  frame: '#c4a259',
  navBg: 'rgba(252,248,238,0.7)',
  glass: 'rgba(250,246,236,0.45)',
  chipBg: 'rgba(168,128,46,0.10)',
  danger: '#c05a4a',
  // #4d9370 до задачи 50: чип МАСТЕР 2.92:1, отметка ✓ дневника 3.46:1 (спека 50)
  success: '#386b51',
  successBg: 'rgba(90,160,126,0.12)',
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
 *  Используется для CTA-кнопок и активных элементов (вкладки, индикаторы).
 *  В эталоне (design-reference.html) это ДВА разных градиента: `.btn` (CTA) — три стопа
 *  с более светлой серединой, `.tabs button.on` (активная вкладка) — плоский переход
 *  из двух стопов. Раньше оба места ошибочно красились одним `gradient`. */
export const gold = {
  gradient: ['#caa45a', '#efd9a2', '#caa45a'] as readonly [string, string, string],
  tabGradient: ['#caa45a', '#e9d095'] as readonly [string, string],
  // узел «текущий» на пути курса: 2 стопа под 140° — ТРЕТИЙ вариант золота эталона,
  // не совпадает ни с CTA (3 стопа), ни с вкладками (второй стоп #e9d095) — спека 07
  nodeGradient: ['#caa45a', '#efd9a2'] as readonly [string, string],
  text: '#241c0d', // цвет текста поверх золотой заливки
  // золото поверх тёмного скрима rgba(0,0,0,.4) — бейджи на картинках (CornerBadge).
  // Цвет на скриме не следует теме: скрим одинаково тёмный в обеих, а тем-зависимый
  // accent2 на светлой теме — тёмное золото, дававшее на скриме 1.35:1 (спека 48)
  onScrim: '#f0d9a4',
};
