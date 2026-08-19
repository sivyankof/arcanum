import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Block } from '../../src/components/Block';
import { CardBack } from '../../src/components/CardBack';
import { CardCorners } from '../../src/components/CardCorners';
import { CardLightbox } from '../../src/components/CardLightbox';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { CornerBadge } from '../../src/components/CornerBadge';
import { CtaButton } from '../../src/components/CtaButton';
import { FadeUp } from '../../src/components/FadeUp';
import { MeaningPanel } from '../../src/components/MeaningPanel';
import { MoonRow } from '../../src/components/MoonRow';
import { NotePlate } from '../../src/components/NotePlate';
import { Reflection } from '../../src/components/Reflection';
import { Rule } from '../../src/components/Rule';
import { ScreenBg } from '../../src/components/ScreenBg';
import { Sparks } from '../../src/components/Sparks';
import { StreakPill } from '../../src/components/StreakPill';
import { XpPill } from '../../src/components/XpPill';
import type { Rect } from '../../src/lib/cardTransition';
import { blockText, cardById, cardImages, cardNumeral, cardOfDay } from '../../src/lib/content';
import { daysAgoISO, formatEntryDate, localDateISO } from '../../src/lib/dates';
import { hapticReveal, hapticSuccess } from '../../src/lib/haptics';
import { useLang } from '../../src/lib/i18n';
import type { Outcome } from '../../src/lib/journal';
import { inLang } from '../../src/lib/lang';
import { pingPong, startSpin, sweepLoop } from '../../src/lib/loops';
import { moonInfo } from '../../src/lib/moon';
import { pickPhrase } from '../../src/lib/phrases';
import { requestPermission } from '../../src/lib/pushes';
import { reflectionVisible } from '../../src/lib/reflection';
import { useAppActive } from '../../src/lib/useAppActive';
import { useTabTopRef } from '../../src/lib/useTabScrollToTop';
import { levelFromXp } from '../../src/lib/xp';
import { useApp } from '../../src/store/useApp';
import { faceShadow, GLARE_ANGLE, GLARE_COLORS, GLARE_LOCATIONS } from '../../src/theme/glow';
import { fonts, gold, radius, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';
import { Txt } from '../../src/components/Txt';

const { width: W } = Dimensions.get('window');
const CARD_W = Math.min(W * 0.56, 230);
const CARD_H = CARD_W * 1.72;
const FLIP_MS = 850;
const STREAK_MILESTONE = 7; // 7-й день серии — единственная «победа» на этом экране

// ярлычок «увеличить» на лице карты дня стоит ВНУТРИ правого верхнего уголка (задача 40): инсет 9
// вместо 6/6 остальных мест — уголок 20×20 с инсетом 4 «держит» его с двух сторон
const BADGE_INSET_IN_CORNER = 9;

// пропорции колец из эталона: карта 216 → кольца 330 и 378
const RING_A = CARD_W * 1.53;
const RING_B = CARD_W * 1.75;

// блик по лицу карты (.glare из эталона): ход ±140% ширины, задержка 500 мс, 1100 мс
// (геометрия — GLARE_ANGLE/COLORS/LOCATIONS в theme/glow.ts, общая с CardLightbox).
// Сверх эталона (motion-spec п.7): пока карта открыта, проход повторяется каждые ~7 с
const GLARE_DELAY = 500;
const GLARE_MS = 1100;
const GLARE_PAUSE = 7000;

// салют при перевороте (.spark эталона + stage.onclick): 18 искр, кегль 8–17, разлёт 85–180 px
const SPARK_COUNT = 18;
const SPARK_GLYPHS = ['✦', '✧', '·'];
const SPARK_MS = 1050;
const SPARK_SIZE: [number, number] = [8, 17];
const SPARK_DISTANCE: [number, number] = [85, 180];
const SPARK_JITTER = 0.5; // Math.random()*.5 рад в эталоне

// всплывание текста после переворота (.plate/.mean эталона): 600 мс, задержки 500 и 600 мс
const REVEAL_MS = 600;
const PLATE_DELAY = 500;
const PLATE_SHIFT = 8;
const MEAN_DELAY = 600;
const MEAN_SHIFT = 12;

// кривая CSS-дефолта `ease` — им в эталоне идут и блик, и всплывание текста
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

/** Медленно вращающееся пунктирное кольцо вокруг карты дня (по эталону). */
function Ring({
  size,
  duration,
  reverse,
  opacity,
  star,
  starSize,
}: {
  size: number;
  duration: number;
  reverse?: boolean;
  opacity: number;
  star: string;
  starSize: number;
}) {
  const t = useTheme();
  const angle = useSharedValue(0);

  React.useEffect(() => {
    startSpin(angle, duration);
  }, [angle, duration]);

  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${reverse ? -angle.value : angle.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        {
          pointerEvents: 'none',
          position: 'absolute',
          left: (CARD_W - size) / 2,
          top: (CARD_H - size) / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: t.ring,
          opacity,
        },
        spin,
      ]}
    >
      <Text
        style={{
          position: 'absolute',
          top: -starSize / 2,
          left: '50%',
          marginLeft: -starSize / 2,
          fontSize: starSize,
          color: t.accent,
        }}
      >
        {star}
      </Text>
    </Animated.View>
  );
}

export default function TodayScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLang();

  const streak = useApp((s) => s.streak);
  const freezeSpentDate = useApp((s) => s.freezeSpentDate);
  const xp = useApp((s) => s.xp);
  const lvl = levelFromXp(xp);
  const drawToday = useApp((s) => s.drawToday);
  const drawn = useApp((s) => s.todayDraw());
  const installSeed = useApp((s) => s.installSeed);
  const history = useApp((s) => s.history);
  const setOutcome = useApp((s) => s.setOutcome);
  const reflectionOn = useApp((s) => s.settings.reflectionOn);
  const devReflect = useApp((s) => s.devReflect);
  const pushAsked = useApp((s) => s.settings.pushAsked);
  const setPushAsked = useApp((s) => s.setPushAsked);
  const [preludeOpen, setPreludeOpen] = React.useState(false);
  // таймер прелюдии храним в ref, чтобы снять его при уходе с экрана — иначе висящий колбэк
  // мог бы сработать после размонтирования
  const preludeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (preludeTimer.current) clearTimeout(preludeTimer.current);
    },
    [],
  );
  const scrollRef = useTabTopRef<ScrollView>();

  // полноэкранный просмотр карты дня (спека 14): origin — прямоугольник сцены на момент тапа,
  // sceneRef меряет его через measureInWindow (собственная система координат модалки)
  const sceneRef = React.useRef<View>(null);
  const [lbOrigin, setLbOrigin] = React.useState<Rect | null>(null);
  // M2: id карты фиксируется на момент открытия отдельно от `card` — после полуночи `card`
  // пересчитывается (новая карта дня), и без этого картинка в уже открытом просмотре
  // подменилась бы под пользователем
  const [lbCardId, setLbCardId] = React.useState<string | null>(null);
  // I6: зеркало открытости просмотра для колбэка таймера прелюдии (см. ниже) — стору и
  // ре-рендеру он не нужен, поэтому обычный ref, а не state
  const lbOpenRef = React.useRef(false);

  // час пересчитываем при возврате на таб, а не таймером каждую минуту: сидеть в приложении
  // ровно в 17:59:59 — не тот случай, ради которого стоит держать интервал
  const [hour, setHour] = React.useState(() => new Date().getHours());
  useFocusEffect(React.useCallback(() => setHour(new Date().getHours()), []));

  // возврат из фона фокус экрана не меняет — час обновляем ещё и по AppState (06а)
  useAppActive(() => setHour(new Date().getHours()));

  const showReflection = reflectionVisible({
    drawn: !!drawn,
    hour,
    enabled: reflectionOn,
    devForce: __DEV__ && devReflect,
  });

  const todayISO = localDateISO();
  // анти-повтор карты дня: карты, выпадавшие за последние 7 дней (не считая сегодня)
  const recent = history
    .filter((h) => h.date >= daysAgoISO(7) && h.date !== todayISO)
    .map((h) => h.cardId);
  const card = drawn ? cardById.get(drawn.cardId)! : cardOfDay(todayISO, installSeed, recent);

  // --- анимации ---
  const [burst, setBurst] = React.useState(0); // счётчик салютов у огонька серии
  const [cardBurst, setCardBurst] = React.useState(0); // салют вокруг карты при перевороте
  const flip = useSharedValue(drawn ? 1 : 0);
  // доехал ли переворот (спека 42, приём SpreadCard): после него воркл frontStyle снимает с лица
  // 3D-пропы тем же каналом, которым их наложил. Стартуем «доехавшими», если карта уже открыта:
  // flip=1 без этого держал бы лицо в 3D-контексте с первого кадра — то же мыло, только без
  // анимации перед ним. Убрать стиль недостаточно — reanimated накладывает свойства императивно
  // со стороны UI-потока, и не переданный стиль их не отменяет (лайв-проверка задачи 36)
  const settledSV = useSharedValue(!!drawn);
  const bob = useSharedValue(0);
  const glare = useSharedValue(0);
  // видимость текста под картой. При входе на таб с уже открытой картой стартуем сразу с 1 —
  // всплывание положено только переходу «рубашка → лицо», за вход отвечает каскад FadeUp
  const plateIn = useSharedValue(drawn ? 1 : 0);
  const meanIn = useSharedValue(drawn ? 1 : 0);

  const isDrawn = !!drawn;
  // открытие тапом: переворот и всплывание текста ведёт onDraw, эффекту ниже вмешиваться нельзя —
  // иначе он перебил бы идущий withTiming сразу конечным значением
  const drawnByTap = React.useRef(false);

  // Состояние карты следует за стором (спека 43). Три ветки — та же тройка, что у SpreadCard
  // (задача 36): закрыто → рубашка, открыто с анимацией → её ведёт onDraw, открыто без анимации
  // → сразу конечное состояние. Зависимость — булев isDrawn, а НЕ объект drawn: setOutcome/setNote
  // меняют идентичность сегодняшней записи, и по объекту эффект перезапускался бы при каждом
  // ответе рефлексии; по булеву — только на настоящих переходах
  React.useEffect(() => {
    if (!isDrawn) {
      // сброс карты дня (или смена даты) — возвращаем рубашку и прячем текст
      drawnByTap.current = false; // подвисший флаг не должен пережить сброс (см. ниже)
      flip.value = 0;
      settledSV.value = false; // рубашка снова впереди, лицу вернуть 3D-переворот
      plateIn.value = 0;
      meanIn.value = 0;
      return;
    }
    if (drawnByTap.current) {
      drawnByTap.current = false;
      return;
    }
    // Карта дня появилась в сторе БЕЗ тапа — импорт бэкапа с сегодняшней записью при
    // смонтированном табе (таб «Сегодня» жив, пока настройки открыты поверх него). Ставим сразу
    // конечное состояние без анимации: всплывание положено только переходу «рубашка → лицо»
    // тапом, а вход на таб с уже открытой картой его не играет — см. инициализацию выше.
    // settledSV=true обязателен: иначе лицо осталось бы в 3D-контексте и рисовалось бы через
    // offscreen-текстуру (мыло, спека 42)
    flip.value = 1;
    settledSV.value = true;
    plateIn.value = 1;
    meanIn.value = 1;
  }, [isDrawn, flip, settledSV, plateIn, meanIn]);

  // блик живёт, пока карта открыта: первый проход через 500 мс, дальше цикл с паузой.
  // Держим его в эффекте, а не в onDraw, — иначе при возврате на таб блик бы не запускался.
  // Зависимость — булев isDrawn, а НЕ объект drawn (задача 44): setOutcome/setNote кладут
  // в history новую запись, и по объекту эффект перезапускался бы на каждый ответ рефлексии —
  // идущий блик обрывался бы и через 500 мс шёл заново, вплотную к предыдущему проходу
  React.useEffect(() => {
    glare.value = 0;
    if (!isDrawn) return;
    glare.value = withDelay(GLARE_DELAY, sweepLoop(GLARE_MS, GLARE_PAUSE, EASE));
  }, [isDrawn, glare]);

  // покачивание карты: ход 6 px вверх и обратно, полный цикл 4.2 с (.flip/hov из эталона).
  // Хотфикс дефект 2 (спека 14): на время полноэкранного просмотра остановлено — иначе
  // к посадке копии карты в лайтбоксе источник успевает сместиться покачиванием, и на экране
  // на миг видны две карты со сдвигом. Заморозка ПЕРЕД замером происходит синхронно в onDraw
  // (cancelAnimation до measureInWindow) — если положить её сюда, эффект сработал бы уже
  // ПОСЛЕ замера (React перерисовывает по lbOrigin постфактум), а тут только перезапуск
  React.useEffect(() => {
    if (lbOrigin !== null) {
      cancelAnimation(bob);
      return;
    }
    bob.value = pingPong(-6, 2100);
  }, [lbOrigin, bob]);

  // Рубашка лежит в том же 3D-контексте, что и лицо, — просто на ней это было не видно, пока
  // на ней не появились волосяные линии уголков (задача 40): рубашка стоит на rotateY 0, а слой
  // с perspective всё равно растрируется через offscreen-текстуру. Поэтому в ПОКОЕ (карта ещё
  // не открыта, flip ровно 0) отдаём те же нейтральные значения, что и лицу после переворота.
  // Отдельный флаг не нужен: покой рубашки — это буквально flip.value === 0
  const backStyle = useAnimatedStyle(() => {
    if (flip.value === 0) {
      return { transform: [{ translateY: bob.value }], backfaceVisibility: 'visible' as const };
    }
    return {
      transform: [
        { translateY: bob.value },
        { perspective: 1100 },
        { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` },
      ],
      backfaceVisibility: 'hidden' as const,
    };
  });
  // Стиль отдаётся ВСЕГДА (и до, и после переворота): после settled воркл ЯВНО возвращает
  // нейтральные 3D-пропы вместо того, чтобы пропасть из массива стилей, — иначе perspective/rotateY
  // остаются сиротами на слое, лицо живёт в 3D-контексте и рисуется через offscreen-текстуру (мыло).
  // Покачивание остаётся: 2D-сдвиг 3D-контекст не создаёт. Скачка нет: на flip=1 rotateY стоит
  // на 360°, что визуально identity
  const frontStyle = useAnimatedStyle(() => {
    if (settledSV.value) {
      return { transform: [{ translateY: bob.value }], backfaceVisibility: 'visible' as const };
    }
    return {
      transform: [
        { translateY: bob.value },
        { perspective: 1100 },
        { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` },
      ],
      backfaceVisibility: 'hidden' as const,
    };
  });
  const glareStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(glare.value, [0, 1], [-CARD_W * 1.4, CARD_W * 1.4]) }],
  }));
  const plateStyle = useAnimatedStyle(() => ({
    opacity: plateIn.value,
    transform: [{ translateY: (1 - plateIn.value) * PLATE_SHIFT }],
  }));
  const meanStyle = useAnimatedStyle(() => ({
    opacity: meanIn.value,
    transform: [{ translateY: (1 - meanIn.value) * MEAN_SHIFT }],
  }));

  const reveal = (delay: number) =>
    withDelay(delay, withTiming(1, { duration: REVEAL_MS, easing: EASE, reduceMotion: ReduceMotion.System }));

  const onDraw = () => {
    if (drawn) {
      // карта уже открыта — тап берёт её «в руки» (спека 14; до переворота тап открывает карту дня)
      // хотфикс дефект 2: парение замирает СНАЧАЛА, замер — ПОТОМ (тот же приём, что у героя
      // страницы карты) — иначе к посадке копии в лайтбоксе источник успеет сместиться
      // покачиванием (см. эффект по lbOrigin ниже)
      cancelAnimation(bob);
      sceneRef.current?.measureInWindow((x, y, w, h) => {
        lbOpenRef.current = true; // I6
        setLbCardId(card.id); // M2: фиксируем id на момент открытия
        setLbOrigin({ x, y, w, h });
      });
      return;
    }
    const prevStreak = streak;
    hapticReveal();
    settledSV.value = false;
    flip.value = withTiming(1, { duration: FLIP_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) settledSV.value = true; // UI-поток: воркл frontStyle тут же снимает 3D-пропы
    });
    plateIn.value = reveal(PLATE_DELAY);
    meanIn.value = reveal(MEAN_DELAY);
    setCardBurst((b) => b + 1); // искры — в момент нажатия, вместе с хаптикой
    // флаг ДО записи в стор: эффект по isDrawn сработает на появление записи и не должен
    // перебить только что запущенную анимацию конечным значением (спека 43)
    drawnByTap.current = true;
    drawToday(card.id, false);
    const newStreak = useApp.getState().streak;
    // серия выросла — салют у огонька, но только вместе с открытием карты
    if (newStreak > prevStreak) setTimeout(() => setBurst((b) => b + 1), FLIP_MS * 0.7);
    // Success бережём для настоящих побед: 7-й день серии (и позже — завершённый урок)
    if (newStreak === STREAK_MILESTONE) setTimeout(hapticSuccess, FLIP_MS);

    // прелюдия — только один раз за всё время и только после того, как карта уже открылась:
    // системный диалог даётся однажды навсегда, и показывать его на пустом экране — значит
    // потерять согласие безвозвратно (product-spec §1). Флаг перечитываем из стора в момент
    // срабатывания таймера, а не полагаемся на значение, захваченное при планировании: если
    // карту дня успели сбросить (DEV) и вытянуть заново, пока первый таймер ещё ждал, второй
    // не должен переоткрыть уже отвеченную прелюдию
    if (!pushAsked) {
      // I6: если пользователь уже открыл полноэкранный просмотр повторным тапом, показывать
      // прелюдию нельзя — второй Modal поверх первого (на iOS системный диалог поверх второй
      // модалки может вовсе не показаться, а переспросить получится только завтра). Пока
      // просмотр открыт, перевзводим таймер каждые 1500мс и ждём, пока его закроют
      const tryShowPrelude = () => {
        if (!useApp.getState().settings.pushAsked) {
          if (lbOpenRef.current) {
            preludeTimer.current = setTimeout(tryShowPrelude, 1500);
          } else {
            setPreludeOpen(true);
          }
        }
      };
      preludeTimer.current = setTimeout(tryShowPrelude, FLIP_MS + 600);
    }
  };

  const { text: dayText, todo: dayTodo } = blockText(card.content.day_card, lang);
  const hasText = !dayTodo;

  const now = new Date();
  // «Пятница · 1 августа» — та же сборка, что строка записи дневника (formatEntryDate, weekday long);
  // регистр — в стиле .date
  const dateStr = formatEntryDate(localDateISO(now), lang, 'long');

  // фаза луны считается локально от текущего момента (logic-spec §6)
  const moon = moonInfo(now);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenBg />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: 120, paddingHorizontal: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <FadeUp index={0}>
          <Txt style={[st.date, { color: t.muted }]}>{dateStr.toUpperCase()}</Txt>
          <Txt style={[st.title, { color: t.head }]}>{tr('today.title')}</Txt>
          <Rule />
        </FadeUp>

        {/* строка луны — общий MoonRow (спека 47), тап ведёт в лунный календарь */}
        <FadeUp index={1}>
          <MoonRow phase={moon.phase} day={moon.day} onPress={() => router.push('/moon')} />
        </FadeUp>

        {/* ряд пилюль (.pills эталона): серия слева, уровень справа и чуть шире */}
        <FadeUp index={2} style={st.pills}>
          <StreakPill streak={streak} burst={burst} style={st.pillStreak} />
          <XpPill level={lvl.level} progress={lvl.progress} style={st.pillXp} />
        </FadeUp>

        {/* строка «серию спасла заморозка» — весь день спасения (спека 10, решение 1).
            Отдельный FadeUp с ТЕМ ЖЕ индексом, что у пилюль: появляются вместе, а внутрь
            st.pills строку не положить — тот контейнер горизонтальный */}
        {freezeSpentDate === todayISO && (
          <FadeUp index={2} style={st.freezeRow}>
            <Ionicons name="snow" size={12} color={t.accent} />
            <Txt style={[st.freezeText, { color: t.muted }]}>
              {pickPhrase('freeze.saved', todayISO, lang)}
            </Txt>
          </FadeUp>
        )}

        {/* сцена с картой */}
        <FadeUp index={3}>
        <Pressable onPress={onDraw} style={{ alignSelf: 'center', marginTop: spacing.xl }}>
          <View ref={sceneRef} collapsable={false} style={{ width: CARD_W, height: CARD_H }}>
            {/* кольца позади карты — на время просмотра НЕ прячутся (хотфикс дефект 2) */}
            <Ring size={RING_A} duration={70000} opacity={0.55} star="✦" starSize={8} />
            <Ring size={RING_B} duration={100000} reverse opacity={0.3} star="✧" starSize={6} />
            {/* обе грани карты прячутся на время полноэкранного просмотра — копия летит
                в лайтбоксе, живой источник (застывший, см. cancelAnimation выше) в это время
                виден быть не должен (хотфикс дефект 2, спека 14) */}
            <View style={[StyleSheet.absoluteFill, lbOrigin !== null && st.hidden]}>
              {/* рубашка. Тень живёт на внешней View: на iOS overflow:'hidden' срезает собственную тень */}
              <Animated.View style={[st.face, backStyle, { boxShadow: faceShadow(t.glow), backgroundColor: t.bg }]}>
                <View style={[st.faceClip, { borderColor: t.frame }]}>
                  <CardBack corners hint={drawn ? undefined : tr('today.tapToReveal')} />
                </View>
              </Animated.View>
              {/* лицо */}
              <Animated.View style={[st.face, frontStyle, { boxShadow: faceShadow(t.glow), backgroundColor: t.bg }]}>
                <View style={[st.faceClip, { borderColor: t.frame }]}>
                  <Image source={cardImages[card.id]} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" />
                  {/* блик: проходит по лицу карты сразу после переворота */}
                  <Animated.View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }, glareStyle]}>
                    <LinearGradient
                      colors={GLARE_COLORS}
                      locations={GLARE_LOCATIONS}
                      start={GLARE_ANGLE.start}
                      end={GLARE_ANGLE.end}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>
                  {/* уголки — поверх картинки и блика, под ярлычком (порядок слоёв .cnr → .st2 эталона) */}
                  <CardCorners />
                  {/* ярлычок «можно увеличить» (спека 39) — поверх блика, чтобы скрим
                      не «зажигался». Условие по drawn не нужно: до переворота грань
                      повёрнута на 180° с backfaceVisibility hidden и не видна.
                      Инсет 9/9 — внутри уголка (задача 40) */}
                  <CornerBadge icon="expand-outline" style={st.badgeInCorner} />
                </View>
              </Animated.View>
            </View>
          </View>
          {/* салют поверх сцены; внутри Sparks стоит pointerEvents none, нажатию не мешает */}
          <Sparks
            burst={cardBurst}
            count={SPARK_COUNT}
            glyphs={SPARK_GLYPHS}
            size={SPARK_SIZE}
            distance={SPARK_DISTANCE}
            duration={SPARK_MS}
            angleJitter={SPARK_JITTER}
            style={st.sparkLayer}
          />
        </Pressable>
        </FadeUp>

        {drawn && (
          <>
            <Animated.View style={plateStyle}>
              <Txt style={[st.cardName, { color: t.head }]}>{inLang(card.name, lang).toUpperCase()}</Txt>
              <Txt style={[st.cardSub, { color: t.muted }]}>
                {cardNumeral(card)} ·{' '}
                {card.arcana === 'major' ? tr('card.majorArcana') : tr('card.minorArcana')}
              </Txt>
            </Animated.View>
            {/* кнопка живёт внутри блока значения — как .cta внутри .mean в эталоне */}
            <Animated.View style={meanStyle}>
              <MeaningPanel title={tr('today.meaning')}>
                <Txt style={[st.meanTxt, { color: t.text }]}>
                  {hasText ? dayText : tr('card.soon')}
                </Txt>
                <CtaButton
                  label={tr('today.continue')}
                  onPress={() => router.push(`/card/${card.id}?from=today`)}
                />
              </MeaningPanel>
              {/* один блок на весь вечерний ритуал: до 18:00 это «Заметка о дне» с плашкой,
                  после — тот же блок с вопросом и кнопками над той же плашкой (спека 06а) */}
              <Block title={showReflection ? tr('reflect.title') : tr('note.title')}>
                {showReflection && (
                  <Reflection
                    cardName={inLang(card.name, lang)}
                    dateISO={todayISO}
                    lang={lang}
                    outcome={drawn?.outcome}
                    onAnswer={(o: Outcome) => setOutcome(todayISO, o)}
                  />
                )}
                <NotePlate
                  note={drawn?.note}
                  onPress={() => router.push({ pathname: '/note/[date]', params: { date: todayISO } })}
                />
              </Block>
            </Animated.View>
          </>
        )}
      </ScrollView>
      <ConfirmDialog
        visible={preludeOpen}
        title={tr('push.preludeTitle')}
        message={tr('push.preludeText')}
        confirmLabel={tr('push.preludeYes')}
        cancelLabel={tr('push.preludeNo')}
        confirmTone="accent"
        onConfirm={() => {
          setPreludeOpen(false);
          // флаг ставим ПОСЛЕ ответа ОС, а не до: `setPushAsked()` меняет объект `settings`,
          // а это единственное, что заставляет планировщик пересчитаться заново (см. комментарий
          // у зависимостей эффекта в usePushScheduler.ts). Если менять флаг раньше диалога, эффект
          // сработает, пока разрешение ещё 'undetermined', снимет всё и ничего не поставит — а
          // когда человек нажмёт «Разрешить», результат promise уже некому подхватить: ни одна
          // зависимость эффекта не поменяется. Итог был бы такой: сегодняшний вечерний и завтрашний
          // утренний пуш появляются только после следующего перезапуска приложения (найдено
          // финальным ревью 06б).
          // catch обязателен: разрешение может бросить (та же оговорка, что в usePushScheduler.ts),
          // а без него — необработанный reject в микротаске. pushAsked всё равно ставим в finally —
          // иначе прелюдия будет всплывать заново при каждом следующем открытии карты дня
          requestPermission()
            .catch((err) => {
              console.warn('[today] не удалось запросить разрешение на пуши:', err);
            })
            .finally(() => setPushAsked());
        }}
        onCancel={() => {
          // «Не сейчас» и промах мимо панели — одно и то же: больше не спрашиваем,
          // выключить или включить напоминания можно в настройках
          setPushAsked();
          setPreludeOpen(false);
        }}
      />
      <CardLightbox
        cardId={lbCardId ?? card.id}
        origin={lbOrigin}
        onClose={() => {
          lbOpenRef.current = false; // I6
          setLbOrigin(null);
          setLbCardId(null);
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  // хотфикс дефект 2: прячет живые грани карты дня на время полноэкранного просмотра
  hidden: { opacity: 0 },
  date: { fontSize: 9.5, letterSpacing: 3.5, textAlign: 'center' },
  title: { fontFamily: fonts.display, fontSize: 30, textAlign: 'center', marginTop: 4 },
  pills: { flexDirection: 'row', gap: 10, marginTop: 14 },
  pillStreak: { flex: 1 },
  pillXp: { flex: 1.5 },
  // по образцу строки луны: по центру, muted; макета для строки нет — расхождение осознанное (спека 10)
  freezeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  freezeText: { fontSize: 12 },
  // тёплое свечение вокруг карты дня — значение в faceShadow (theme/glow.ts),
  // задаётся инлайн через boxShadow, т.к. зависит от темы
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.card,
  },
  faceClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  badgeInCorner: { top: BADGE_INSET_IN_CORNER, right: BADGE_INSET_IN_CORNER },
  // искры уводим над картой: на Android грани карты подняты elevation, иначе салют уйдёт под них
  sparkLayer: { zIndex: 2, elevation: 20 },
  cardName: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 3, textAlign: 'center', marginTop: spacing.xl },
  cardSub: { fontSize: 9.5, letterSpacing: 2.5, textAlign: 'center', marginTop: 3 },
  meanTxt: { fontFamily: fonts.display, fontSize: 17, lineHeight: 25, marginTop: 8 },
  // тень кнопки из эталона `.btn`: box-shadow 0 12px 30px var(--glow) — задаётся инлайн
  // (boxShadow зависит от темы, см. JSX выше). overflow тут ставить нельзя — срежет тень;
  // обрезка живёт в ctaClip. Подложка под форму (нужна была старым shadow*-пропам) — не нужна
  cta: {
    marginTop: 14,
    borderRadius: radius.l,
  },
  ctaClip: { borderRadius: radius.l, overflow: 'hidden' },
  ctaGrad: { paddingVertical: 15, alignItems: 'center' },
  ctaGloss: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.5)' },
  ctaTxt: { color: gold.text, fontWeight: '800', fontSize: 13, letterSpacing: 1.5 },
});
