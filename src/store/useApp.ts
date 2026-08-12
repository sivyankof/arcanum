/** Глобальное состояние: тема, язык, карта дня, серия (streak). Персист — AsyncStorage. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { daysAgoISO, localDateISO } from '../lib/dates';
import { canEditEntry, normalizeNote, type DailyDraw, type Outcome } from '../lib/journal';
import { DEFAULT_SETTINGS, mergeSettings, type AppSettings } from '../lib/settings';
import type { ThemeMode } from '../theme/theme';

export type Lang = 'ru' | 'en';

// тип записи живёт в src/lib/journal.ts вместе с чистой арифметикой дневника,
// здесь — только реэкспорт, чтобы экраны импортировали его привычным путём
export type { DailyDraw };

// сами настройки (тип, дефолт, слияние при обновлении) живут в src/lib/settings.ts —
// реэкспорт типа, чтобы экраны не меняли импорты
export type { AppSettings };

interface AppState {
  themeMode: ThemeMode;
  lang: Lang;
  /** Личный сид для карты дня (0 — ещё не назначен, назначается один раз после первой гидрации). */
  installSeed: number;
  streak: number;
  lastDrawDate: string | null;
  history: DailyDraw[];
  settings: AppSettings;
  /** Только для разработки: показать блок рефлексии, не дожидаясь 18:00. */
  devReflect: boolean;
  setThemeMode: (m: ThemeMode) => void;
  setLang: (l: Lang) => void;
  drawToday: (cardId: string, reversed: boolean) => void;
  todayDraw: () => DailyDraw | undefined;
  setNote: (date: string, text: string) => void;
  setOutcome: (date: string, outcome: Outcome) => void;
  setReflectionOn: (on: boolean) => void;
  setPushesOn: (on: boolean) => void;
  setPushTime: (kind: 'morning' | 'evening', hhmm: string) => void;
  setPushAsked: () => void;
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
      settings: DEFAULT_SETTINGS,
      devReflect: false,

      setThemeMode: (themeMode) => set({ themeMode }),
      setLang: (lang) => set({ lang }),

      drawToday: (cardId, reversed) => {
        const t = localDateISO();
        const { lastDrawDate, streak, history } = get();
        if (lastDrawDate === t) return; // уже тянули сегодня
        const yesterday = daysAgoISO(1);
        const newStreak = lastDrawDate === yesterday ? streak + 1 : 1;
        set({
          lastDrawDate: t,
          streak: newStreak,
          history: [{ date: t, cardId, reversed }, ...history].slice(0, 365),
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
      setOutcome: (date, outcome) => {
        if (!canEditEntry(date)) return;
        set({
          history: get().history.map((h) => {
            if (h.date !== date) return h;
            if (h.outcome === outcome) return h;
            return { ...h, outcome };
          }),
        });
      },

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
      storage: createJSONStorage(() => AsyncStorage),
      // schemaVersion из logic-spec §7 хранится тут же, отдельного поля в состоянии нет.
      // v1 → v2: появились настройки (settings.reflectionOn).
      // v2 → v3: настройки пушей (pushesOn, pushMorning, pushEvening, pushAsked).
      version: 3,
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
