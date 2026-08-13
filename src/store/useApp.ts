/** Глобальное состояние: тема, язык, карта дня, серия (streak). Персист — AsyncStorage. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { buildProfile, type Profile } from '../lib/birthArcana';
import { completeLessonProgress, type LessonProgressMap } from '../lib/courseProgress';
import { daysAgoISO, localDateISO } from '../lib/dates';
import { canEditEntry, normalizeNote, type DailyDraw, type Outcome } from '../lib/journal';
import { DEFAULT_SETTINGS, mergeSettings, type AppSettings } from '../lib/settings';
import { reflectXp, XP_DRAW } from '../lib/xp';
import type { ThemeMode } from '../theme/theme';

export type Lang = 'ru' | 'en';

// тип записи живёт в src/lib/journal.ts вместе с чистой арифметикой дневника,
// здесь — только реэкспорт, чтобы экраны импортировали его привычным путём
export type { DailyDraw };

// сами настройки (тип, дефолт, слияние при обновлении) живут в src/lib/settings.ts —
// реэкспорт типа, чтобы экраны не меняли импорты
export type { AppSettings };

// прогресс уроков курса — тип живёт в src/lib/courseProgress.ts рядом с логикой пути
export type { LessonProgressMap };

// профиль (имя, дата и аркан рождения) — тип живёт в src/lib/birthArcana.ts рядом с формулой
export type { Profile };

interface AppState {
  themeMode: ThemeMode;
  lang: Lang;
  /** Личный сид для карты дня (0 — ещё не назначен, назначается один раз после первой гидрации). */
  installSeed: number;
  streak: number;
  lastDrawDate: string | null;
  history: DailyDraw[];
  /** Прогресс уроков курса по id урока (logic-spec §7). В 07 читается для состояний
   *  узлов пути; пишут только DEV-строки настроек — настоящая запись в задаче 08. */
  lessonsProgress: LessonProgressMap;
  /** Сумма XP (logic-spec §4). Источники: урок, повтор урока, карта дня, первый ответ
   *  рефлексии дня. Задним числом за прошлые дни не начисляется — счёт с нуля у всех. */
  xp: number;
  settings: AppSettings;
  /** Профиль онбординга (logic-spec §7): имя, дата и аркан рождения.
   *  onboarded: false — онбординг ещё не пройден, корневой layout уводит на /onboarding. */
  profile: Profile;
  /** Только для разработки: показать блок рефлексии, не дожидаясь 18:00. */
  devReflect: boolean;
  setThemeMode: (m: ThemeMode) => void;
  setLang: (l: Lang) => void;
  drawToday: (cardId: string, reversed: boolean) => void;
  todayDraw: () => DailyDraw | undefined;
  setNote: (date: string, text: string) => void;
  setOutcome: (date: string, outcome: Outcome) => void;
  setLessonDone: (lessonId: string, done: boolean) => void;
  /** Завершение урока движком (спека 08). Возвращает начисленный XP для экрана результата. */
  completeLesson: (lessonId: string, errors: number) => number;
  resetCourse: () => void;
  setReflectionOn: (on: boolean) => void;
  setPushesOn: (on: boolean) => void;
  setPushTime: (kind: 'morning' | 'evening', hhmm: string) => void;
  setPushAsked: () => void;
  /** Финальная CTA онбординга: профиль пишется одним куском (buildProfile). */
  completeOnboarding: (name: string, birthDate?: string) => void;
  /** Только для разработки: вернуть онбординг — гард в _layout сам уведёт на экран. */
  resetOnboarding: () => void;
  setDevReflect: (on: boolean) => void;
  resetToday: () => void;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      themeMode: 'dark',
      lang: 'ru',
      installSeed: 0,
      streak: 0,
      lastDrawDate: null,
      history: [],
      lessonsProgress: {},
      xp: 0,
      settings: DEFAULT_SETTINGS,
      profile: { onboarded: false },
      devReflect: false,

      setThemeMode: (themeMode) => set({ themeMode }),
      setLang: (lang) => set({ lang }),

      drawToday: (cardId, reversed) => {
        const t = localDateISO();
        const { lastDrawDate, streak, history, xp } = get();
        if (lastDrawDate === t) return; // уже тянули сегодня
        const yesterday = daysAgoISO(1);
        const newStreak = lastDrawDate === yesterday ? streak + 1 : 1;
        set({
          lastDrawDate: t,
          streak: newStreak,
          history: [{ date: t, cardId, reversed }, ...history].slice(0, 365),
          // ритуал дня: +5 XP (logic-spec §4); повторное начисление отсекает проверка выше
          xp: xp + XP_DRAW,
        });
      },

      todayDraw: () => get().history.find((h) => h.date === localDateISO()),

      // Заметка к карте дня. Правится только сегодняшняя запись (logic-spec §3: в полночь
      // запись фиксируется). Пустой текст удаляет поле, а не пишет пустую строку.
      setNote: (date, text) => {
        if (!canEditEntry(date)) return;
        const note = normalizeNote(text);
        set({
          history: get().history.map((h) => {
            if (h.date !== date) return h;
            const { note: _prev, ...rest } = h;
            return note ? { ...rest, note } : rest;
          }),
        });
      },

      // Ответ вечерней рефлексии. Правило то же, что у заметки: правится только сегодняшняя
      // запись (logic-spec §3). Смена ответа до полуночи разрешена, снятия ответа нет.
      // +3 XP — только за ПЕРВЫЙ ответ дня: смена ответа повторно не начисляет (logic-spec §4).
      setOutcome: (date, outcome) => {
        if (!canEditEntry(date)) return;
        const entry = get().history.find((h) => h.date === date);
        if (!entry || entry.outcome === outcome) return;
        set({
          history: get().history.map((h) => (h.date === date ? { ...h, outcome } : h)),
          xp: get().xp + reflectXp(entry.outcome),
        });
      },

      // Прогресс урока. До движка урока (08) сюда пишут только DEV-строки настроек;
      // errors всегда 0 — считать их научит викторина задачи 08.
      setLessonDone: (lessonId, done) =>
        set({
          lessonsProgress: {
            ...get().lessonsProgress,
            [lessonId]: { done, errors: 0, ts: Date.now() },
          },
        }),
      // Завершение урока: вся арифметика — в чистой completeLessonProgress (courseProgress.ts),
      // экшен применяет результат и возвращает начисленный XP экрану результата.
      completeLesson: (lessonId, errors) => {
        const { lessonsProgress, xp } = get();
        const r = completeLessonProgress(lessonsProgress, lessonId, errors, localDateISO(), Date.now());
        set({ lessonsProgress: r.progress, xp: xp + r.gained });
        return r.gained;
      },
      resetCourse: () => set({ lessonsProgress: {} }),

      setReflectionOn: (on) => set({ settings: { ...get().settings, reflectionOn: on } }),
      setPushesOn: (on) => set({ settings: { ...get().settings, pushesOn: on } }),
      setPushTime: (kind, hhmm) =>
        set({
          settings: {
            ...get().settings,
            ...(kind === 'morning' ? { pushMorning: hhmm } : { pushEvening: hhmm }),
          },
        }),
      setPushAsked: () => set({ settings: { ...get().settings, pushAsked: true } }),
      completeOnboarding: (name, birthDate) => set({ profile: buildProfile(name, birthDate) }),
      resetOnboarding: () => set({ profile: { onboarded: false } }),
      setDevReflect: (devReflect) => set({ devReflect }),

      // Для разработки: отменяет сегодняшнюю карту, чтобы вытянуть заново.
      // Серия уменьшается на 1 (точное прежнее значение не хранится).
      resetToday: () => {
        const t = localDateISO();
        const { history, streak } = get();
        if (!history.some((h) => h.date === t)) return;
        const rest = history.filter((h) => h.date !== t);
        set({
          history: rest,
          lastDrawDate: rest[0]?.date ?? null,
          streak: Math.max(0, streak - 1),
        });
      },
    }),
    {
      name: 'arcanum-app',
      // ⚠️ БИТУЮ запись считаем отсутствующей. С задачи 09 первый экран ждёт завершения
      // гидрации (гейт онбординга в app/_layout.tsx), а zustand на ошибке разбора НЕ поднимает
      // hasHydrated и не зовёт слушателей вовсе — приложение осталось бы на сплэше навсегда,
      // и починить это можно было бы только переустановкой, то есть потерей дневника.
      // Раньше та же порча просто означала старт с дефолтов; возвращаем это поведение.
      // Глотаем ТОЛЬКО ошибку разбора: сбои доступа к самому хранилищу пробрасываем как прежде —
      // на вебе expo-router рендерит страницы ещё и в Node (output: "static"), где AsyncStorage
      // падает на отсутствии window, и подменять там гидрацию дефолтами нельзя: серверный кадр
      // тогда покажет онбординг всем подряд, включая тех, кто его давно прошёл.
      storage: createJSONStorage(() => ({
        getItem: async (name: string) => {
          const raw = await AsyncStorage.getItem(name);
          if (raw === null) return null;
          try {
            JSON.parse(raw); // проверка читаемости: сам разбор идёт дальше в createJSONStorage
          } catch {
            return null;
          }
          return raw;
        },
        setItem: (name: string, value: string) => AsyncStorage.setItem(name, value),
        removeItem: (name: string) => AsyncStorage.removeItem(name),
      })),
      // schemaVersion из logic-spec §7 хранится тут же, отдельного поля в состоянии нет.
      // v1 → v2: появились настройки (settings.reflectionOn).
      // v2 → v3: настройки пушей (pushesOn, pushMorning, pushEvening, pushAsked).
      // v3 → v4: lessonsProgress (прогресс курса, спека 07). Ключ ВЕРХНЕГО уровня —
      // поверхностное слияние persist подставит дефолт {} само (ловушка 06а бьёт только
      // по вложенным объектам вроде settings), поэтому отдельная ветка миграции не нужна.
      // v4 → v5: xp (спека 08) — снова ключ ВЕРХНЕГО уровня, дефолт 0 доливается поверхностным
      // слиянием сам; repeatDate живёт ВНУТРИ записей lessonsProgress и опционален — миграция
      // не нужна.
      // v5 → v6: profile (спека 09) — снова ключ ВЕРХНЕГО уровня, дефолт { onboarded: false }
      // доливается поверхностным слиянием сам, ветка миграции не нужна. Существующие установки
      // получают onboarded: false и проходят онбординг один раз (решение Артёма 13.08).
      // ⚠️ Но profile — ВТОРОЙ вложенный объект состояния после settings, и ловушка 06а
      // распространяется на него целиком: задача, которая добавит ПОЛЕ ВНУТРЬ profile
      // (например «дату предложим позже» из задачи 16), обязана поднять версию И дописать
      // слияние руками в migrate — как это сделано для settings. Само по себе новое поле
      // у уже установленного приложения не появится.
      // Следующая задача, меняющая схему, поднимает до 7.
      version: 6,
      // ⚠️ persist сливает состояние ПОВЕРХНОСТНО: сохранённый `settings` заменяет объект-дефолт
      // целиком, а не сливается с ним по ключам. Поэтому недостающие ключи дописываем здесь
      // руками — и следующая задача, добавляя поля в settings, обязана поднять версию и сделать
      // то же самое, иначе новые настройки не появятся у уже существующих пользователей.
      migrate: (persistedState) => {
        const s = (persistedState ?? {}) as Partial<AppState>;
        return { ...s, settings: mergeSettings(s.settings) } as AppState;
      },
      // После гидрации назначаем личный сид карты дня, если он ещё не назначен (installSeed === 0):
      // срабатывает и на свежей установке, и у уже существующих пользователей после обновления.
      // Уже открытая сегодня карта не изменится — она читается из history, а не пересчитывается.
      onRehydrateStorage: () => (state) => {
        if (state && state.installSeed === 0) {
          useApp.setState({ installSeed: 1 + Math.floor(Math.random() * (2 ** 31 - 1)) });
        }
      },
    },
  ),
);
