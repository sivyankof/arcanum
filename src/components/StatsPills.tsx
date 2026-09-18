/** Ряд «серия + уровень» и строка «серию спасла заморозка» (`.pills` эталона). Вынесен задачей 72:
 *  ряд стоит на «Учёбе» и на экране карты дня. `burst` — счётчик салютов огонька: его ведёт экран
 *  карты дня из onDraw, «Учёба» салют не играет. */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet } from 'react-native';
import { localDateISO } from '../lib/dates';
import { useLang } from '../lib/i18n';
import { pickPhrase } from '../lib/phrases';
import { levelFromXp } from '../lib/xp';
import { useApp } from '../store/useApp';
import { useTheme } from '../theme/useTheme';
import { FadeUp } from './FadeUp';
import { StreakPill } from './StreakPill';
import { Txt } from './Txt';
import { XpPill } from './XpPill';

export function StatsPills({ index, burst = 0 }: { index: number; burst?: number }) {
  const t = useTheme();
  const lang = useLang();
  const streak = useApp((s) => s.streak);
  const freezeSpentDate = useApp((s) => s.freezeSpentDate);
  const lvl = levelFromXp(useApp((s) => s.xp));
  const todayISO = localDateISO();
  return (
    <>
      <FadeUp index={index} style={st.pills}>
        <StreakPill streak={streak} burst={burst} style={st.pillStreak} />
        <XpPill level={lvl.level} progress={lvl.progress} style={st.pillXp} />
      </FadeUp>
      {/* весь день спасения (спека 10); тот же индекс каскада — появляется вместе с пилюлями */}
      {freezeSpentDate === todayISO && (
        <FadeUp index={index} style={st.freezeRow}>
          <Ionicons name="snow" size={12} color={t.accent} />
          <Txt style={[st.freezeText, { color: t.muted }]}>{pickPhrase('freeze.saved', todayISO, lang)}</Txt>
        </FadeUp>
      )}
    </>
  );
}

const st = StyleSheet.create({
  pills: { flexDirection: 'row', gap: 10, marginTop: 14 },
  pillStreak: { flex: 1 },
  pillXp: { flex: 1.5 },
  freezeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  freezeText: { fontSize: 12 },
});
