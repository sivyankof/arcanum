/** Тренажёр повторения (спека 45, раздел В; product-spec §2 «Тренажёр»; logic-spec §12).
 *  Сессия ≤10 карт собирается один раз при монтировании (buildSession), очередь — состояние экрана;
 *  каждая оценка сразу уходит в стор (reviewCard → applyReview), поэтому «назад» без подтверждения.
 *  Две грани вопроса: toMeaning — лицо + название, панель «ЗНАЧЕНИЕ» скрыта до тапа; toCard —
 *  рубашка со словами, тап → переворот. Три кнопки оценки (Light-хаптика у всех — «не помню» не
 *  ошибка), «не помню» возвращает карту в хвост (applyGrade), счётчик = длина очереди и при «не
 *  помню» не уменьшается. Результат — ReviewResult с «Ещё N» (новая порция на том же экране).
 *  Пустые состояния — EmptyState (design-system §7): колода пуста / очередь на сегодня пуста. */
import { router, Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CtaButton } from '../src/components/CtaButton';
import { EmptyState } from '../src/components/EmptyState';
import { FadeUp } from '../src/components/FadeUp';
import { FLIP_MS } from '../src/components/FlipCard';
import { KeywordChips } from '../src/components/KeywordChips';
import { MeaningPanel } from '../src/components/MeaningPanel';
import { PressableScale } from '../src/components/PressableScale';
import { ReviewFlashcard } from '../src/components/ReviewFlashcard';
import { ReviewResult } from '../src/components/ReviewResult';
import { Rule } from '../src/components/Rule';
import { ScreenBg } from '../src/components/ScreenBg';
import { Txt } from '../src/components/Txt';
import { blockText, cardById, course } from '../src/lib/content';
import { localDateISO } from '../src/lib/dates';
import { hapticTap } from '../src/lib/haptics';
import { useLang } from '../src/lib/i18n';
import { inLang, presentLang } from '../src/lib/lang';
import { reviewLimitReached } from '../src/lib/premium';
import {
  applyGrade,
  buildSession,
  deckOrder,
  maskCardName,
  nextSessionSize,
  promptSentence,
  reviewSummary,
  sessionStats,
  type ReviewLogEntry,
  type SessionItem,
} from '../src/lib/review';
import type { SrsGrade } from '../src/lib/srs';
import { useBackHaptic } from '../src/lib/useBackHaptic';
import { useApp } from '../src/store/useApp';
import { fonts, spacing } from '../src/theme/theme';
import { useTheme } from '../src/theme/useTheme';

// проявление плашки/панели после ответа — как пояснение викторины (350 мс)
const REVEAL_MS = 350;

/** Три кнопки оценки слева направо: danger / text / success (design-system §5). Оценки 1 «с трудом»
 *  в UI v1 нет (спека 45) — тип SrsGrade её допускает под будущий режим-викторину. */
const GRADES: { grade: SrsGrade; key: string; tone: 'danger' | 'text' | 'success' }[] = [
  { grade: 0, key: 'review.gradeForgot', tone: 'danger' },
  { grade: 2, key: 'review.gradeGood', tone: 'text' },
  { grade: 3, key: 'review.gradeEasy', tone: 'success' },
];

export default function ReviewScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  // вибрация на уходе с экрана — общий хук (как урок и страница карты)
  useBackHaptic();

  const lessonsProgress = useApp((s) => s.lessonsProgress);
  const srs = useApp((s) => s.srs);
  const reviewDay = useApp((s) => s.reviewDay);
  const reviewCard = useApp((s) => s.reviewCard);
  const premium = useApp((s) => s.premium);

  const deck = React.useMemo(() => deckOrder(course, lessonsProgress), [lessonsProgress]);
  const today = localDateISO();
  // дневной лимит бесплатного тренажёра (спека 53): SESSION_MAX карт/день без Premium
  const limitReached = reviewLimitReached(reviewDay, today, premium);

  // Сессия строится один раз при монтировании — ленивый useState, как шаги урока (app/lesson/[id]):
  // пересборка посреди сессии перетасовала бы очередь. «Ещё N» собирает новую порцию из АКТУАЛЬНОГО
  // стора (getState), не из значений в замыкании. Лимит исчерпан — сессия не строится вовсе,
  // иначе открылась бы 11-я карта в обход гейта
  const [queue, setQueue] = React.useState<SessionItem[]>(() =>
    limitReached ? [] : buildSession(deck, srs, today, reviewDay, Math.random),
  );
  // счётчик показанных карт — ключ флеш-карты. cardId в ключе не годится: после «не помню» в очереди
  // из одной карты та же карта идёт следом, и без нового ключа FlipCard остался бы открытым — ответ
  // показался бы до вопроса
  const [step, setStep] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);
  const [log, setLog] = React.useState<ReviewLogEntry[]>([]);
  const [gained, setGained] = React.useState(0);
  const scrollRef = React.useRef<ScrollView>(null);

  // защита от двойного тапа по кнопке оценки до перерисовки (busy-guard, как у экспорта/импорта):
  // второй тап по старой очереди оценил бы ту же карту дважды и сдвинул бы очередь мимо головы.
  // Снимается эффектом ПОСЛЕ коммита следующего шага, а не в том же обработчике
  const busy = React.useRef(false);
  React.useEffect(() => {
    busy.current = false;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  // проявление плашки и панели «ЗНАЧЕНИЕ»: toMeaning — сразу, toCard — после переворота (FLIP_MS)
  const reveal = useSharedValue(0);
  // toCard: панель «ЗНАЧЕНИЕ» монтируется сразу и проявляется с задержкой на FLIP_MS — пока
  // прозрачность 0, слой не должен ловить тап (иначе промах пальцем оценит карту, которую ещё не
  // видно). pointerEvents ВНУТРИ стиля, не пропом (правило проекта)
  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    pointerEvents: reveal.value === 0 ? ('none' as const) : ('auto' as const),
  }));

  const head = queue[0];
  const card = head ? cardById.get(head.cardId) : undefined;
  const keywords = card ? inLang(card.keywords, lang) : [];
  const name = card ? inLang(card.name, lang) : '';
  // первое предложение общего значения через blockText: при todo — только чипы (keywords у всех 78
  // вычитаны, «Текст готовится» на флеш-карте не бывает). На рубашке toCard — с именем под маской
  // «···» (первое предложение general у всех карт начинается с имени — иначе вопрос выдавал бы
  // ответ), в панели «ЗНАЧЕНИЕ» после ответа — целиком
  const meaning = card ? blockText(card.content.general, lang) : { text: '', todo: true };
  const sentence = meaning.todo ? '' : promptSentence(meaning.text);
  // маска берёт имя НА ЯЗЫКЕ ПОКАЗАННОГО ТЕКСТА (presentLang), а не языка интерфейса: name и текст
  // general переводятся РАЗНЫМИ единицами (wordsStatus у слов, статус блока — отдельно, спека 28а),
  // и у каждой inLang падает на английский независимо от другой. Испанское имя без испанского
  // general (или наоборот) не совпало бы по языку с текстом — маска не нашла бы вхождение, и
  // рубашка-вопрос напечатала бы ответ прямо под чипами. Плашка с именем (она — ОТВЕТ, не подсказка)
  // языка показанного текста не спрашивает и остаётся на языке интерфейса — см. `name` выше
  const maskName = card ? inLang(card.name, presentLang(card.content.general, lang)) : '';
  const backHint = sentence ? maskCardName(sentence, maskName) : '';

  const onReveal = () => {
    if (!head || revealed) return;
    hapticTap();
    setRevealed(true);
    reveal.value = withDelay(
      head.direction === 'toCard' ? FLIP_MS : 0,
      withTiming(1, { duration: REVEAL_MS, reduceMotion: ReduceMotion.System }),
    );
  };

  const onGrade = (grade: SrsGrade) => {
    if (!head || busy.current) return;
    busy.current = true;
    hapticTap(); // Light у всех трёх: самооценка «не помню» — не ошибка (спека 45)
    // стор — ВНЕ функционального setState: апдейтер в dev может отработать дважды (StrictMode)
    const r = reviewCard(head.cardId, grade);
    setGained((g) => g + r);
    setLog((l) => [...l, { cardId: head.cardId, grade }]);
    setQueue(applyGrade(queue, grade).queue);
    setRevealed(false);
    reveal.value = 0;
    setStep((s) => s + 1);
  };

  // «Ещё N»: новая порция из актуального стора на том же экране. Тот же busy-guard, что у оценки —
  // двойной тап в одном кадре иначе пересобрал бы порцию дважды. Лимит перечитывается из СВЕЖЕГО
  // стора (getState), не из замыкания — иначе право, выданное на пейволе, не подхватилось бы без
  // перемонтирования экрана
  const onMore = () => {
    if (busy.current) return;
    if (reviewLimitReached(useApp.getState().reviewDay, localDateISO(), useApp.getState().premium)) {
      router.push({ pathname: '/paywall', params: { from: 'review' } });
      return;
    }
    busy.current = true;
    const s = useApp.getState();
    const next = buildSession(deck, s.srs, localDateISO(), s.reviewDay, Math.random);
    if (next.length === 0) {
      busy.current = false;
      return;
    }
    setQueue(next);
    setLog([]);
    setGained(0);
    setRevealed(false);
    reveal.value = 0;
    setStep((n) => n + 1);
  };

  const sum = reviewSummary(deck, srs, today, reviewDay);
  // нечего повторять с самого входа ИЛИ карта из очереди не нашлась в справочнике (рассинхрон
  // колоды и cards.json — недостижимо при исправном контенте, стережёт контракт-тест курса, но
  // без страховки экран остался бы пустым: ветка ниже рисуется только когда head И card есть оба)
  const cardMissing = !!head && !card;
  // лимит исчерпан с порога — это НЕ «нечего повторять» (колода не пуста, очередь просто не
  // собрана гейтом), поэтому исключён из empty и добавлен в result: панель итога с нулём карт
  // и запертой «Ещё N» вместо EmptyState
  const empty = (!head && log.length === 0 && !limitReached) || cardMissing;
  const result = !head && (log.length > 0 || limitReached); // очередь кончилась или лимит — итог
  const stats = sessionStats(log);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerBackTitle: tr('tabs.course') }} />
      <ScreenBg />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          // как урок и страница карты: insets.top + высота системной шапки, иначе контент уедет под неё
          paddingTop: insets.top + 64 + spacing.l,
          paddingHorizontal: spacing.xl,
          paddingBottom: 120,
        }}
      >
        <FadeUp index={0}>
          <Txt style={[st.overline, { color: t.muted }]}>{tr('review.overline')}</Txt>
          <Txt style={[st.title, { color: t.head }]}>{tr('review.title')}</Txt>
          <Rule />
        </FadeUp>

        {empty && (
          <FadeUp index={1} style={{ marginTop: spacing.xl }}>
            <EmptyState
              // карта не нашлась в справочнике — это НЕ «всё повторено» (колода не пуста и ничего
              // не повторено); текст пустой колоды нейтрален и ситуации не противоречит
              text={
                deck.length === 0 || cardMissing
                  ? tr('review.emptyDeck')
                  : tr('review.allDone', { n: sum.dueTomorrow })
              }
            />
            <CtaButton label={tr('review.toCourse')} onPress={() => router.back()} />
          </FadeUp>
        )}

        {result && (
          <ReviewResult
            gained={gained}
            cards={stats.cards}
            firstTry={stats.firstTry}
            more={nextSessionSize(sum)}
            moreLocked={limitReached}
            onDone={() => router.back()}
            onMore={onMore}
          />
        )}

        {head && card && (
          <FadeUp index={1}>
            <Txt style={[st.count, { color: t.muted }]}>{tr('review.queue', { n: queue.length })}</Txt>
            <View style={st.cardWrap}>
              <ReviewFlashcard
                key={step}
                cardId={card.id}
                direction={head.direction}
                revealed={revealed}
                keywords={keywords}
                hint={backHint}
                onPress={onReveal}
              />
            </View>

            {/* подпись «ВСПОМНИТЕ … · НАЖМИТЕ» — под картой в ОБОИХ направлениях (`.trhint` эталона),
                тапается наравне с картой. После ответа гаснет, но место держит — иначе плашка и панель
                подпрыгнули бы на её высоту ровно в момент проявления панели */}
            <Pressable onPress={onReveal} hitSlop={8} disabled={revealed} style={revealed && st.hidden}>
              <Txt style={[st.hint, { color: t.muted }]}>
                {tr(head.direction === 'toCard' ? 'review.hintCard' : 'review.hintMeaning')}
              </Txt>
            </Pressable>

            {/* toMeaning: название — часть вопроса, видно сразу */}
            {head.direction === 'toMeaning' && (
              <Txt style={[st.plate, { color: t.head }]}>{name.toUpperCase()}</Txt>
            )}

            {revealed && (
              <Animated.View style={revealStyle}>
                {/* toCard: название — ответ, появляется вместе с панелью после переворота */}
                {head.direction === 'toCard' && (
                  <Txt style={[st.plate, { color: t.head }]}>{name.toUpperCase()}</Txt>
                )}
                <MeaningPanel title={tr('review.meaning')} style={{ marginTop: spacing.m }}>
                  <KeywordChips words={keywords} style={{ marginTop: 10, justifyContent: 'center' }} />
                  {!!sentence && <Txt style={[st.sentence, { color: t.text }]}>{sentence}</Txt>}
                  <Pressable onPress={() => router.push(`/card/${card.id}?from=review`)} hitSlop={8}>
                    <Txt style={[st.link, { color: t.accent }]}>{tr('review.cardPage')}</Txt>
                  </Pressable>
                  <View style={st.grades}>
                    {GRADES.map((g) => (
                      <PressableScale
                        key={g.grade}
                        onPress={() => onGrade(g.grade)}
                        style={[st.grade, { borderColor: t.line }]}
                      >
                        <Txt style={[st.gradeTxt, { color: t[g.tone] }]}>{tr(g.key)}</Txt>
                      </PressableScale>
                    ))}
                  </View>
                </MeaningPanel>
              </Animated.View>
            )}
          </FadeUp>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  // значения — CSS `#v-trainer` эталона (коммит макета 9a33503): .date/.h2/.tcount/.ringwrap/.trhint/
  // .plate/.mean/.trlink/.gradebtns
  overline: { fontSize: 9.5, letterSpacing: 3.5, textAlign: 'center' }, // .date
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 3 }, // .h2
  count: { fontSize: 10, letterSpacing: 2, textAlign: 'center', marginTop: 10 }, // .tcount
  cardWrap: { alignSelf: 'center', marginTop: 14 }, // .ringwrap margin-top 14
  hint: { fontSize: 9, letterSpacing: 2, textAlign: 'center', marginTop: 10 }, // .trhint
  hidden: { opacity: 0 },
  plate: { fontFamily: fonts.display, fontSize: 17, letterSpacing: 3, textAlign: 'center', marginTop: 6 }, // .plate b 17/ls3, отступ 6
  sentence: { fontFamily: fonts.display, fontSize: 14.5, lineHeight: 22, marginTop: 10 }, // #trtext
  link: { fontSize: 10.5, letterSpacing: 1, textAlign: 'center', marginTop: 10 }, // .trlink — веса эталон не задаёт
  // .gradebtns: ряд gap 6, отступ 14; кнопка — бордер line, radius 12, паддинг 9×2, 10/700
  grades: { flexDirection: 'row', gap: 6, marginTop: 14 },
  grade: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 2, alignItems: 'center' },
  gradeTxt: { fontSize: 10, fontWeight: '700' },
});
