// Плеер фоновой музыки (спека 74): один плеер на приложение, плавный вход и выход,
// отказоустойчивость при недоступном нативном модуле.
import { MUSIC_VOLUME } from '../musicLogic';

interface FakePlayer {
  volume: number;
  loop: boolean;
  play: jest.Mock;
  pause: jest.Mock;
}

interface Loaded {
  music: typeof import('../music');
  player: FakePlayer;
  setAudioModeAsync: jest.Mock;
  createAudioPlayer: jest.Mock;
}

/** Свежий модуль `music` с поддельным expo-audio: у каждого теста свой плеер. `music` грузит
 *  expo-audio лениво (внутри функции), поэтому isolateModules не годится — реестр сбрасываем целиком. */
function load(): Loaded {
  const player: FakePlayer = { volume: 1, loop: false, play: jest.fn(), pause: jest.fn() };
  const setAudioModeAsync = jest.fn(() => Promise.resolve());
  const createAudioPlayer = jest.fn(() => player);
  jest.resetModules();
  jest.doMock('expo-audio', () => ({ createAudioPlayer, setAudioModeAsync }));
  const music: typeof import('../music') = require('../music');
  return { music, player, setAudioModeAsync, createAudioPlayer };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.dontMock('expo-audio');
});

describe('startMusic', () => {
  it('запускает цикл с нулевой громкости и за 2.5 с доводит до рабочей', () => {
    const { music, player } = load();
    music.startMusic();
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.loop).toBe(true);
    expect(player.volume).toBe(0);
    jest.advanceTimersByTime(2500);
    expect(player.volume).toBeCloseTo(MUSIC_VOLUME, 5);
  });
});

describe('stopMusic', () => {
  it('за 400 мс гасит звук до нуля и ставит на паузу один раз', () => {
    const { music, player } = load();
    music.startMusic();
    jest.advanceTimersByTime(2500);
    music.stopMusic();
    jest.advanceTimersByTime(400);
    expect(player.volume).toBeCloseTo(0, 5);
    expect(player.pause).toHaveBeenCalledTimes(1);
  });

  it('стоп на первой секунде входа: пауза и ноль, play вызван ровно один раз', () => {
    const { music, player } = load();
    music.startMusic();
    jest.advanceTimersByTime(1000);
    music.stopMusic();
    jest.advanceTimersByTime(5000);
    expect(player.pause).toHaveBeenCalled();
    expect(player.volume).toBeCloseTo(0, 5);
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('до первого старта ничего не создаёт и не бросает', () => {
    const { music, createAudioPlayer } = load();
    expect(() => music.stopMusic()).not.toThrow();
    expect(createAudioPlayer).not.toHaveBeenCalled();
  });
});

describe('быстрая череда вызовов', () => {
  it('start, stop, start, stop, start: в итоге рабочая громкость и ни одной паузы после последнего start', () => {
    const { music, player } = load();
    music.startMusic();
    music.stopMusic();
    music.startMusic();
    music.stopMusic();
    music.startMusic();
    const pausesBefore = player.pause.mock.calls.length;
    jest.advanceTimersByTime(5000);
    expect(player.volume).toBeCloseTo(MUSIC_VOLUME, 5);
    expect(player.pause.mock.calls.length).toBe(pausesBefore);
  });
});

describe('режим звука', () => {
  it('выставляется один раз за несколько стартов: без записи, в тихом режиме молчим, с чужим звуком смешиваемся', () => {
    const { music, setAudioModeAsync, createAudioPlayer } = load();
    music.startMusic();
    music.stopMusic();
    music.startMusic();
    expect(setAudioModeAsync).toHaveBeenCalledTimes(1);
    expect(setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    });
    expect(createAudioPlayer).toHaveBeenCalledTimes(1);
  });
});

describe('нативный модуль недоступен', () => {
  it('фабрика expo-audio бросает при загрузке: обе функции молча выходят', () => {
    jest.resetModules();
    jest.doMock('expo-audio', () => {
      throw new Error('Cannot find native module ExpoAudio');
    });
    const music: typeof import('../music') = require('../music');
    expect(() => music.startMusic()).not.toThrow();
    expect(() => music.stopMusic()).not.toThrow();
  });

  it('createAudioPlayer бросает: ошибка не выходит наружу', () => {
    jest.resetModules();
    jest.doMock('expo-audio', () => ({
      createAudioPlayer: () => {
        throw new Error('boom');
      },
      setAudioModeAsync: () => Promise.resolve(),
    }));
    const music: typeof import('../music') = require('../music');
    expect(() => music.startMusic()).not.toThrow();
    expect(() => music.stopMusic()).not.toThrow();
  });
});
