import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { spreadById } from '../../../src/lib/content';
import { useTheme } from '../../../src/theme/useTheme';

export default function SpreadPlayRoute() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!spreadById.get(id ?? '')) return <Redirect href="/spreads" />;
  return <View style={{ flex: 1, backgroundColor: t.bg }} />;
}
