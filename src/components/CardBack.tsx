/** Рубашка карты дня — блоки `.backpat` и `.emb` эталона (docs/design-reference.html).
 *
 *  Градиент поверхности вынесен в `CardBackSurface` (общий с картами расклада, спека 36).
 *
 *  Эмблема-«компас» вынесена сюда не только ради чистоты экрана: тот же рисунок нужен
 *  в онбординге (`.emb2` эталона), дублировать пути не будем. */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { glowShadow } from '../theme/glow';
import { fonts } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { CardBackSurface } from './CardBackSurface';
import { Emblem } from './Emblem';
import { Txt } from './Txt';

const EMB_SIZE = 96; // .emb svg

export function CardBack({ hint }: { hint?: string }) {
  const t = useTheme();

  return (
    <>
      <CardBackSurface />

      <View style={[st.inframe, { borderColor: t.frame }]} />

      <View style={st.emb}>
        {/* свечение эмблемы — эталон `.emb svg`: filter:drop-shadow(0 0 12px var(--glow)),
            то есть по контуру символа, а не по прямоугольнику; boxShadow дал бы квадратную
            тень вокруг прозрачного фона. Висит на отдельной обёртке: рядом с overflow:'hidden'
            тень срезает, поэтому обрезка — только на faceClip */}
        <View style={glowShadow(t.glow, t.accent, 12, 0.35)}>
          <Emblem size={EMB_SIZE} />
        </View>

        <Txt style={[st.word, { color: t.accent }]}>ARCANUM</Txt>

        {!!hint && <Txt style={[st.hint, { color: t.muted }]}>{hint}</Txt>}
      </View>
    </>
  );
}

const st = StyleSheet.create({
  inframe: { position: 'absolute', top: 9, left: 9, right: 9, bottom: 9, borderWidth: 1, borderRadius: 10, opacity: 0.8 },
  // gap 15 — из .emb эталона
  emb: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 15 },
  word: { fontFamily: fonts.display, fontSize: 12, letterSpacing: 7 },
  hint: { fontSize: 8.5, letterSpacing: 2 },
});
