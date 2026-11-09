import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ResolvedMode, ThemeMode } from './theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Какая из двух тем рисуется. Выбранная вручную не слушает телефон;
 * «как в системе» следует схеме устройства, а при неизвестной схеме — тёмная.
 * Единственное место, где режим сравнивается с литералом 'system'.
 */
export function resolveMode(mode: ThemeMode, scheme: string | null | undefined): ResolvedMode {
  if (mode === 'system') return scheme === 'light' ? 'light' : 'dark';
  return mode;
}

/** ключ строки i18n для подписи режима (настройки, письмо обратной связи) */
export const THEME_LABEL_KEY: Record<ThemeMode, string> = {
  dark: 'settings.dark',
  light: 'settings.light',
  system: 'settings.system',
};

export const THEME_ICON: Record<ThemeMode, IconName> = {
  dark: 'moon',
  light: 'sunny',
  system: 'contrast-outline',
};
