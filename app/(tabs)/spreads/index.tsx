/** Каталог раскладов (product-spec §4): панель `.sp` = мини-схема позиций + имя + описание + PREMIUM.
 *  У лунных раскладов (спека 51) добавлен бейдж события «●/○ СОБЫТИЕ» (полнолуние — рядом с ним
 *  ещё и PREMIUM, спека 53), а вне окна события карточка приглушена и не нажимается — причина
 *  написана на ней самой датой. Доступ к premium-раскладу решает `spreadLocked` (спека 53):
 *  без права — пейвол; лунный гейт окна проверяется ПЕРВЫМ.
 *  Тап — экран расклада во вложенном стеке этого таба (спека 36); «Карта дня» ведёт на «Сегодня». */
import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeUp } from '../../../src/components/FadeUp';
import { PremiumBadge } from '../../../src/components/PremiumBadge';
import { PressableScale } from '../../../src/components/PressableScale';
import { Rule } from '../../../src/components/Rule';
import { ScreenBg } from '../../../src/components/ScreenBg';
import { SpreadDiagram } from '../../../src/components/SpreadDiagram';
import { Txt } from '../../../src/components/Txt';
import { spreads, type Spread } from '../../../src/lib/content';
import { formatDayMonth, localDateISO } from '../../../src/lib/dates';
import { hapticTap } from '../../../src/lib/haptics';
import { useLang } from '../../../src/lib/i18n';
import { inLang } from '../../../src/lib/lang';
import { moonSpreadState } from '../../../src/lib/moonSpread';
import { spreadLocked } from '../../../src/lib/premium';
import { useDevMoonNow } from '../../../src/lib/useDevMoonNow';
import { useAppActive } from '../../../src/lib/useAppActive';
import { useTabTopRef } from '../../../src/lib/useTabScrollToTop';
import { useApp } from '../../../src/store/useApp';
import { fonts, LOCKED_OPACITY, spacing } from '../../../src/theme/theme';
import { useTheme } from '../../../src/theme/useTheme';

export default function SpreadsScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  const scrollRef = useTabTopRef<ScrollView>();

  // «сейчас» — при монтировании и на возврате приложения из фона: таб остаётся смонтированным,
  // поэтому переход через полночь (и, значит, закрытие окна события) иначе не заметить.
  // Тот же приём, что на экране луны и на «Сегодня» (правило 06а).
  const [now, setNow] = React.useState(() => new Date());
  const devNow = useDevMoonNow();
  const premium = useApp((s) => s.premium);
  useAppActive(() => setNow(new Date()));

  const open = (s: Spread, locked: boolean) => {
    if (locked) return; // вне окна карточка не нажимается: причина написана на ней датой
    // Окно могло закрыться, пока таб висел смонтированным (переход через полночь): `now` в
    // сторе экрана обновляется только на возврате из фона, а гейт маршрута берёт время заново —
    // без перепроверки карточка звала бы в закрытый расклад, а маршрут молча редиректил бы назад.
    // ⚠️ Лунный гейт ПЕРВЫЙ: вне окна расклад не играется независимо от подписки (спека 51).
    if (s.moon && !moonSpreadState(s.moon, devNow ?? new Date())?.open) return;
    hapticTap();
    // «Карта дня» раскладом не играется — это ритуал главного экрана (product-spec §4)
    if (s.id === 'card-of-day') {
      router.navigate('/');
      return;
    }
    if (spreadLocked(s, premium)) {
      router.push({ pathname: '/paywall', params: { from: 'spreads' } }); // premium без права — пейвол
      return;
    }
    router.push({ pathname: '/spreads/[id]', params: { id: s.id } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenBg />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingHorizontal: spacing.xl, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <FadeUp index={0}>
          <Txt style={[st.sub, { color: t.muted }]}>{tr('spreads.overline')}</Txt>
          <Txt style={[st.title, { color: t.head }]}>{tr('spreads.title')}</Txt>
          {/* разделитель шапки, как на «Сегодня», «Курсе» и в «Профиле» (макет `v-spreads`,
              аудит 56): без него этот экран был единственным из четырёх, где шапка обрывалась */}
          <Rule />
        </FadeUp>

        {spreads.map((s, si) => {
          const moon = s.moon ? moonSpreadState(s.moon, devNow ?? now) : null;
          const locked = !!s.moon && !moon?.open;
          const desc = locked && moon
            ? tr('moonSpread.opensOn', { date: formatDayMonth(localDateISO(moon.at), lang) })
            : `${tr('spreads.cards', { count: s.cards })} · ${inLang(s.description, lang)}`;
          // доступ решает spreadLocked внутри open(), а не флаг сам по себе (тот же приём, что в ModuleHeader)
          const paid = !s.free; // показ флага
          return (
            <FadeUp key={s.id} index={Math.min(1 + si, 8)}>
              <PressableScale
                onPress={() => open(s, locked)}
                disabled={locked}
                style={[st.item, { backgroundColor: t.panel, borderColor: t.line }, locked && st.dim]}
              >
                <SpreadDiagram spreadId={s.id} />
                <View style={st.tx}>
                  <Txt style={[st.name, { color: t.head }]}>{inLang(s.name, lang)}</Txt>
                  <Txt style={[st.desc, { color: t.muted }]}>{desc}</Txt>
                </View>
                {/* у лунных раскладов бейдж события ДОПОЛНЯЕТСЯ плашкой PREMIUM (полнолуние —
                    принятый макет: «○ СОБЫТИЕ» + «ПРЕМИУМ» рядом), у новолуния (бесплатное)
                    второго бейджа нет. free: false у полнолуния решает ДОСТУП через spreadLocked
                    внутри open() — здесь только показ (product-spec §4). Глиф перед текстом —
                    как в мокапе (design-reference.html): ● новолуние, ○ полнолуние; в перевод
                    не заводим (символ не зависит от языка). */}
                {s.moon ? (
                  <View style={st.badgeRow}>
                    <View style={[st.badge, { borderColor: t.frame, backgroundColor: t.chipBg }]}>
                      <Txt style={{ color: t.accent, fontSize: 8, letterSpacing: 1.2, fontWeight: '700' }}>
                        {s.moon === 'new' ? '● ' : '○ '}
                        {tr('moonSpread.event')}
                      </Txt>
                    </View>
                    {paid && <PremiumBadge style={st.badgeGap} />}
                  </View>
                ) : (
                  paid && <PremiumBadge />
                )}
              </PressableScale>
            </FadeUp>
          );
        })}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  sub: { fontSize: 9.5, letterSpacing: 2.5, textAlign: 'center' },
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 4 },
  // `.sp` эталона: radius 17, паддинг 15×17, отступ 12, ряд gap 14
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 17,
    paddingVertical: 15,
    paddingHorizontal: 17,
    marginTop: 12,
  },
  tx: { flex: 1 },
  name: { fontFamily: fonts.displaySemi, fontSize: 17 }, // `.sp .tx b`
  desc: { fontSize: 10, lineHeight: 15, marginTop: 3 }, // `.sp .tx small`
  badge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  // ⚠️ Флаг 6а-0 (веб-проверка 22.08): в макете «○ СОБЫТИЕ» и «ПРЕМИУМ» стоят В РЯД, но у карточки
  // полнолуния — самое длинное название списка — эта пара занимает 184 px из 356, текстовой колонке
  // остаётся 74 и заголовок рвётся посреди слова («полнолуни»/«я»). Макет ломается там же: бейдж
  // вылезает за правый край карточки, то есть эталоном этой точки он не является. Кладём бейджи
  // столбиком: колонка сужается до ~85 px, и текст получает те же ~155 px, что у любой другой
  // premium-карточки списка. flexShrink: 0 — в RN он по умолчанию 0 только у текста, у контейнера нет.
  badgeRow: { flexShrink: 0, alignItems: 'flex-end' },
  badgeGap: { marginTop: 4 },
  dim: { opacity: LOCKED_OPACITY }, // вне окна события — как прошедшие дни лунного календаря
});
