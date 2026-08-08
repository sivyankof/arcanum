import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, usePathname } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { hapticTap } from '../../src/lib/haptics';
import { useTheme } from '../../src/theme/useTheme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Иконка таба: при активации подпрыгивает 1 → 1.25 → 1 (пункт 14 motion-spec).
 *  На проп `focused` ориентироваться нельзя: bottom-tabs держит по два экземпляра иконки
 *  (всегда активный и всегда неактивный) и перекрёстно гасит их прозрачностью — у каждого
 *  экземпляра `focused` неизменен. Поэтому прыжок вешаем на смену текущего маршрута. */
function TabIcon({ name, color, focused, path }: { name: IconName; color: ColorValue; focused: boolean; path: string }) {
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
    <Animated.View style={anim}>
      <Ionicons name={name} size={22} color={color as string} style={{ opacity: focused ? 1 : 0.85 }} />
    </Animated.View>
  );
}

function icon(name: IconName, path: string) {
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
        tabBarStyle: {
          backgroundColor: t.navBg,
          borderTopColor: t.line,
          position: 'absolute',
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: tr('tabs.today'), tabBarIcon: icon('sunny-outline', '/') }} />
      <Tabs.Screen name="course" options={{ title: tr('tabs.course'), tabBarIcon: icon('school-outline', '/course') }} />
      <Tabs.Screen name="cards" options={{ title: tr('tabs.cards'), tabBarIcon: icon('albums-outline', '/cards') }} />
      <Tabs.Screen name="spreads" options={{ title: tr('tabs.spreads'), tabBarIcon: icon('moon-outline', '/spreads') }} />
      <Tabs.Screen name="profile" options={{ title: tr('tabs.profile'), tabBarIcon: icon('person-outline', '/profile') }} />
    </Tabs>
  );
}
