import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, usePathname } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, useWindowDimensions, View, type ColorValue } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { TabIcon as TabGlyph, type TabIconName } from '../../src/components/TabIcons';
import { hapticTap } from '../../src/lib/haptics';
import { fonts } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';

// порядок вкладок = порядок Tabs.Screen ниже; нужен, чтобы поставить подсветку под активную
const ROUTES: { path: string; icon: TabIconName }[] = [
  { path: '/', icon: 'today' },
  { path: '/course', icon: 'course' },
  { path: '/cards', icon: 'cards' },
  { path: '/spreads', icon: 'spreads' },
  { path: '/profile', icon: 'profile' },
];

const MARK_W = 26; // .nav>div.on::before из эталона: полоска 26×2

/** Иконка таба: при активации подпрыгивает 1 → 1.25 → 1 (пункт 14 motion-spec).
 *  На проп `focused` ориентироваться нельзя: bottom-tabs держит по два экземпляра иконки
 *  (всегда активный и всегда неактивный) и перекрёстно гасит их прозрачностью — у каждого
 *  экземпляра `focused` неизменен. Поэтому прыжок вешаем на смену текущего маршрута. */
function TabIcon({ name, color, focused, path }: { name: TabIconName; color: ColorValue; focused: boolean; path: string }) {
  const t = useTheme();
  const active = usePathname() === path;
  const scale = useSharedValue(1);
  const wasActive = React.useRef(active);

  React.useEffect(() => {
    // прыгаем только на переходе «стал активным», не при запуске приложения
    if (active && !wasActive.current) {
      scale.value = withSequence(
        withTiming(1.25, { duration: 110, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System }),
        withSpring(1, { damping: 11, stiffness: 320, reduceMotion: ReduceMotion.System }),
      );
    }
    wasActive.current = active;
  }, [active, scale]);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    // свечение активной иконки — filter: drop-shadow(0 0 7px var(--glow)) из эталона.
    // На Android elevation дало бы прямоугольную тень под иконкой, поэтому только iOS.
    <Animated.View
      style={[
        anim,
        { opacity: focused ? 1 : 0.85 },
        active && Platform.OS === 'ios' && { shadowColor: t.accent, shadowOpacity: 0.9, shadowRadius: 3.5, shadowOffset: { width: 0, height: 0 } },
      ]}
    >
      <TabGlyph name={name} color={color as string} />
    </Animated.View>
  );
}

/** Фон меню: размытие как `backdrop-filter: blur(18px)` плюс полоска над активной вкладкой. */
function TabBarBackground() {
  const t = useTheme();
  // ширину берём реактивно: при повороте экрана полоска должна переехать вместе с вкладкой
  const { width } = useWindowDimensions();
  const tabW = width / ROUTES.length;
  // хук вызываем строго один раз: внутри колбэка findIndex он давал бы разное число
  // вызовов на разных вкладках, а React требует одинаковое от рендера к рендеру
  const pathname = usePathname();
  const idx = Math.max(0, ROUTES.findIndex((r) => r.path === pathname));

  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView
        intensity={40}
        tint={t.mode === 'dark' ? 'dark' : 'light'}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: t.navBg }]} />
      <LinearGradient
        colors={[`${t.accent}00`, t.accent, `${t.accent}00`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', top: 0, height: 2, width: MARK_W, borderRadius: 2, left: idx * tabW + (tabW - MARK_W) / 2 }}
      />
    </View>
  );
}

function icon(name: TabIconName, path: string) {
  return ({ color, focused }: { color: ColorValue; focused: boolean; size: number }) => (
    <TabIcon name={name} color={color} focused={focused} path={path} />
  );
}

export default function TabLayout() {
  const t = useTheme();
  const { t: tr } = useTranslation();

  return (
    <Tabs
      screenListeners={{ tabPress: () => hapticTap() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarBackground: () => <TabBarBackground />,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent', // фон рисует TabBarBackground, иначе размытие не видно
          borderTopColor: t.line,
        },
        // начертания у Manrope не синтезируются: вместо fontWeight указываем семейство
        tabBarLabelStyle: { fontSize: 10, fontFamily: fonts.sansBold, letterSpacing: 0.3 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: tr('tabs.today'), tabBarIcon: icon('today', '/') }} />
      <Tabs.Screen name="course" options={{ title: tr('tabs.course'), tabBarIcon: icon('course', '/course') }} />
      <Tabs.Screen name="cards" options={{ title: tr('tabs.cards'), tabBarIcon: icon('cards', '/cards') }} />
      <Tabs.Screen name="spreads" options={{ title: tr('tabs.spreads'), tabBarIcon: icon('spreads', '/spreads') }} />
      <Tabs.Screen name="profile" options={{ title: tr('tabs.profile'), tabBarIcon: icon('profile', '/profile') }} />
    </Tabs>
  );
}
