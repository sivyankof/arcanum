import { useApp } from '../store/useApp';
import { darkTheme, lightTheme, type Theme } from './theme';

export function useTheme(): Theme {
  const mode = useApp((s) => s.themeMode);
  return mode === 'dark' ? darkTheme : lightTheme;
}
