/** Карта расклада на доске (`.s3card` эталона, design-system §5): 88×150 (или уменьшенная), radius 10,
 *  бордер frame, тень glow. Рубашка — поверхность CardBackSurface + звезда ✶; лицо — изображение
 *  (перевёрнутая — вверх ногами). Переворот и лечение замыленной грани после него — общий FlipCard
 *  (механика и урок лайв-проверок 36/42 описаны там). В просмотре сохранённого (animateFlip=false)
 *  карта сразу лежит лицом. */
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { cardImages } from '../lib/cardImages';
import { useTheme } from '../theme/useTheme';
import { CardBackSurface } from './CardBackSurface';
import { FlipCard } from './FlipCard';

export function SpreadCard({
  cardId,
  reversed,
  open,
  width,
  height,
  animateFlip = true,
  onPress,
}: {
  cardId: string;
  reversed: boolean;
  open: boolean;
  width: number;
  height: number;
  animateFlip?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <FlipCard
      open={open}
      width={width}
      height={height}
      radius={10}
      shadow={`0px 10px 26px ${t.glow}`}
      animateFlip={animateFlip}
      onPress={onPress}
      back={
        <>
          <CardBackSurface />
          {/* ✶ отсутствует в Manrope — обычный Text без fontFamily (правило Txt.tsx) */}
          <Text style={[st.star, { color: t.accent }]}>✶</Text>
        </>
      }
      front={
        <Image
          source={cardImages[cardId]}
          style={[st.img, reversed && st.reversed]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      }
    />
  );
}

const st = StyleSheet.create({
  star: { fontSize: 20 },
  img: { width: '100%', height: '100%' },
  reversed: { transform: [{ rotate: '180deg' }] },
});
