/** Глобальное состояние: тема, язык, карта дня, серия (streak). Персист — AsyncStorage. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ThemeMode } from '../theme/theme';

export type Lang = 'ru' | 'en';

interface DailyDraw {
  date: string;      // YYYY-MM-DD
  cardId: string;
  reversed: boolean;
  note?: string;
  outcome?: 'yes' | 'partly' | 'no'; // вечерняя рефлексия «сбылось?»
}

interface AppState {
  themeMode: ThemeMode;
  lang: Lang;
  streak: number;
  lastDrawDate: string | null;
  history: DailyDraw[];
  setThemeMode: (m: ThemeMode) => void;
  setLang: (l: Lang) => void;
  drawToday: (cardId: string, reversed: boolean) => void;
  todayDraw: () => DailyDraw | undefined;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      themeMode: 'dark',
      lang: 'ru',
      streak: 0,
      lastDrawDate: null,
      history: [],

      setThemeMode: (themeMode) => set({ themeMode }),
      setLang: (lang) => set({ lang }),

      drawToday: (cardId, reversed) => {
        const t = todayStr();
        const { lastDrawDate, streak, history } = get();
        if (lastDrawDate === t) return; // уже тянули сегодня
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const newStreak = lastDrawDate === yesterday ? streak + 1 : 1;
        set({
          lastDrawDate: t,
          streak: newStreak,
          history: [{ date: t, cardId, reversed }, ...history].slice(0, 365),
        });
      },

      todayDraw: () => get().history.find((h) => h.date === todayStr()),
    }),
    { name: 'arcanum-app', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
