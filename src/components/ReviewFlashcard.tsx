/** Флеш-карта тренажёра (спека 45, раздел В; `#v-trainer` эталона): карта 190×330 (`.ringwrap`) на
 *  общем FlipCard. Направление toMeaning — лицо с самого начала, переворота нет (open + animateFlip
 *  false): образ и название — вопрос, ответ — панель «ЗНАЧЕНИЕ» у экрана. Направление toCard —
 *  рубашка CardBack, в зоне эмблемы 4 ключевых слова столбиком (`.trkwcol`) + первое предложение
 *  общего значения с ИМЕНЕМ КАРТЫ под маской «···» (maskCardName — иначе подсказка выдавала бы
 *  ответ); тап → 3D-переворот FLIP_MS → лицо. Подпись «ВСПОМНИТЕ … · НАЖМИТЕ», плашка названия,
 *  панель и кнопки — у экрана, здесь только карта. Уголков нет: они — знак ритуала карты дня
 *  (design-system §5). */
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { cardImages } from '../lib/cardImages';
import type { Direction } from '../lib/review';
import { faceShadow } from '../theme/glow';
import { fonts, radius } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { CardBack } from './CardBack';
import { FlipCard } from './FlipCard';
import { KeywordChips } from './KeywordChips';
import { Txt } from './Txt';

// `.ringwrap` тренажёра в эталоне: 190×330 (карта дня — 216×378, масштаб ≈ 0.88)
export const REVIEW_CARD_W = 190;
export const REVIEW_CARD_H = 330;

export function ReviewFlashcard({
  cardId,
  direction,
  revealed,
  keywords,
  hint,
  onPress,
}: {
  cardId: string;
  direction: Direction;
  /** ответ открыт (toCard — переворот сделан) */
  revealed: boolean;
  /** 4 слова витрины — чипами-столбиком на рубашке в направлении toCard, уже на языке интерфейса */
  keywords: readonly string[];
  /** подсказка на рубашке: первое предложение general с замаскированным именем; '' — блок todo,
   *  на рубашке только чипы */
  hint: string;
  onPress: () => void;
}) {
  const t = useTheme();
  const toCard = direction === 'toCard';

  return (
    <FlipCard
      open={toCard ? revealed : true}
      animateFlip={toCard}
      width={REVIEW_CARD_W}
      height={REVIEW_CARD_H}
      radius={radius.card}
      shadow={faceShadow(t.glow)}
      onPress={onPress}
      back={
        // CardBack — фрагмент (поверхность + внутренняя рамка + зона эмблемы flex:1) и ждёт родителя
        // на всю грань с колонкой: грань FlipCard центрирует детей, поэтому подкладываем absoluteFill
        <View style={StyleSheet.absoluteFill}>
          <CardBack
            content={
              // `.trkwcol` эталона: столбик gap 5 по центру, паддинг 0 12; предложение Cormorant 11.5
              <View style={st.words}>
                <KeywordChips words={keywords} layout="column" />
                {!!hint && <Txt style={[st.hint, { color: t.head }]}>{hint}</Txt>}
              </View>
            }
          />
        </View>
      }
      front={<Image source={cardImages[cardId]} style={st.img} contentFit="cover" cachePolicy="memory-disk" />}
    />
  );
}

const st = StyleSheet.create({
  words: { alignItems: 'center', paddingHorizontal: 12 },
  hint: { fontFamily: fonts.display, fontSize: 11.5, lineHeight: 17, textAlign: 'center', marginTop: 8 },
  img: { width: '100%', height: '100%' },
});
