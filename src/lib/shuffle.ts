/** Тасование Фишера–Йетса. Возвращает НОВЫЙ массив, вход не трогает. rng — параметр ради
 *  детерминированных тестов; в приложении Math.random (криптостойкость не нужна).
 *  Вынесен из spread.ts (спека 36), второй потребитель — сессия повторения (спека 45). */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
