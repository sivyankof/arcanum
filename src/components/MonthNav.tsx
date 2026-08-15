/** Навигатор месяцев дневника (`.mnav` эталона): «‹ ДНЕВНИК · АВГУСТ 2026 ›».
 *  Листаются только месяцы, где есть записи, — пустых секций в дневнике не бывает
 *  (product-spec §5). Крайняя стрелка гаснет и не нажимается. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { formatMonthTitle } from '../lib/dates';
import { hapticTap } from '../lib/haptics';
import type { Lang } from '../lib/lang';
import { spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

/** Прозрачность недоступной стрелки — из эталона (opacity .35). */
const DIM = 0.35;

function Arrow({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  const t = useTheme();

  return (
    <PressableScale
      disabled={disabled}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={[st.arrow, { borderColor: t.line, opacity: disabled ? DIM : 1 }]}
    >
      <Txt style={[st.arrowTxt, { color: t.accent }]}>{label}</Txt>
    </PressableScale>
  );
}

export function MonthNav({
  month,
  lang,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: {
  month: string; // YYYY-MM
  lang: Lang;
  hasPrev: boolean; // есть месяц старше
  hasNext: boolean; // есть месяц свежее
  onPrev: () => void;
  onNext: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();

  return (
    <View style={st.nav}>
      <Arrow label="‹" disabled={!hasPrev} onPress={onPrev} />
      <Txt style={[st.title, { color: t.muted }]}>
        {`${tr('journal.title')} · ${formatMonthTitle(month, lang)}`.toUpperCase()}
      </Txt>
      <Arrow label="›" disabled={!hasNext} onPress={onNext} />
    </View>
  );
}

const st = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.s,
    marginTop: spacing.xl,
  },
  title: { fontSize: 10, letterSpacing: 3, fontWeight: '700', flex: 1, textAlign: 'center' },
  arrow: { width: 26, height: 26, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  arrowTxt: { fontSize: 12, lineHeight: 14 },
});
