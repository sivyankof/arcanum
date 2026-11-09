// Контракт фонового трека: файл на месте, вес в разумных пределах, контейнер MP4.
import * as fs from 'fs';
import * as path from 'path';

const FILE = path.join(__dirname, '..', '..', '..', 'assets', 'audio', 'ambient.m4a');

describe('assets/audio/ambient.m4a', () => {
  it('существует', () => {
    expect(fs.existsSync(FILE)).toBe(true);
  });

  it('весит от 0.5 до 4 МБ', () => {
    const size = fs.statSync(FILE).size;
    expect(size).toBeGreaterThanOrEqual(0.5 * 1024 * 1024);
    expect(size).toBeLessThanOrEqual(4 * 1024 * 1024);
  });

  it('это контейнер MP4 (байты 4–8 = ftyp)', () => {
    const head = fs.readFileSync(FILE).subarray(4, 8).toString('latin1');
    expect(head).toBe('ftyp');
  });

  it('плеер src/lib/music.ts подключает именно этот файл', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'music.ts'), 'utf8');
    expect(src).toContain('assets/audio/ambient.m4a');
  });
});
