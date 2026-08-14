/** Настройки приложения (logic-spec §7) и правило их слияния при обновлении.
 *
 *  Отдельный чистый модуль, а не часть стора: `zustand/persist` сливает сохранённое состояние
 *  с дефолтным ТОЛЬКО по верхнему уровню ключей, поэтому объект `settings` приходит из хранилища
 *  целиком — без полей, добавленных новой версией приложения. Дописывать недостающие ключи
 *  приходится руками (на этом уже спотыкались в 06а), и дешевле проверить это тестом,
 *  чем установкой приложения поверх старой версии.
 */
export interface AppSettings {
  /** Вечерняя рефлексия: блок на «Сегодня» (06а) и вечерний пуш (06б). */
  reflectionOn: boolean;
  /** Наше согласие на напоминания. Системное разрешение — отдельно, у ОС. */
  pushesOn: boolean;
  /** Время утреннего напоминания, 'HH:MM'. */
  pushMorning: string;
  /** Время вечернего напоминания, 'HH:MM'. */
  pushEvening: string;
  /** Прелюдия разрешения уже показана — второй раз не спрашиваем (product-spec §1). */
  pushAsked: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  reflectionOn: true,
  pushesOn: true,
  pushMorning: '09:00',
  pushEvening: '21:00',
  pushAsked: false,
};

/** Дописывает ключи, которых не было в сохранённой версии. */
export function mergeSettings(saved?: Partial<AppSettings> | null): AppSettings {
  return { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
}

/** 'HH:MM' → {hour, minute}. Непарсимое значение откатывается к запасному часу:
 *  испорченная запись в хранилище не должна ронять планировщик. */
export function parseHHMM(value: string, fallbackHour: number): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');
  if (!m) return { hour: fallbackHour, minute: 0 };
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return { hour: fallbackHour, minute: 0 };
  return { hour, minute };
}

/** {9, 0} → '09:00' — формат хранения. */
export function formatHHMM(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** '09:00' → '9:00' — формат показа в строке настроек (в макете «9:00 · 21:00»). */
export function timeLabel(value: string): string {
  const { hour, minute } = parseHHMM(value, 9);
  return `${hour}:${String(minute).padStart(2, '0')}`;
}
