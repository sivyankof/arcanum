import { resolveMode, THEME_LABEL_KEY, THEME_ICON } from '../../theme/resolveMode';
import { THEME_MODES } from '../../theme/theme';

describe('resolveMode', () => {
  it('выбранная вручную тема не слушает телефон', () => {
    expect(resolveMode('dark', 'light')).toBe('dark');
    expect(resolveMode('light', 'dark')).toBe('light');
  });

  it('«как в системе» следует схеме устройства', () => {
    expect(resolveMode('system', 'dark')).toBe('dark');
    expect(resolveMode('system', 'light')).toBe('light');
  });

  it('схема неизвестна — тёмная', () => {
    expect(resolveMode('system', null)).toBe('dark');
    expect(resolveMode('system', undefined)).toBe('dark');
  });

  it('список режимов и таблицы подписей/иконок согласованы', () => {
    expect([...THEME_MODES]).toEqual(['dark', 'light', 'system']);
    expect(Object.keys(THEME_LABEL_KEY).sort()).toEqual([...THEME_MODES].sort());
    expect(Object.keys(THEME_ICON).sort()).toEqual([...THEME_MODES].sort());
  });
});
