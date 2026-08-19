/** Строка позиции в ленте 7–10 карт (`.ccrow` эталона, design-system §5): мини-карта 34×56 +
 *  «N · ПОЗИЦИЯ» + (закрытая) «Нажмите, чтобы открыть» / (открытая) имя, ключевые слова и — решение
 *  брейншторма 36 — абзац значения под рядом на всю ширину панели. Тап по закрытой открывает,
 *  по открытой ведёт на страницу карты. Подмена содержимого при открытии — fade 250 мс. */
import { Image } from 'expo-image';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { cardImages } from '../lib/cardImages';
import { cardById } from '../lib/content';
import { inLang, type Lang } from '../lib/lang';
import { drawnCardLabel, spreadMeaningText, type DrawnCard } from '../lib/spread';
import { fonts } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { StarBack } from './StarBack';
import { Txt } from './Txt';

export function SpreadRow({
  index,
  position,
  card,
  open,
  lang,
  onOpen,
  onPress,
}: {
  index: number;
  position: string;
  card: DrawnCard;
  open: boolean;
  lang: Lang;
  onOpen: () => void;
  onPress: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const data = cardById.get(card.cardId);
  const shownName = drawnCardLabel(card.cardId, card.reversed, lang, tr);
  const keywords = data ? inLang(data.keywords, lang).join(' · ') : '';
  const meaning = spreadMeaningText(card.cardId, card.reversed, lang, tr);

  const v = useSharedValue(1);
  React.useEffect(() => {
    if (!open) return;
    v.value = 0;
    v.value = withTiming(1, { duration: 250 });
  }, [open, v]);
  const fade = useAnimatedStyle(() => ({ opacity: v.value }));

  return (
    <PressableScale onPress={open ? onPress : onOpen} style={[st.row, { backgroundColor: t.panel, borderColor: t.line }]}>
      <Animated.View style={fade}>
        <View style={st.line}>
          <View style={[st.thumb, { borderColor: t.frame }]}>
            {open ? (
              <Image source={cardImages[card.cardId]} style={[st.img, card.reversed && st.rev]} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <StarBack starSize={13} />
            )}
          </View>
          <View style={st.texts}>
            <Txt style={[st.pos, { color: t.accent }]}>{`${index + 1} · ${position.toUpperCase()}`}</Txt>
            {open ? (
              <>
                <Txt style={[st.name, { color: t.head }]}>{shownName}</Txt>
                {!!keywords && <Txt style={[st.keys, { color: t.muted }]}>{keywords}</Txt>}
              </>
            ) : (
              <Txt style={[st.closed, { color: t.muted }]}>{tr('spread.tapToOpen')}</Txt>
            )}
          </View>
        </View>
        {open && (
          <Txt style={[st.meaning, { color: meaning.todo ? t.muted : t.text }, meaning.todo && st.todo]}>
            {meaning.text}
          </Txt>
        )}
      </Animated.View>
    </PressableScale>
  );
}

const st = StyleSheet.create({
  row: { borderWidth: 1, borderRadius: 13, paddingVertical: 10, paddingHorizontal: 12, marginTop: 8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  thumb: { width: 34, height: 56, borderRadius: 5, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '100%' },
  rev: { transform: [{ rotate: '180deg' }] },
  texts: { flex: 1 },
  pos: { fontSize: 8.5, letterSpacing: 1.8 },
  name: { fontFamily: fonts.display, fontSize: 15, marginTop: 1 },
  keys: { fontSize: 10.5, marginTop: 2 },
  closed: { fontSize: 12, marginTop: 1 },
  meaning: { fontFamily: fonts.display, fontSize: 13.5, lineHeight: 21, marginTop: 8 },
  todo: { fontStyle: 'italic' },
});
