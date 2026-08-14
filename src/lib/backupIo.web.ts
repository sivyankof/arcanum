/** Веб-версия файловой части бэкапа: экспорт — скачивание файла, импорт — <input type="file">.
 *  Ни одного импорта expo — чтобы веб-бандл не тянул нативные модули (приём pushes.web.ts). */

export async function shareBackup(json: string, fileName: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function pickBackupText(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      f.text().then(resolve, () => resolve(null));
    };
    // отмену диалога современные браузеры отдают событием cancel; где его нет,
    // промис просто остаётся висеть — экран ничего не ждёт в подвешенном состоянии
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
