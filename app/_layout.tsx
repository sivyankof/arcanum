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
import { useEffect, useLayoutEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import '../src/lib/i18n';
import i18n from '../src/lib/i18n';
import { useAppActive } from '../src/lib/useAppActive';
import { usePushScheduler } from '../src/lib/usePushScheduler';
import { useApp } from '../src/store/useApp';
import { transparentHeader } from '../src/theme/navHeader';
import { useTheme } from '../src/theme/useTheme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = { initialRouteName: '(tabs)' };

// держим сплэш, пока не загрузятся шрифты
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const t = useTheme();
  const lang = useApp((s) => s.lang);
  // сплэш держится до гидрации persist: иначе у нового пользователя мигнёт «Сегодня»
  // до редиректа на онбординг, а у старого — наоборот (спека 09)
  const [hydrated, setHydrated] = useState(() => useApp.persist.hasHydrated());
  const onboarded = useApp((s) => s.profile.onboarded);
  // Подписываемся ПЕРВЫМ, и только потом перечитываем флаг: `onFinishHydration` зовёт
  // слушателей ровно один раз в момент завершения, опоздавший подписчик не получит ничего.
  // Инициализатор useState закрывает случай «гидрация кончилась до первого рендера», а эта
  // перепроверка — «кончилась между рендером и запуском эффекта». Без неё сплэш завис бы навсегда.
  useEffect(() => {
    const unsubscribe = useApp.persist.onFinishHydration(() => setHydrated(true));
    if (useApp.persist.hasHydrated()) setHydrated(true);
    return unsubscribe;
  }, []);
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
  // смена месяца, пока приложение живёт в фоне: «1-е число» должно наступить и без перезапуска
  // (тот же класс, что час рефлексии в 06а — всё временнóе слушает ещё и AppState)
  useAppActive(() => useApp.getState().syncFreezeGrant());

  // layout-эффект, а не обычный: смена языка i18next с inline-ресурсами синхронна, а setState
  // из layout-эффекта отрабатывает ДО отрисовки кадра — иначе первый кадр после гидрации
  // (и первый экран нерусского новичка) на один кадр показывался бы на языке дефолта стора
  useLayoutEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang]);

  useEffect(() => {
    if (fontsLoaded && hydrated) SplashScreen.hideAsync();
  }, [fontsLoaded, hydrated]);

  if (!fontsLoaded || !hydrated) return null;

  return (
    // жесты RNGH (pinch/pan в просмотре карты, спека 14) требуют корневой обёртки
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={t.mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.head,
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        {/* Онбординг — ПЕРВЫЙ ребёнок Stack. При !onboarded он обязан остаться единственным
            доступным маршрутом: тогда роутер садится на него сам («первый доступный» из
            документации Stack.Protected). Поэтому ВСЕ остальные экраны корневого стека лежат
            под гардом onboarded ниже — включая те, которым свои options здесь не нужны (спека 09) */}
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen
            name="onboarding"
            options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
          />
        </Stack.Protected>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* ⚠️ Экран настроек ОБЯЗАН быть объявлен здесь, хотя своих options ему тут не нужно
              (он ставит их сам внутри app/settings.tsx). Необъявленные файловые маршруты
              expo-router добавляет в навигатор сам — то есть молча мимо обоих гардов: без этой
              строки «Настройки» открывались бы по прямой ссылке до онбординга, а DEV-сброс,
              нажатый на самом экране настроек, никуда бы не уводил. Любой НОВЫЙ маршрут
              корневого стека тоже придётся вписать сюда. */}
          <Stack.Screen name="settings" />
          {/* «О приложении» (спека 12) — тот же гард и та же причина: сама ставит options
              внутри app/about.tsx, но незаявленный маршрут expo-router добавил бы в навигатор
              мимо гардов, и экран открывался бы по прямой ссылке ещё до онбординга */}
          <Stack.Screen name="about" />
          <Stack.Screen
            name="card/[id]"
            options={{
              // шапка системная (нативная кнопка «назад»), но прозрачная: своего заголовка не нужно —
              // название карты уже есть в теле экрана. Подпись кнопки задаётся на самом экране
              // (зависит от источника перехода, см. Stack.Screen внутри card/[id].tsx). Без явного
              // сброса фона он наследовался бы из screenOptions.headerStyle.backgroundColor выше
              // и рисовал непрозрачную полосу поверх контента — это уже случалось
              ...transparentHeader(t),
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
          {/* заглушка урока (спека 07): обычный push с прозрачной шапкой — движок урока (08)
              наполнит экран, маршрут и навигация уже настоящие */}
          <Stack.Screen name="lesson/[id]" options={transparentHeader(t)} />
          {/* просмотр сохранённого расклада (спека 36): корневой стек поверх любого таба, та же
              прозрачная шапка, что у страницы карты; объявлен здесь, чтобы не пройти мимо гарда */}
          <Stack.Screen name="spread/[ts]" options={transparentHeader(t)} />
          {/* тренажёр повторения (спека 45): корневой стек поверх таба «Курс», прозрачная шапка с
              подписью «Курс» на кнопке назад (ставит сам экран); объявлен здесь, чтобы не пройти
              мимо гарда онбординга (урок 09 — незаявленный файловый маршрут роутер добавляет сам) */}
          <Stack.Screen name="review" options={transparentHeader(t)} />
          {/* лунный календарь (спека 47): корневой стек поверх таба «Сегодня», прозрачная шапка
              с подписью «Сегодня» на кнопке назад (ставит сам экран); объявлен здесь, чтобы не
              пройти мимо гарда онбординга (урок 09 — незаявленный файловый маршрут роутер добавляет сам) */}
          <Stack.Screen name="moon" options={transparentHeader(t)} />
          {/* пейвол Premium (спека 53): корневой стек, прозрачная шапка; объявлен здесь, чтобы не
              пройти мимо гарда онбординга (урок 09: незаявленный маршрут роутер добавляет сам) */}
          <Stack.Screen name="paywall" options={transparentHeader(t)} />
        </Stack.Protected>
      </Stack>
    </GestureHandlerRootView>
  );
}
