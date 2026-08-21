/** Экран расклада (спека 36, product-spec §4) — один компонент на два маршрута:
 *  play — app/(tabs)/spreads/[id] (вложенный стек таба: таб-бар виден, черновик = состояние экрана,
 *  ничего не персистится, закрыл приложение — пропал), view — app/spread/[ts] (просмотр сохранённого
 *  из дневника: всё открыто, только чтение). Стадии play: setup (вопрос + CTA «Разложить») → dealt
 *  (открываем тапом в любом порядке) → все открыты (состав + заметка + «Сохранить») → saved
 *  («Сохранено ✓» + «Разложить заново»). Гейт ухода — beforeRemove, как у заметки дня. */
import { router, Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { analyzeSpread, compositionTexts } from '../lib/composition';
import type { Spread } from '../lib/content';
import { formatDayMonth, localDateISO } from '../lib/dates';
import { hapticReveal, hapticSuccess, hapticTap } from '../lib/haptics';
import { useLang } from '../lib/i18n';
import { normalizeNote } from '../lib/journal';
import { inLang } from '../lib/lang';
import { moonSpreadState } from '../lib/moonSpread';
import { dealSpread, drawnCardLabel, normalizeQuestion, spreadMeaningText, type SpreadDraw } from '../lib/spread';
import { isBoard } from '../lib/spreadLayout';
import { useLeaveGuard } from '../lib/useLeaveGuard';
import { useApp } from '../store/useApp';
import { fonts, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { ConfirmDialog } from './ConfirmDialog';
import { CtaButton } from './CtaButton';
import { FadeUp } from './FadeUp';
import { PositionCards } from './PositionCards';
import { Rule } from './Rule';
import { ScreenBg } from './ScreenBg';
import { SpreadBoard } from './SpreadBoard';
import { SpreadCells } from './SpreadCells';
import { NotePanel, QuestionField } from './SpreadFields';
import { MeaningPanel } from './SpreadMeaning';
import { SpreadRow } from './SpreadRow';
import { Txt } from './Txt';

export function SpreadScreen({
  spread,
  mode,
  saved,
}: {
  spread: Spread;
  mode: 'play' | 'view';
  /** сохранённый расклад — только для mode='view' */
  saved?: SpreadDraw;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const saveSpread = useApp((s) => s.saveSpread);

  const view = mode === 'view';
  const n = spread.cards;
  const [question, setQuestion] = React.useState(saved?.question ?? '');
  const [draw, setDraw] = React.useState<SpreadDraw | null>(saved ?? null);
  const [opened, setOpened] = React.useState<boolean[]>(() => (saved ? Array(n).fill(true) : []));
  // порядок открытия: блоки значений на доске идут в нём (макет appendChild); в view — по позициям
  const [order, setOrder] = React.useState<number[]>(() => (saved ? Array.from({ length: n }, (_, i) => i) : []));
  const [note, setNote] = React.useState(saved?.note ?? '');
  const [isSaved, setSaved] = React.useState(view);

  const dealt = draw !== null;
  const openedCount = opened.filter(Boolean).length;
  const allOpen = dealt && openedCount === n;
  // гейт ухода: открыта хотя бы одна карта и расклад не сохранён; setup, ноль открытых, saved — свободно
  const dirty = !view && dealt && openedCount >= 1 && !isSaved;
  // перехватывает кнопку «назад», свайп и popToTop по повторному тапу на таб (спека 36)
  const { asking, onCancel, onConfirm } = useLeaveGuard(dirty);

  const composition = React.useMemo(
    () => (draw && allOpen ? compositionTexts(analyzeSpread(draw.cards), draw.date, lang) : []),
    [draw, allOpen, lang],
  );

  const onDeal = () => {
    hapticReveal();
    setQuestion(normalizeQuestion(question)); // вопрос фиксируется ДО карт — расклад честный
    setDraw({ ts: Date.now(), date: localDateISO(), spreadId: spread.id, cards: dealSpread(n) });
    setOpened(Array(n).fill(false));
    setOrder([]);
  };
  const onOpen = (i: number) => {
    if (opened[i]) return;
    hapticTap();
    setOpened((prev) => prev.map((o, k) => k === i || o));
    // дедуп: два тапа по одной карте в одном тике видят один и тот же opened[i] === false
    // (стейт из замыкания рендера ещё не обновился) — без проверки индекс попал бы в order дважды
    setOrder((prev) => (prev.includes(i) ? prev : [...prev, i]));
  };
  const onCard = (cardId: string) => router.push({ pathname: '/card/[id]', params: { id: cardId, from: 'spread' } });
  const onSave = () => {
    if (!draw || isSaved) return;
    hapticSuccess();
    const q = normalizeQuestion(question);
    const nt = normalizeNote(note);
    saveSpread({ ...draw, ...(q ? { question: q } : {}), ...(nt ? { note: nt } : {}) });
    setSaved(true);
  };
  // «Разложить заново» — чистый лист, включая вопрос (тот же вопрос заново = тасовать до ответа)
  const onAgain = () => {
    hapticTap();
    setDraw(null);
    setOpened([]);
    setOrder([]);
    setQuestion('');
    setNote('');
    setSaved(false);
  };

  // защита от рассинхрона (правка 2, ревью): у сохранённого расклада может быть больше карт,
  // чем позиций в ТЕКУЩЕМ spreads.json, если у расклада однажды поменяют число карт — тихая
  // деградация (пустая строка) лучше падения экрана, из которого нет пути назад (удаления
  // записей дневника нет)
  const positionOf = (i: number) => (spread.positions[i] ? inLang(spread.positions[i], lang) : '');

  const board = isBoard(n);
  // лунный расклад: событие в оверлайне, свой глиф разделителя, своя подпись и перечень позиций
  // до тасования (спека 51). У обычных восьми раскладов spread.moon нет — всё как было.
  const moon = spread.moon ? moonSpreadState(spread.moon) : null;
  const overline = moon
    ? `${tr('moonSpread.event')} · ${tr(`moon.${moon.kind}`)} ${formatDayMonth(localDateISO(moon.at), lang)}`.toUpperCase()
    : [
        tr('spread.overline'),
        tr('spreads.cards', { count: n }).toUpperCase(),
        ...(view && draw ? [formatDayMonth(draw.date, lang).toUpperCase()] : []),
      ].join(' · ');
  // после тасования пустое поле вопроса прячется: писать уже нельзя, показывать нечего
  const showQuestion = !dealt || question.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* headerBackButtonMenuEnabled: false — без него долгий тап по кнопке «назад» на iOS открывает
          системное меню и пускает прыгнуть через несколько экранов сразу мимо гейта useLeaveGuard
          (сама React Navigation советует это в тексте ошибки про usePreventRemove) */}
      <Stack.Screen
        options={{
          headerBackTitle: tr(view ? 'card.backProfile' : 'spreads.title'),
          headerBackButtonMenuEnabled: false,
        }}
      />
      <ScreenBg />
      <ScrollView
        contentContainerStyle={{
          // insets.top + высота прозрачной системной шапки (64), как на странице карты
          paddingTop: insets.top + 64,
          paddingHorizontal: spacing.xl,
          paddingBottom: view ? 60 : 120, // в play под экраном таб-бар
        }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <FadeUp index={0}>
          <Txt style={[st.overline, { color: t.muted }]}>{overline}</Txt>
          <Txt style={[st.title, { color: t.head }]}>{inLang(spread.name, lang)}</Txt>
          <Rule glyph={spread.moon === 'full' ? '○' : spread.moon === 'new' ? '●' : undefined} />
        </FadeUp>

        {!view && (!dealt || board) && (
          <FadeUp index={1}>
            <Txt style={[st.hint, { color: t.muted }]}>
              {spread.moon ? tr(spread.moon === 'new' ? 'moonSpread.hintNew' : 'moonSpread.hintFull') : tr('spread.hint')}
            </Txt>
          </FadeUp>
        )}

        {showQuestion && (
          <FadeUp index={1}>
            <QuestionField value={question} onChange={setQuestion} editable={!dealt} />
          </FadeUp>
        )}

        {!dealt && spread.moon && (
          <FadeUp index={2}>
            <PositionCards spread={spread} />
          </FadeUp>
        )}

        {!dealt && (
          <FadeUp index={2}>
            <CtaButton label={tr('spread.deal')} onPress={onDeal} />
          </FadeUp>
        )}

        {draw && board && (
          <>
            <SpreadBoard
              spread={spread}
              draw={draw}
              opened={opened}
              lang={lang}
              onOpen={onOpen}
              onPressCard={onCard}
              animateFlip={!view}
            />
            {order.map((i) => {
              const c = draw.cards[i];
              // тот же рассинхрон, что и в SpreadBoard (правка 2): в режиме просмотра opened/order
              // заводятся по ТЕКУЩЕМУ spread.cards, а не по длине сохранённого draw.cards.length —
              // пропускаем панель, если старой записи не хватает карт на этот индекс
              if (!c) return null;
              const m = spreadMeaningText(c.cardId, c.reversed, lang, tr);
              return (
                <MeaningPanel
                  key={i}
                  title={`${positionOf(i)} · ${drawnCardLabel(c.cardId, c.reversed, lang, tr)}`.toUpperCase()}
                  paragraphs={[m.text]}
                  todo={m.todo}
                />
              );
            })}
          </>
        )}

        {draw && !board && (
          <>
            <FadeUp index={1}>
              <SpreadCells total={n} opened={opened} />
              {!view && (
                <Txt style={[st.progress, { color: t.muted }]}>
                  {tr('spread.progress', { done: openedCount, total: n })}
                </Txt>
              )}
            </FadeUp>
            {/* строки входят одним блоком: >8 элементов каскадом не оживляем (motion-spec §4) */}
            <FadeUp index={2}>
              {draw.cards.map((c, i) => (
                <SpreadRow
                  key={i}
                  index={i}
                  position={positionOf(i)}
                  card={c}
                  open={!!opened[i]}
                  lang={lang}
                  onOpen={() => onOpen(i)}
                  onPress={() => onCard(c.cardId)}
                />
              ))}
            </FadeUp>
          </>
        )}

        {draw && allOpen && (
          <>
            <MeaningPanel title={tr('spread.composition')} paragraphs={composition} accentBorder style={st.composition} />
            <NotePanel
              value={note}
              onChange={setNote}
              editable={!isSaved}
              showActions={!view}
              saved={isSaved}
              onSave={onSave}
              onAgain={onAgain}
            />
          </>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={asking}
        title={tr('spread.leaveTitle')}
        message={tr('spread.leaveText')}
        confirmLabel={tr('spread.leave')}
        cancelLabel={tr('spread.stay')}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </View>
  );
}

const st = StyleSheet.create({
  overline: { fontSize: 9.5, letterSpacing: 3, textAlign: 'center' }, // `.date`
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 3 }, // `.h2`
  hint: { fontSize: 12, textAlign: 'center', marginTop: 6 },
  progress: { fontSize: 10.5, textAlign: 'center', marginTop: 8 },
  composition: { marginTop: 14 },
});
