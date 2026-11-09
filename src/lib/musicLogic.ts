// Чистая логика фоновой музыки: когда играть и как плавно менять громкость.
// Без импортов из react-native и expo — функции тестируются на Node.

/**
 * Главный выключатель фоновой музыки. Выключена, пока не выбрана новая мелодия
 * (спека 74, дополнение 09.11). Чтобы включить: поставить true и заменить/пересоздать
 * assets/audio/ambient.m4a.
 */
export const MUSIC_ENABLED = false;

/** Громкость фоновой музыки (от 0 до 1). */
export const MUSIC_VOLUME = 0.25;
/** Длительность нарастания громкости при старте, мс. */
export const FADE_IN_MS = 2500;
/** Длительность затухания при уходе в фон, мс. */
export const FADE_OUT_MS = 400;
/** Шаг обновления громкости во время плавного изменения, мс. */
export const FADE_STEP_MS = 50;

/** Признаки, от которых зависит, звучит ли музыка прямо сейчас. */
export interface MusicState {
  /** Стор прочитан из хранилища. */
  hydrated: boolean;
  /** Онбординг пройден. */
  onboarded: boolean;
  /** Музыка включена в настройках. */
  musicOn: boolean;
  /** Приложение сейчас в фоне. */
  inBackground: boolean;
}

/** Музыка играет только когда все условия выполнены одновременно. */
export function shouldPlay(s: MusicState): boolean {
  return s.hydrated && s.onboarded && s.musicOn && !s.inBackground;
}

/**
 * Следующее значение признака «в фоне» по событию AppState.
 * `inactive` (шторка, переключение приложений) ничего не меняет — решение 10.
 */
export function nextInBackground(prev: boolean, state: string): boolean {
  if (state === 'background') return true;
  if (state === 'active') return false;
  return prev;
}

/**
 * Громкость на момент `elapsedMs` линейного перехода от `from` к `to` за `durationMs`.
 * Время зажимается в отрезке [0, durationMs]. Нулевая длительность сразу даёт `to`.
 */
export function fadeVolume(from: number, to: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return to;
  const t = Math.min(Math.max(elapsedMs, 0), durationMs) / durationMs;
  return from + (to - from) * t;
}
