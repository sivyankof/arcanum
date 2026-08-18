/** Просмотр сохранённого расклада из дневника (спека 36): корневой стек, а не вложенный в таб —
 *  иначе тап в профиле переключал бы таб на «Расклады», а «назад» вёл бы в список, не в дневник. */
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { SpreadScreen } from '../../src/components/SpreadScreen';
import { spreadById } from '../../src/lib/content';
import { useApp } from '../../src/store/useApp';

export default function SpreadViewRoute() {
  const { ts } = useLocalSearchParams<{ ts: string }>();
  const saved = useApp((s) => s.spreadsHistory.find((d) => d.ts === Number(ts)));
  const spread = saved ? spreadById.get(saved.spreadId) : undefined;

  // записи нет (уехала за лимит 100 или сменилась импортом, пока экран был в стеке) — назад без
  // диалогов; но при прямом заходе по адресу (веб-проверка, перезагрузка вкладки) стек пуст —
  // возвращаться некуда, и router.back() молча ничего не сделал бы, оставив пустой экран навсегда
  React.useEffect(() => {
    if (saved && spread) return;
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  }, [saved, spread]);

  if (!saved || !spread) return null;
  return <SpreadScreen spread={spread} mode="view" saved={saved} />;
}
