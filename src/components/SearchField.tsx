/** Поле поиска справочника — `.search` эталона: лупа, ввод, крестик очистки.
 *  Значения (radius 15, паддинг 11×15, шрифт 12.5) — design-system §5 «Панель поиска». */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { hapticTap } from '../lib/haptics';
import { fonts } from '../theme/theme';
import { useTheme } from '../theme/useTheme';

export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  const t = useTheme();

  return (
    <View style={[st.wrap, { backgroundColor: t.panel, borderColor: t.line }]}>
      <Ionicons name="search-outline" size={15} color={t.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        style={[st.input, { color: t.text }]}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        // на вебе рамка фокуса рисуется поверх нашей — она тут лишняя
        // @ts-expect-error outlineStyle — стиль только для react-native-web
        outlineStyle="none"
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => {
            hapticTap();
            onChangeText('');
          }}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Ionicons name="close-circle" size={16} color={t.muted} />
        </Pressable>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  // padding у самого поля нулевой: высоту задаёт обёртка, иначе на Android поле выше макета
  input: { flex: 1, fontFamily: fonts.sans, fontSize: 12.5, padding: 0 },
});
