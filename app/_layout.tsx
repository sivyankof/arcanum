import {
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
  useFonts,
} from '@expo-google-fonts/cormorant-garamond';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '../src/lib/i18n';
import i18n from '../src/lib/i18n';
import { useApp } from '../src/store/useApp';
import { useTheme } from '../src/theme/useTheme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = { initialRouteName: '(tabs)' };

// держим сплэш, пока не загрузятся шрифты
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const t = useTheme();
  const lang = useApp((s) => s.lang);
  const [fontsLoaded] = useFonts({
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
  });

  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang]);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style={t.mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.head,
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="card/[id]"
          options={{ title: '', headerTransparent: true, headerTintColor: t.accent }}
        />
      </Stack>
    </>
  );
}
