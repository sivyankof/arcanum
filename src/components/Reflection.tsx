/** Вечерняя рефлексия: вопрос и три кнопки (product-spec §1, design-system §5).
 *
 *  Живёт ВНУТРИ того же блока, что и заметка: до 18:00 блок называется «Заметка о дне»
 *  и содержит одну плашку, после 18:00 у него меняется заголовок и над плашкой появляется
 *  этот вопрос. Заметка в записи одна (logic-spec §3), поэтому второй плашки здесь нет —
 *  плашка передаётся блоку снаружи.
 *
 *  После ответа кнопки сворачиваются в строку (как в эталоне), а строка возвращает их обратно:
 *  ответ можно менять до полуночи (logic-spec §3), и в макете этого пути нет — дорисовка 15.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { hapticTap } from '../lib/haptics';
import { OUTCOME_MARK, type Outcome } from '../lib/journal';
import { pickPhrase } from '../lib/phrases';
import { fonts, radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

/** Смена «кнопки ↔ строка ответа» — только прозрачность (motion-spec §4). Высота блока
 *  меняется без анимации: скачущая высота посреди скролла хуже мгновенной смены. */
const SWAP_MS = 180;

const ORDER: Outcome[] = ['yes', 'partly', 'no'];

export function Reflection({
  cardName,
  dateISO,
  lang,
  outcome,
  onAnswer,
}: {
  cardName: string;
  dateISO: string;
  lang: 'ru' | 'en';
  outcome?: Outcome;
  onAnswer: (o: Outcome) => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  // кнопки видны, пока ответа нет; после ответа сворачиваются, тап по строке возвращает
  const [editing, setEditing] = React.useState(!outcome);
  const fade = useSharedValue(1);

  const swap = (next: boolean) => {
    fade.value = 0;
    fade.value = withTiming(1, {
      duration: SWAP_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
    setEditing(next);
  };

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const question = pickPhrase('reflect.question', dateISO, lang, { card: cardName });

  // ответа фактически нет — показываем кнопки, даже если состояние успело переключиться:
  // на стыке суток стор откажется писать ответ, и свёрнутая строка осталась бы пустой
  const showButtons = editing || !outcome;

  return (
    <View>
      <Txt style={[st.question, { color: t.text }]}>{question}</Txt>

      <Animated.View style={fadeStyle}>
        {showButtons ? (
          <View style={st.btns}>
            {ORDER.map((o) => {
              const active = outcome === o;
              return (
                <PressableScale
                  key={o}
                  onPress={() => {
                    hapticTap(); // Success бережём для настоящих побед (серия, урок)
                    onAnswer(o);
                    swap(false);
                  }}
                  style={[
                    st.btn,
                    {
                      borderColor: active ? t.frame : t.line,
                      backgroundColor: active ? t.chipBg : 'transparent',
                    },
                  ]}
                >
                  <Txt style={[st.btnTxt, { color: active ? t.accent : t.text }]}>
                    {tr(`reflect.${o}`)}
                  </Txt>
                </PressableScale>
              );
            })}
          </View>
        ) : (
          <PressableScale
            onPress={() => {
              hapticTap();
              swap(true);
            }}
            style={st.saved}
          >
            <Txt style={[st.savedTxt, { color: t.accent }]}>
              {tr('reflect.saved', {
                answer: outcome ? `${tr(`reflect.${outcome}`)} ${OUTCOME_MARK[outcome]}` : '',
              })}
            </Txt>
            <Txt style={[st.edit, { color: t.accent, borderBottomColor: t.frame }]}>
              {tr('reflect.edit')}
            </Txt>
          </PressableScale>
        )}
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  // `.reflect p` эталона: тот же Cormorant, что у значения дня, но кегль меньше
  question: { fontFamily: fonts.display, fontSize: 14.5, lineHeight: 21, marginTop: 6 },
  // `.rbtns` / `.rb` эталона
  btns: { flexDirection: 'row', gap: 7, marginTop: 10 },
  btn: { flex: 1, borderWidth: 1, borderRadius: radius.m, paddingVertical: 9, paddingHorizontal: 4, alignItems: 'center' },
  btnTxt: { fontSize: 11, textAlign: 'center' },
  // `.done2` эталона + вторая строка-кнопка, которой в макете нет
  saved: { alignItems: 'center', paddingTop: 6, paddingBottom: 2, marginTop: spacing.s },
  savedTxt: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },
  edit: { fontSize: 10.5, marginTop: 3, borderBottomWidth: 1, borderStyle: 'dashed' },
});
