import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';
import { useTheme } from '../../src/theme/useTheme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName) {
  return ({ color, focused }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={name} size={22} color={color as string} style={{ opacity: focused ? 1 : 0.85 }} />
  );
}

export default function TabLayout() {
  const t = useTheme();
  const { t: tr } = useTranslation();

  return (
    <Tabs
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
