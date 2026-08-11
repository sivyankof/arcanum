/** Экран «Настройки» (product-spec §5): всё утилитарное уехало сюда из профиля, чтобы профиль
 *  остался «путём» — уровень, статистика, дневник. Вход — шестерёнка в правом верхнем углу профиля.
 *  Порядок строк по спеке: Тема · Язык (напоминания, рефлексия, имя, экспорт и «о приложении»
 *  добавят задачи 06, 09, 11, 12). */
import { Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeUp } from '../src/components/FadeUp';
import { ScreenBg } from '../src/components/ScreenBg';
import { SettingsRow } from '../src/components/SettingsRow';
import { useApp } from '../src/store/useApp';
import { spacing } from '../src/theme/theme';
import { useTheme } from '../src/theme/useTheme';

export default function SettingsScreen() {
  const t = useTheme();
  const { t: tr, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = (i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en';

  const themeMode = useApp((s) => s.themeMode);
  const setThemeMode = useApp((s) => s.setThemeMode);
  const setLang = useApp((s) => s.setLang);
  const resetToday = useApp((s) => s.resetToday);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* подпись кнопки «назад» задаём явно: у таб-навигатора нет заголовка, из которого
          система взяла бы её сама, и вместо «Профиль» получилось бы «Back» */}
      <Stack.Screen options={{ title: tr('settings.title'), headerBackTitle: tr('card.backProfile') }} />
      <ScreenBg />
      <ScrollView
        contentContainerStyle={{
          paddingTop: spacing.l,
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + spacing.xxl,
        }}
      >
        <FadeUp index={0}>
          <SettingsRow
            icon={themeMode === 'dark' ? 'moon' : 'sunny'}
            label={tr('settings.theme')}
            value={themeMode === 'dark' ? tr('settings.dark') : tr('settings.light')}
            onPress={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
          />
        </FadeUp>
        <FadeUp index={1}>
          <SettingsRow
            icon="language"
            label={tr('settings.language')}
            value={tr('settings.languageValue')}
            onPress={() => setLang(lang === 'ru' ? 'en' : 'ru')}
          />
        </FadeUp>
        {__DEV__ && (
          <FadeUp index={2}>
            <SettingsRow
              icon="refresh"
              label={tr('settings.resetToday')}
              value="DEV"
              onPress={resetToday}
            />
          </FadeUp>
        )}
      </ScrollView>
    </View>
  );
}
