"""Генератор фонового трека приложения (спека 74): assets/audio/ambient.m4a.

Запуск из корня без аргументов: python scripts/gen_ambient.py [--dip]
Зависимости: numpy (pip install numpy) и ffmpeg/ffprobe в PATH.

Петля 128 секунд = 8 аккордов по 16 секунд. Бесшовность: все частоты кратны 1/T,
огибающие аккордов и ноты заворачиваются через конец петли, реверберация —
круговая свёртка (через БПФ), поэтому её хвост тоже замкнут в петлю.

--dip (план Б спеки): перед записью громкость плавно опускается до нуля к стыку
(cos² на последних и первых 0.6 с) — на случай, если стык слышен в плеере.

Файл руками не править: самопроверка после записи падает с кодом 1 и удаляет m4a."""
import os
import shutil
import subprocess
import sys
import tempfile
import wave

try:
    import numpy as np
except ImportError:
    sys.exit('Нужен numpy: pip install numpy')

for tool in ('ffmpeg', 'ffprobe'):
    if shutil.which(tool) is None:
        sys.exit(f'Нужен {tool} в PATH')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_FILE = os.path.join(ROOT, 'assets', 'audio', 'ambient.m4a')

SR = 44100
T = 128.0
N = int(SR * T)
t = np.arange(N) / SR
SEG = T / 8        # длительность аккорда
OVERLAP = 10.0     # сколько секунд соседние аккорды звучат вместе
DIP_SEC = 0.6      # длина затухания к стыку при --dip

NAMES = {'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'B': 2}


def note(name):
    return 440.0 * 2 ** ((NAMES[name[:-1]] + 12 * (int(name[-1]) - 4)) / 12)


def q(freq):
    return round(freq * T) / T


def lfo(cycles, phase=0.0, lo=0.0, hi=1.0):
    return lo + (hi - lo) * (0.5 + 0.5 * np.sin(2 * np.pi * cycles * t / T + phase))


def chord_env(k):
    """Огибающая k-го аккорда: плавный вход и выход, сумма соседних = 1."""
    center = (k + 0.5) * SEG
    dist = np.abs(((t - center + T / 2) % T) - T / 2)
    x = np.clip((dist - (SEG - OVERLAP) / 2) / OVERLAP, 0, 1)
    return np.cos(x * np.pi / 2) ** 2


def pad(freq, rng, harmonics, detune=(-2, 0, 3)):
    left = np.zeros(N)
    right = np.zeros(N)
    for i, d in enumerate(detune):
        f = q(freq) + d / T
        sig = np.zeros(N)
        for h, amp in enumerate(harmonics, start=1):
            sig += amp * np.sin(2 * np.pi * f * h * t + rng.uniform(0, 2 * np.pi))
        sig *= lfo(rng.integers(5, 12), rng.uniform(0, 2 * np.pi), 0.78, 1.0)
        pan = lfo(rng.integers(1, 4), rng.uniform(0, 2 * np.pi), 0.2, 0.8)
        left += sig * np.sqrt(1 - pan)
        right += sig * np.sqrt(pan)
    return np.stack([left, right])


def tone(freq, t0, rng, tau, amp):
    """Мягкая нота с долгим затуханием и двумя тихими повторами-эхо."""
    out = np.zeros((2, N))
    pan = rng.uniform(0.25, 0.75)
    for delay, gain in ((0.0, 1.0), (0.9, 0.3), (1.8, 0.1)):
        dt = (t - t0 - delay) % T
        env = np.exp(-dt / tau) * (1 - np.exp(-dt / 0.28))
        sig = (np.sin(2 * np.pi * freq * dt) + 0.03 * np.sin(2 * np.pi * freq * 2 * dt) * np.exp(-dt / (tau * 0.4)))
        sig *= env * amp * gain
        p = pan if delay == 0 else 1 - pan  # эхо отвечает с другой стороны
        out[0] += sig * np.sqrt(1 - p)
        out[1] += sig * np.sqrt(p)
    return out


def reverb(stereo, rng, decay=2.6, length=9.0):
    """Круговая свёртка с затухающим шумом — «зал», хвост которого замкнут в петлю."""
    n_ir = int(length * SR)
    ti = np.arange(n_ir) / SR
    out = np.zeros_like(stereo)
    freqs = np.fft.rfftfreq(N, 1 / SR)
    tilt = 1 / (1 + (freqs / 2200) ** 2)  # хвост темнее прямого звука
    for ch in range(2):
        ir = np.zeros(N)
        ir[:n_ir] = rng.standard_normal(n_ir) * np.exp(-ti / decay) * (1 - np.exp(-ti / 0.05))
        ir /= np.sqrt(np.sum(ir ** 2))
        out[ch] = np.fft.irfft(np.fft.rfft(stereo[ch]) * np.fft.rfft(ir) * tilt, N)
    return out


def soften(stereo, cutoff=2000):
    freqs = np.fft.rfftfreq(N, 1 / SR)
    shape = 1 / np.sqrt(1 + (freqs / cutoff) ** 4)
    return np.stack([np.fft.irfft(np.fft.rfft(ch) * shape, N) for ch in stereo])


def build(chords, seed, bells, bell_gain=0.1):
    rng = np.random.default_rng(seed)
    pads = np.zeros((2, N))
    notes = np.zeros((2, N))
    for k, (bass, tones) in enumerate(chords):
        env = chord_env(k)
        layer = pad(note(bass), rng, (1.0, 0.3, 0.08)) * 0.8
        for name in tones:
            layer += pad(note(name), rng, (1.0, 0.08, 0.015)) * 0.5
        # тихое мерцание октавой выше верхней ноты аккорда
        layer += pad(note(tones[-1]) * 2, rng, (1.0,)) * 0.025
        pads += layer * env
        if bells:
            start = k * SEG
            count = rng.integers(1, 3)
            times = np.sort(rng.uniform(1.5, SEG - 3.0, count))
            pool = [note(n) * 2 for n in tones] + [note(n) * 4 for n in tones[:2]]
            for t0 in times:
                notes += tone(q(rng.choice(pool)), start + t0, rng, tau=rng.uniform(3.5, 5.5), amp=rng.uniform(0.5, 1.0))
    dry = pads + notes * bell_gain
    wet = reverb(pads * 0.6 + notes * bell_gain * 1.4, rng)
    return soften(dry * 0.4 + wet * 1.15)


NIGHT = [  # «ночное небо»: ля минор с мажорными просветами
    ('A2', ['E3', 'G3', 'B3', 'C4']),
    ('F2', ['C3', 'A3', 'C4', 'E4']),
    ('C3', ['G3', 'B3', 'E4']),
    ('G2', ['D3', 'G3', 'A3', 'D4']),
    ('A2', ['E3', 'G3', 'C4', 'E4']),
    ('E2', ['B2', 'G3', 'B3', 'D4']),
    ('F2', ['C3', 'A3', 'C4', 'E4']),
    ('G2', ['D3', 'A3', 'B3', 'D4']),
]


def dip_envelope():
    """Огибающая 1 → 0 к стыку: cos² на первых и последних DIP_SEC секунд."""
    n = int(DIP_SEC * SR)
    ramp = np.sin(np.linspace(0, np.pi / 2, n)) ** 2  # 0 → 1
    env = np.ones(N)
    env[:n] = ramp
    env[-n:] = ramp[::-1]
    return env


def main():
    dip = '--dip' in sys.argv[1:]
    stereo = build(NIGHT, 8, bells=True)
    peak = np.max(np.abs(stereo))
    data = (stereo * (10 ** (-3 / 20) / peak)).T  # пик -3 дБ
    # числа шва считаются на данных до --dip: так их сверяют с прототипом
    seam = float(np.max(np.abs(data[0] - data[-1])))
    step = float(np.max(np.abs(np.diff(data, axis=0))))
    if dip:
        data = data * dip_envelope()[:, None]
    pcm = (data * 32767).astype('<i2')

    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
    fd, wav_path = tempfile.mkstemp(suffix='.wav')
    os.close(fd)
    try:
        with wave.open(wav_path, 'wb') as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        subprocess.run(
            ['ffmpeg', '-y', '-loglevel', 'error', '-i', wav_path, '-c:a', 'aac', '-b:a', '128k',
             '-movflags', '+faststart', OUT_FILE],
            check=True)
    finally:
        os.remove(wav_path)

    size_mb = os.path.getsize(OUT_FILE) / (1024 * 1024)
    print(f'шов {seam:.5f}, наибольший шаг {step:.5f}, размер {size_mb:.2f} МБ' + (' (--dip)' if dip else ''))

    errors = []
    if not dip and seam > step:
        errors.append(f'скачок на стыке {seam:.5f} больше наибольшего шага {step:.5f}')
    probe = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', OUT_FILE],
        capture_output=True, text=True)
    try:
        duration = float(probe.stdout.strip())
    except ValueError:
        duration = -1.0
    if abs(duration - T) > 0.1:
        errors.append(f'длительность {duration:.2f} с, ожидалось {T:.0f} ± 0.1')
    if not 0.5 <= size_mb <= 4:
        errors.append(f'размер {size_mb:.2f} МБ вне 0.5–4')
    if errors:
        os.remove(OUT_FILE)
        for e in errors:
            print('ОШИБКА:', e)
        sys.exit(1)


if __name__ == '__main__':
    main()
