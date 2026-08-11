/** Глобальное состояние: тема, язык, карта дня, серия (streak). Персист — AsyncStorage. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { daysAgoISO, localDateISO } from '../lib/dates';
import { canEditNote, normalizeNote, type DailyDraw } from '../lib/journal';
import type { ThemeMode } from '../theme/theme';

export type Lang = 'ru' | 'en';

// тип записи живёт в src/lib/journal.ts вместе с чистой арифметикой дневника,
// здесь — только реэкспорт, чтобы экраны импортировали его привычным путём
export type { DailyDraw };

interface AppState {
  themeMode: ThemeMode;
  lang: Lang;
  /** Личный сид для карты дня (0 — ещё не назначен, назначается один раз после первой гидрации). */
  installSeed: number;
  streak: number;
  lastDrawDate: string | null;
  history: DailyDraw[];
  setThemeMode: (m: ThemeMode) => void;
  setLang: (l: Lang) => void;
  drawToday: (cardId: string, reversed: boolean) => void;
  todayDraw: () => DailyDraw | undefined;
  setNote: (date: string, text: string) => void;
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
        if (!canEditNote(date)) return;
        const note = normalizeNote(text);
        set({
          history: get().history.map((h) => {
            if (h.date !== date) return h;
            const { note: _prev, ...rest } = h;
            return note ? { ...rest, note } : rest;
          }),
        });
      },

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
      // Схема записей не менялась — миграция ничего не преобразует.
      version: 1,
      migrate: (persistedState) => persistedState as AppState,
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
