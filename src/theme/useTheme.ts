import { useColorScheme } from 'react-native';
import { useApp } from '../store/useApp';
import { resolveMode } from './resolveMode';
import { darkTheme, lightTheme, type Theme } from './theme';

export function useTheme(): Theme {
  const mode = useApp((s) => s.themeMode);
  const scheme = useColorScheme();
  return resolveMode(mode, scheme) === 'dark' ? darkTheme : lightTheme;
}
