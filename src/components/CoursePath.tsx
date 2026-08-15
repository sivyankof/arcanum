/** Тропа одного модуля (эталон .path из #v-course): пунктирная кривая через узлы-уроки.
 *  Кривая — кубические Безье через середины Y соседних центров (формула макета).
 *  Координаты считаются в px по замеренной ширине: у макета viewBox растягивается
 *  preserveAspectRatio="none", но в RN это деформировало бы круглый пунктир. */
import React from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { CourseLesson, CourseModule, Lang } from '../lib/content';
import { nodeXs, type LessonState } from '../lib/courseProgress';
import { inLang } from '../lib/lang';
import { useTheme } from '../theme/useTheme';
import { NODE_SIZE, PathNode } from './PathNode';

const TOP = 96; // запас над первым узлом: чип «НАЧАТЬ УРОК» не должен упираться в шапку модуля
const STEP = 106; // вертикальный шаг центров узлов (макет ~92 ×1.147)
const BOTTOM = 80; // под последним узлом — место подписи в две строки

export function CoursePath({
  module: mod,
  states,
  lang,
  chipLabel,
  onLessonPress,
}: {
  module: CourseModule;
  states: Record<string, LessonState>;
  lang: Lang;
  chipLabel: string;
  onLessonPress: (lesson: CourseLesson) => void;
}) {
  const t = useTheme();
  const [width, setWidth] = React.useState(0);

  const n = mod.lessons.length;
  const height = TOP + STEP * (n - 1) + BOTTOM;
  const xs = nodeXs(n);
  const centers = mod.lessons.map((_, i) => ({
    x: (xs[i] / 100) * width,
    y: TOP + STEP * i,
  }));

  // M x0,y0 C x0,ym x1,ym x1,y1 … — ym = середина Y соседних центров (формула эталона)
  const d = centers
    .map((p, i) => {
      if (i === 0) return `M ${p.x},${p.y}`;
      const ym = (centers[i - 1].y + p.y) / 2;
      return `C ${centers[i - 1].x},${ym} ${p.x},${ym} ${p.x},${p.y}`;
    })
    .join(' ');

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={{ height }} onLayout={onLayout}>
      {width > 0 && (
        <>
          <Svg width={width} height={height} style={{ position: 'absolute', pointerEvents: 'none' }}>
            <Path
              d={d}
              stroke={t.line}
              strokeWidth={3}
              strokeDasharray={[1, 10]}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
          {mod.lessons.map((l, i) => (
            <View
              key={l.id}
              style={{
                position: 'absolute',
                left: centers[i].x - NODE_SIZE / 2,
                top: centers[i].y - NODE_SIZE / 2,
              }}
            >
              <PathNode
                state={states[l.id] ?? 'locked'}
                title={inLang(l.title, lang)}
                chipLabel={chipLabel}
                onPress={() => onLessonPress(l)}
              />
            </View>
          ))}
        </>
      )}
    </View>
  );
}
