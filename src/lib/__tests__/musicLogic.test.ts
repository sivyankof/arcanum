import {
  FADE_IN_MS,
  FADE_OUT_MS,
  FADE_STEP_MS,
  MUSIC_ENABLED,
  MUSIC_VOLUME,
  fadeVolume,
  nextInBackground,
  shouldPlay,
} from '../musicLogic';

const ON = { hydrated: true, onboarded: true, musicOn: true, inBackground: false };

describe('константы фоновой музыки', () => {
  it('значения зафиксированы спекой 74', () => {
    expect(MUSIC_VOLUME).toBe(0.25);
    expect(FADE_IN_MS).toBe(2500);
    expect(FADE_OUT_MS).toBe(400);
    expect(FADE_STEP_MS).toBe(50);
  });
});

describe('выключатель музыки', () => {
  it('в выпуске 1.0.1 музыка выключена (спека 74, дополнение 09.11)', () => {
    expect(MUSIC_ENABLED).toBe(false);
  });
});

describe('shouldPlay', () => {
  it('играет только когда всё сошлось', () => {
    expect(shouldPlay(ON)).toBe(true);
  });

  it('не играет, если перевёрнут ровно один признак', () => {
    expect(shouldPlay({ ...ON, hydrated: false })).toBe(false);
    expect(shouldPlay({ ...ON, onboarded: false })).toBe(false);
    expect(shouldPlay({ ...ON, musicOn: false })).toBe(false);
    expect(shouldPlay({ ...ON, inBackground: true })).toBe(false);
  });
});

describe('nextInBackground', () => {
  it('уход в фон включает признак фона', () => {
    expect(nextInBackground(false, 'background')).toBe(true);
  });

  it('возврат на передний план снимает признак фона', () => {
    expect(nextInBackground(true, 'active')).toBe(false);
  });

  it('inactive ничего не меняет (решение 10)', () => {
    expect(nextInBackground(false, 'inactive')).toBe(false);
    expect(nextInBackground(true, 'inactive')).toBe(true);
  });
});

describe('fadeVolume', () => {
  it('в начале — стартовая громкость', () => {
    expect(fadeVolume(0, 0.25, 0, 2500)).toBe(0);
  });

  it('линейно посередине', () => {
    expect(fadeVolume(0, 0.25, 1250, 2500)).toBeCloseTo(0.125);
  });

  it('в конце — целевая громкость', () => {
    expect(fadeVolume(0, 0.25, 2500, 2500)).toBe(0.25);
  });

  it('после конца зажимается на целевой громкости', () => {
    expect(fadeVolume(0, 0.25, 9999, 2500)).toBe(0.25);
  });

  it('затухание вниз линейно', () => {
    expect(fadeVolume(0.25, 0, 200, 400)).toBeCloseTo(0.125);
  });

  it('отрицательное время зажимается на начальной громкости', () => {
    expect(fadeVolume(0.1, 0.25, -5, 2500)).toBe(0.1);
  });

  it('нулевая длительность сразу даёт целевую громкость', () => {
    expect(fadeVolume(0, 0.25, 0, 0)).toBe(0.25);
  });
});
