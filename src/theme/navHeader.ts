/** Опции нативной шапки: прозрачная, без заголовка, кнопки тона accent.
 *
 *  Общая часть для страницы карты, урока и обоих маршрутов расклада (play в `spreads/_layout.tsx`,
 *  view в `_layout.tsx`) — своего заголовка ни одному из них не нужно, имя уже есть в теле экрана.
 *  Экраны, которым сверх этого нужно что-то своё (у страницы карты — переход `animation: 'fade'`,
 *  у play-маршрута расклада — `headerShown: true`, потому что родительский Stack прячет шапку
 *  по умолчанию), доливают поле поверх результата в самом вызове.
 */
import { spacing, type Theme } from './theme';

export function transparentHeader(t: Theme) {
  return {
    title: '',
    headerTransparent: true,
    headerStyle: { backgroundColor: 'transparent' as const },
    headerShadowVisible: false,
    headerTintColor: t.accent,
  };
}

/** Высота системной шапки стек-экрана. Контент под ПРОЗРАЧНОЙ шапкой начинается с этого отступа,
 *  иначе уезжает под кнопку «назад». До задачи 72 число 64 стояло копиями в пяти экранах. */
export const STACK_HEADER_H = 64;

/** paddingTop контента стек-экрана с прозрачной шапкой: safe area + шапка + воздух. */
export function stackTopPad(insets: { top: number }, gap: number = spacing.l): number {
  return insets.top + STACK_HEADER_H + gap;
}
