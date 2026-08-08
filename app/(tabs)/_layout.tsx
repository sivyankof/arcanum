import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
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

/** Иконка таба: при активации подпрыгивает 1 → 1.25 → 1 (пункт 14 motion-spec). */
function TabIcon({ name, color, focused }: { name: IconName; color: ColorValue; focused: boolean }) {
  const scale = useSharedValue(1);
  const mounted = React.useRef(false);

  React.useEffect(() => {
    // на первом рендере таб уже активен — прыгать не с чего
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!focused) return;
    scale.value = withSequence(
      withTiming(1.25, { duration: 110, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System }),
      withSpring(1, { damping: 11, stiffness: 320, reduceMotion: ReduceMotion.System }),
    );
  }, [focused, scale]);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={anim}>
      <Ionicons name={name} size={22} color={color as string} style={{ opacity: focused ? 1 : 0.85 }} />
    </Animated.View>
  );
}

function icon(name: IconName) {
  return ({ color, focused }: { color: ColorValue; focused: boolean; size: number }) => (
    <TabIcon name={name} color={color} focused={focused} />
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
      <Tabs.Screen name="index" options={{ title: tr('tabs.today'), tabBarIcon: icon('sunny-outline') }} />
      <Tabs.Screen name="course" options={{ title: tr('tabs.course'), tabBarIcon: icon('school-outline') }} />
      <Tabs.Screen name="cards" options={{ title: tr('tabs.cards'), tabBarIcon: icon('albums-outline') }} />
      <Tabs.Screen name="spreads" options={{ title: tr('tabs.spreads'), tabBarIcon: icon('moon-outline') }} />
      <Tabs.Screen name="profile" options={{ title: tr('tabs.profile'), tabBarIcon: icon('person-outline') }} />
    </Tabs>
  );
}
