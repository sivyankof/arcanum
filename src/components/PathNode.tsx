/** Узел пути курса (спека 07, эталон .node из #v-course). Три состояния:
 *  done — контур success с галочкой; current — золотая заливка с пульс-кольцом и чипом
 *  «НАЧАТЬ УРОК»; locked — контур line с замком, тап качает замок (motion-spec №13)
 *  и отвечает предупреждающей вибрацией. Размеры — макет ×1.147 (рама макета ~340px
 *  против реальных 390), сведены в design-system.md, раздел «Узел пути».
 *
 *  Заливка current рисуется сиблингом ПОД кругом с бордером, а не фоном круга:
 *  дети в RN рисуются поверх бордера родителя и золото закрасило бы рамку frame. */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import type { LessonState } from '../lib/courseProgress';
import { hapticWarning } from '../lib/haptics';
import { gold } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

/** Диаметр круга узла — по нему CoursePath переводит центры в left/top. */
export const NODE_SIZE = 76;
const ICON = 28;
const RING_INSET = -10; // пульс-кольцо на 10px шире узла с каждой стороны
const LABEL_W = 132; // подпись до двух строк (в макете nowrap — в RN он бы обрезался)
const CHIP_W = 150; // обёртка чипа: шире узла, иначе «НАЧАТЬ УРОК» не помещается в одну строку
const SHAKE_STEP_MS = 58; // качание замка: ±8°, три раза, ~350мс (motion-spec №13)

/** Иконки состояний — пути из эталона (блок course path в design-reference.html). */
function NodeIcon({ state, color }: { state: LessonState; color: string }) {
  const common = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      {state === 'done' && <Path d="m4.5 12.5 5 5 10-11" {...common} />}
      {state === 'current' && (
        <Path
          d="M12 3.5 14.4 9l5.9.6-4.4 3.9 1.3 5.8L12 16.2l-5.2 3.1 1.3-5.8L3.7 9.6 9.6 9z"
          {...common}
        />
      )}
      {state === 'locked' && (
        <>
          <Rect x={5.5} y={10.5} width={13} height={9} rx={2} {...common} />
          <Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" {...common} />
        </>
      )}
    </Svg>
  );
}

export function PathNode({
  state,
  title,
  chipLabel,
  chipLocked,
  onPress,
}: {
  state: LessonState;
  title: string;
  /** подпись чипа над текущим узлом — приходит снаружи, узел про i18n не знает */
  chipLabel: string;
  /** узел «current», но модуль заперт подпиской (спека 53) — чип рисуется по `.premchip`
   *  эталона: мельче «НАЧАТЬ УРОК» и без боба, потому что это не приглашение, а причина замка */
  chipLocked?: boolean;
  onPress?: () => void;
}) {
  const t = useTheme();

  const pulse = useSharedValue(0); // цикл пульс-кольца, 0..1
  const bob = useSharedValue(0); // вертикальный боб чипа, px
  const shake = useSharedValue(0); // качание замка, доли от ±8°

  React.useEffect(() => {
    if (state !== 'current') return;
    // keyframes pulse эталона: 70% цикла (1260мс) кольцо растёт и гаснет с ease-out,
    // оставшиеся 30% (540мс) — пауза, где pulse.value стоит на 1 и кольцо не видно.
    // Драйвер разбит на две стадии явно (как bob ниже) — единый эйзженный withTiming(1800мс)
    // с делением postfactum на 0.7 в ringStyle давал не те пропорции: ease-out нелинеен по
    // времени, поэтому 0.7 от ЗНАЧЕНИЯ достигается заметно раньше 70% от ВРЕМЕНИ.
    pulse.value = 0;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1260, easing: Easing.out(Easing.ease), reduceMotion: ReduceMotion.System }),
        withTiming(1, { duration: 540, easing: Easing.linear, reduceMotion: ReduceMotion.System }),
      ),
      -1,
    );
    // боб — только у приглашения «НАЧАТЬ УРОК»; чип-причина «✦ ПРЕМИУМ» (.premchip эталона)
    // неподвижен, поэтому при chipLocked анимацию не запускаем и держим bob на 0
    if (chipLocked) {
      cancelAnimation(bob);
      bob.value = 0;
    } else {
      // keyframes bob2: ±5px за 2s
      bob.value = withRepeat(
        withSequence(
          withTiming(-5, { duration: 1000, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.System }),
          withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.System }),
        ),
        -1,
      );
    }
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(bob);
    };
  }, [state, chipLocked, pulse, bob]);

  // качание замка живёт у заблокированного узла, поэтому отменяется отдельно от пульса и боба:
  // эффект выше выходит рано при state !== 'current' и до shake вообще не доходит
  React.useEffect(() => () => cancelAnimation(shake), [shake]);

  // pulse.value сам идёт 0→1 ровно на отрезке роста (1260мс) и держится на 1 всю паузу
  // (540мс) — деление на долю цикла больше не нужно, граница стадий уже в драйвере выше.
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.9 * (1 - pulse.value),
    transform: [{ scale: 0.82 + 0.32 * pulse.value }],
  }));
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${shake.value * 8}deg` }] }));

  const onNodePress = () => {
    if (state !== 'locked') {
      onPress?.();
      return;
    }
    hapticWarning();
    const step = (to: number) =>
      withTiming(to, { duration: SHAKE_STEP_MS, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System });
    shake.value = withSequence(step(1), step(-1), step(1), step(-1), step(1), step(0));
  };

  const iconColor = state === 'current' ? gold.text : state === 'done' ? t.success : t.muted;
  const borderColor = state === 'current' ? t.frame : state === 'done' ? t.success : t.line;

  return (
    <View style={st.node}>
      {state === 'current' && (
        <Animated.View style={[st.ring, { borderColor: t.accent, pointerEvents: 'none' }, ringStyle]} />
      )}
      <PressableScale
        onPress={onNodePress}
        // прозрачность заблокированного — поверх контурного стиля (product-spec §2 + макет,
        // компромисс из раздела «Расхождения» спеки 07); подпись остаётся плотной, как в макете
        style={[st.hit, state === 'locked' && { opacity: 0.55 }]}
      >
        {state === 'current' && (
          <LinearGradient
            colors={gold.nodeGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.75, y: 1 }} // ≈140° макета
            style={[st.fill, { boxShadow: `0 10px 24px ${t.glow}` }]}
          />
        )}
        <View style={[st.circle, { borderColor }]}>
          <Animated.View style={state === 'locked' ? shakeStyle : undefined}>
            <NodeIcon state={state} color={iconColor} />
          </Animated.View>
        </View>
      </PressableScale>
      {state === 'current' && (
        <Animated.View style={[st.chipWrap, bobStyle]}>
          <View
            style={[
              st.chip,
              { backgroundColor: t.panel, borderColor: t.frame },
              chipLocked && st.chipPrem,
            ]}
          >
            <Txt style={[st.chipText, { color: t.accent }, chipLocked && st.chipTextPrem]}>{chipLabel}</Txt>
            <View
              style={[
                st.chipTail,
                { backgroundColor: t.panel, borderColor: t.frame },
                chipLocked && st.chipTailPrem,
              ]}
            />
          </View>
        </Animated.View>
      )}
      <View style={st.labelWrap}>
        <Txt
          numberOfLines={2}
          style={[st.label, { color: state === 'current' ? t.head : t.muted }]}
        >
          {title}
        </Txt>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  node: { width: NODE_SIZE, height: NODE_SIZE },
  hit: { width: NODE_SIZE, height: NODE_SIZE },
  fill: { ...StyleSheet.absoluteFillObject, borderRadius: NODE_SIZE / 2 },
  circle: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    top: RING_INSET,
    left: RING_INSET,
    right: RING_INSET,
    bottom: RING_INSET,
    borderRadius: (NODE_SIZE - RING_INSET * 2) / 2,
    borderWidth: 1.5,
  },
  // обёртка чипа шире узла (CHIP_W > NODE_SIZE) — иначе react-native-web ограничивает
  // детей max-width: 100% от родителя-узла и «НАЧАТЬ УРОК» ломается на две строки
  chipWrap: {
    position: 'absolute',
    top: -53,
    left: (NODE_SIZE - CHIP_W) / 2,
    width: CHIP_W,
    alignItems: 'center',
    zIndex: 3,
    pointerEvents: 'none' as const,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  chipText: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1.5 },
  chipTail: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    width: 10,
    height: 10,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  // премиум-чип «✦ ПРЕМИУМ» (`.premchip` эталона) — мельче «НАЧАТЬ УРОК» и неподвижен:
  // это не приглашение начать урок, а причина замка (спека 53, задача 6)
  chipPrem: { borderRadius: 10, paddingVertical: 4, paddingHorizontal: 9 },
  chipTextPrem: { fontSize: 8.5 },
  chipTailPrem: { bottom: -5, width: 8, height: 8 },
  // та же причина, что у chipWrap: подпись шире узла, поэтому её тоже несём в обёртке
  labelWrap: {
    position: 'absolute',
    top: 80,
    left: (NODE_SIZE - LABEL_W) / 2,
    width: LABEL_W,
    alignItems: 'center',
    pointerEvents: 'none' as const,
  },
  label: {
    width: '100%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
