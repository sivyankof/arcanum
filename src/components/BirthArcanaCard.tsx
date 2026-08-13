/** Карточка аркана рождения в профиле — класс `.barc` эталона: мини-карта со свечением,
 *  Overline «АРКАН РОЖДЕНИЯ», «римский номер · название»; тап → страница карты.
 *  Дата рождения не указана (пропущена в онбординге) — пунктирное приглашение по паттерну
 *  NotePlate: тап открывает пикер даты, выбор пишет дату в профиль (setBirthDate), и карточка
 *  тут же становится обычной. Пустого состояния в макете нет — осознанная дорисовка
 *  (спека 16, решение 4). */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { cardImages } from '../lib/cardImages';
import { cardById, cardNumeral } from '../lib/content';
import { hapticTap } from '../lib/haptics';
import { useApp } from '../store/useApp';
import { fonts, radius } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { DatePicker } from './DatePicker';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function BirthArcanaCard({ lang }: { lang: 'ru' | 'en' }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const arcanaId = useApp((s) => s.profile.birthArcanaId);
  const setBirthDate = useApp((s) => s.setBirthDate);
  const [picking, setPicking] = React.useState(false);

  const card = arcanaId ? cardById.get(arcanaId) : undefined;

  if (!card) {
    return (
      <>
        <PressableScale
          onPress={() => {
            hapticTap();
            setPicking(true);
          }}
          style={[st.card, st.invite, { borderColor: t.line }]}
        >
          <View style={st.texts}>
            <Txt style={[st.overline, { color: t.accent }]}>{tr('profile.arcana')}</Txt>
            <Txt style={[st.cta, { color: t.text }]}>{tr('profile.arcanaCta')}</Txt>
          </View>
        </PressableScale>
        <DatePicker
          visible={picking}
          value={null}
          title={tr('profile.arcanaCta')}
          onPick={setBirthDate}
          onClose={() => setPicking(false)}
        />
      </>
    );
  }

  return (
    <PressableScale
      onPress={() => {
        hapticTap();
        router.push({ pathname: '/card/[id]', params: { id: card.id, from: 'profile' } });
      }}
      style={[st.card, { backgroundColor: t.panel, borderColor: t.frame }]}
    >
      {/* свечение — box-shadow по прямоугольнику (правило теней): слой тени отдельно от clip,
          как у HeroImage страницы карты */}
      <View style={[st.imShadow, { boxShadow: `0px 6px 18px ${t.glow}`, backgroundColor: t.bg }]}>
        <View style={[st.imClip, { borderColor: t.frame }]}>
          <Image source={cardImages[card.id]} style={st.im} contentFit="cover" cachePolicy="memory-disk" />
        </View>
      </View>
      <View style={st.texts}>
        <Txt style={[st.overline, { color: t.accent }]}>{tr('profile.arcana')}</Txt>
        <Txt style={[st.name, { color: t.head }]}>{`${cardNumeral(card)} · ${card.name[lang]}`}</Txt>
      </View>
    </PressableScale>
  );
}

const st = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: radius.l - 1, // 15 — как `.barc`
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 14,
  },
  // приглашение: пунктир = «можно заполнить» (паттерн NotePlate), без фона и изображения
  invite: { borderStyle: 'dashed' },
  imShadow: { borderRadius: 6 },
  imClip: { width: 44, height: 71, borderWidth: 1, borderRadius: 6, overflow: 'hidden' },
  im: { width: '100%', height: '100%' },
  // без flex:1 текстовый блок не сжимается (в RN дефолт flexShrink:0, не как в CSS) и вылезает
  // за карточку при длинном названии аркана / крупном системном шрифте — как MonthCard/JournalRow
  texts: { flex: 1 },
  overline: { fontSize: 8.5, letterSpacing: 2 }, // `.bt small`
  name: { fontFamily: fonts.display, fontSize: 17, marginTop: 1 }, // `.bt b`: serif 17 w500
  cta: { fontSize: 13, marginTop: 2 },
});
