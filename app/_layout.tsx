import {
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
  useFonts,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '../src/lib/i18n';
import i18n from '../src/lib/i18n';
import { usePushScheduler } from '../src/lib/usePushScheduler';
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
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  usePushScheduler();

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
          options={{
            // шапка системная (нативная кнопка «назад»), но прозрачная: своего заголовка не нужно —
            // название карты уже есть в теле экрана. Подпись кнопки задаётся на самом экране
            // (зависит от источника перехода, см. Stack.Screen внутри card/[id].tsx)
            title: '',
            headerTransparent: true,
            // без явного сброса фон наследуется из screenOptions.headerStyle.backgroundColor выше
            // и рисует непрозрачную полосу поверх контента — это уже случалось
            headerStyle: { backgroundColor: 'transparent' },
            headerShadowVisible: false,
            headerTintColor: t.accent,
            // экран проявляется на месте — «переезд» отыгрывает перелетающая картинка (пункт 6 motion-spec)
            animation: 'fade',
          }}
        />
        {/* заметка к карте дня — модалка: экран ввода не должен уводить с «Сегодня»,
            а свайп вниз читается как «закрыть» (перехватывается на beforeRemove, спека 05) */}
        <Stack.Screen
          name="note/[date]"
          options={{ presentation: 'modal', headerTintColor: t.accent, headerShadowVisible: false }}
        />
      </Stack>
    </>
  );
}
