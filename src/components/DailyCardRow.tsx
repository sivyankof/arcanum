/** Компактная строка «Карта дня» на экране «Учёба» (спека 72): миниатюра + две строки + шеврон,
 *  тап ведёт на экран карты дня. Три состояния: не открыта (рубашка), открыта (лицо и имя),
 *  вечером ждёт рефлексия (подстрочник цветом accent). */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { cardImages, type TarotCard } from '../lib/content';
import { inLang, type Lang } from '../lib/lang';
import { fonts } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { moduleBox } from './ModuleHeader';
import { PressableScale } from './PressableScale';
import { StarBack } from './StarBack';
import { Txt } from './Txt';

const THUMB_W = 44;
const THUMB_H = 76;

export function DailyCardRow({
  card,
  reflect,
  lang,
  onPress,
}: {
  /** открытая сегодня карта; null — ещё не открыта */
  card: TarotCard | null;
  /** вечерний вопрос доступен и ещё без ответа */
  reflect: boolean;
  lang: Lang;
  onPress: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const sub = !card ? tr('home.dailyHint') : reflect ? tr('home.dailyReflect') : tr('home.dailyDrawn');
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      style={[st.box, { backgroundColor: t.panel, borderColor: t.line }]}
    >
      <View style={[st.thumb, { borderColor: t.frame }]}>
        {card ? (
          <Image source={cardImages[card.id]} style={st.img} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <StarBack starSize={13} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Txt style={[st.title, { color: t.head }]}>{card ? inLang(card.name, lang) : tr('today.title')}</Txt>
        <Txt style={[st.sub, { color: card && reflect ? t.accent : t.muted }]}>{sub}</Txt>
      </View>
      <Ionicons name="chevron-forward-outline" size={14} color={t.muted} />
    </PressableScale>
  );
}

const st = StyleSheet.create({
  // без собственного отступа сверху: зазор до соседней панели задаёт тот, кто стоит перед строкой
  // (обёртка «Учёбы» — 12, когда ReviewPanel скрыт, либо marginBottom самого ReviewPanel — тоже 12,
  // когда виден). Свой marginTop тут удваивал бы зазор во втором случае (найдено веб-проверкой 72б)
  box: { ...moduleBox },
  thumb: { width: THUMB_W, height: THUMB_H, borderRadius: 11, borderWidth: 1, overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  title: { fontFamily: fonts.displaySemi, fontSize: 20, lineHeight: 26 },
  sub: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
