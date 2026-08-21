/** Панель лунного расклада под строкой события на экране луны — блок `.moonspread` эталона
 *  (спека 51): пунктирная рамка frame на фоне chipBg, слева название расклада, справа
 *  «ОТКРЫТЬ →» либо «ОТКРОЕТСЯ 28 АВГУСТА».
 *
 *  Панель показывается под событием, чьё окно ИДЁТ или ещё ВПЕРЕДИ; под уже прошедшим событием
 *  месяца её нет — расклад к нему недоступен навсегда, а строка события и так приглушена. */
import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { spreads } from '../lib/content';
import { formatDayMonth, localDateISO } from '../lib/dates';
import { hapticTap } from '../lib/haptics';
import { useLang } from '../lib/i18n';
import { inLang } from '../lib/lang';
import type { MoonEventKind } from '../lib/moon';
import { isMoonWindowOpen } from '../lib/moonSpread';
import { fonts } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function MoonSpreadPanel({ kind, at, now }: { kind: MoonEventKind; at: Date; now: Date }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const lang = useLang();

  const spread = spreads.find((s) => s.moon === kind);
  if (!spread) return null;
  const open = isMoonWindowOpen(at, now);

  // Событие прошло И окно закрылось — расклад к нему недоступен навсегда, панели нет.
  // Правило видимости живёт ЗДЕСЬ целиком, а не в экране: иначе экранный гейт и окно
  // разъезжаются, и в последний день окна (сутки ПОСЛЕ события) панель пропадала бы ровно
  // тогда, когда обязана звать «ОТКРЫТЬ».
  if (!open && localDateISO(at) < localDateISO(now)) return null;

  const right = open
    ? tr('moonSpread.open')
    : tr('moonSpread.opensOn', { date: formatDayMonth(localDateISO(at), lang) }).toUpperCase();

  const body = (
    <>
      <Txt style={[st.name, { color: t.head }]}>{inLang(spread.name, lang)}</Txt>
      <Txt style={[st.right, { color: t.accent }]}>{right}</Txt>
    </>
  );
  const box = [st.box, { backgroundColor: t.chipBg, borderColor: t.frame }, !open && st.dim];

  // вне окна панель не нажимается вовсе: причина написана на ней самой датой, качать нечего
  // (у закрытого узла курса иначе — там причина неочевидна, спека 07)
  return open ? (
    <PressableScale
      onPress={() => {
        hapticTap();
        router.push({ pathname: '/spreads/[id]', params: { id: spread.id } });
      }}
      style={box}
    >
      {body}
    </PressableScale>
  ) : (
    <View style={box}>{body}</View>
  );
}

const st = StyleSheet.create({
  // `.moonspread` эталона: пунктир frame, radius 13, паддинг 10×13, отступ 8, ряд gap 10
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 13,
    paddingVertical: 10,
    paddingHorizontal: 13,
    marginTop: 8,
  },
  // сжимаемый текст — flex 1 (в RN flexShrink по умолчанию 0, урок задачи 16)
  name: { flex: 1, fontFamily: fonts.display, fontSize: 13.5 },
  right: { fontSize: 9, letterSpacing: 1.5, fontWeight: '700' },
  dim: { opacity: 0.45 }, // тот же токен приглушения, что у прошедших дней календаря
});
