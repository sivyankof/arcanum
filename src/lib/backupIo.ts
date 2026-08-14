/** Файловая часть бэкапа (спека 11) — единственный модуль, знающий про file-system,
 *  sharing и document-picker. Веб-реализация — backupIo.web.ts, Metro подставит сам
 *  (приём pushes.web.ts). Формат и валидация — в чистом backup.ts. */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Пишет JSON во временный файл и открывает системный share sheet. */
export async function shareBackup(json: string, fileName: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing is not available');
  const file = new File(Paths.cache, fileName);
  // overwrite: без него повторный экспорт в тот же день упал бы на существующем файле
  file.create({ overwrite: true });
  file.write(json);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json', // Android: тип для Intent
    UTI: 'public.json',           // iOS: тип для share sheet
  });
}

/** Системный выбор файла и чтение его текста. null — выбор отменён. */
export async function pickBackupText(): Promise<string | null> {
  // фильтр по MIME не ставим: iOS сопоставляет .json с public.json/public.data ненадёжно,
  // и файлы в пикере оказываются серыми (expo/expo#8029) — пропускаем всё,
  // содержимое всё равно валидирует parseBackup
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  if (res.canceled) return null;
  return new File(res.assets[0].uri).text();
}
