// Фоновая музыка (спека 74): ЕДИНСТВЕННЫЙ файл проекта, который импортирует expo-audio
// (страж — androidPermissions.test.ts). Веб-заглушка рядом — music.web.ts.
// Один плеер на всё приложение, без заглушения по экранам (решение 8).
import { FADE_IN_MS, FADE_OUT_MS, FADE_STEP_MS, MUSIC_VOLUME, fadeVolume } from './musicLogic';

// Минимум того, что нужно от плеера, — не тянем типы пакета, чтобы модуль оставался ленивым.
interface Player {
  volume: number;
  loop: boolean;
  play(): void;
  pause(): void;
}

let player: Player | null = null;
// true — звука нет совсем (Expo Go без нативного модуля, сбой загрузки): обе функции молчат
let unavailable = false;
let playing = false;
let timer: ReturnType<typeof setInterval> | null = null;

/** Создаёт плеер при первом вызове; при любой ошибке навсегда уходит в «звука нет». */
function ensurePlayer(): Player | null {
  if (player) return player;
  if (unavailable) return null;
  try {
    // ленивая загрузка: без нативного модуля `require` бросает, и приложение живёт дальше
    const audio = require('expo-audio');
    const source = require('../../assets/audio/ambient.m4a');
    // без записи; в беззвучном режиме молчим; чужой звук не прерываем; в фоне не играем
    Promise.resolve(
      audio.setAudioModeAsync({
        playsInSilentMode: false,
        interruptionMode: 'mixWithOthers',
        shouldPlayInBackground: false,
      }),
    ).catch(() => {});
    const p: Player = audio.createAudioPlayer(source);
    p.loop = true;
    p.volume = 0;
    player = p;
    return p;
  } catch {
    unavailable = true;
    return null;
  }
}

function cancelFade(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

/** Линейно ведёт громкость от ТЕКУЩЕЙ к `to`; по окончании зовёт `done`. */
function fadeTo(p: Player, to: number, durationMs: number, done?: () => void): void {
  cancelFade();
  const from = p.volume;
  let elapsed = 0;
  timer = setInterval(() => {
    elapsed += FADE_STEP_MS;
    p.volume = fadeVolume(from, to, elapsed, durationMs);
    if (elapsed >= durationMs) {
      cancelFade();
      done?.();
    }
  }, FADE_STEP_MS);
}

/** Запускает музыку с плавным нарастанием. Позицию не сбрасывает. */
export function startMusic(): void {
  const p = ensurePlayer();
  if (!p) return;
  try {
    if (!playing) {
      playing = true;
      p.play();
    }
    fadeTo(p, MUSIC_VOLUME, FADE_IN_MS);
  } catch {
    unavailable = true;
  }
}

/** Плавно гасит музыку и ставит плеер на паузу. */
export function stopMusic(): void {
  if (!player) return;
  const p = player;
  try {
    fadeTo(p, 0, FADE_OUT_MS, () => {
      p.volume = 0;
      p.pause();
      playing = false;
    });
  } catch {
    unavailable = true;
  }
}
