/** Карточка уровня в профиле — класс `.lvlcard` эталона: «Уровень N · Титул» + «X / Y XP»
 *  и XP-полоса. Полоса и подпись согласованы: доля = xp / порог следующего уровня
 *  (спека 16, решение 2 — у XpPill на «Сегодня» шкала «внутри уровня», это осознанно разное).
 *  Заполнение один раз при монтировании (эталон fill2: 1.4s, задержка .4s) — возврат на таб
 *  полосу не переигрывает, как у XpPill. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { ReduceMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { levelFromXp, levelTitleKey, nextLevelXp } from '../lib/xp';
import { fonts, radius } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PROGRESS_EASE, ProgressBar } from './ProgressBar';
import { Txt } from './Txt';

const FILL_DELAY = 400; // эталон fill2: задержка .4s
const FILL_MS = 1400; // эталон fill2: ход 1.4s

export function LevelCard({ xp }: { xp: number }) {
  const t = useTheme();
  const { t: tr } = useTranslation();

  const { level } = levelFromXp(xp);
  const next = nextLevelXp(level);

  const fill = useSharedValue(0);
  React.useEffect(() => {
    fill.value = withDelay(
      FILL_DELAY,
      withTiming(xp / next, { duration: FILL_MS, easing: PROGRESS_EASE, reduceMotion: ReduceMotion.System }),
    );
  }, [fill, xp, next]);

  return (
    <View style={[st.card, { backgroundColor: t.panel, borderColor: t.line }]}>
      <View style={st.row}>
        <Txt style={[st.name, { color: t.head }]}>
          {tr('level.line', { n: level, title: tr(levelTitleKey(level)) })}
        </Txt>
        <Txt style={[st.xp, { color: t.muted }]}>{tr('profile.xpOf', { xp, next })}</Txt>
      </View>
      <ProgressBar progress={fill} radius={4} style={st.track} />
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.l - 1, // 15 — как `.lvlcard`
    paddingVertical: 13,
    paddingHorizontal: 15,
    marginTop: 14,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  name: { fontFamily: fonts.displaySemi, fontSize: 16 }, // `.lt b`: serif 16 w600
  xp: { fontSize: 10, fontWeight: '700' }, // `.lt small`
  track: { height: 7, marginTop: 8 }, // `.lvlbar`
});
