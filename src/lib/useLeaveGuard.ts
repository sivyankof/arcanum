/** Гейт ухода с несохранённого экрана (спека 05: `app/note/[date].tsx`; спека 36: `SpreadScreen`).
 *  Пока экран «грязный» (dirty), перехватывает кнопку «назад», свайп-жест и любую другую попытку
 *  снять экран со стека (`beforeRemove`) и откладывает её до ответа пользователя в диалоге.
 *  Сам диалог остаётся на экране — подписи «Уйти без сохранения?» у заметки и расклада разные.
 *
 *  ⚠️ `Alert.alert` в react-native-web — пустая заглушка: системный алерт не показался бы вовсе,
 *  а задержанный уход не снялся бы никогда. Подтверждение — `ConfirmDialog`, а не `Alert`.
 */
import { useNavigation } from 'expo-router';
import React from 'react';

export function useLeaveGuard(dirty: boolean) {
  const navigation = useNavigation();
  const [asking, setAsking] = React.useState(false);
  // действие навигации, задержанное вопросом «уйти без сохранения?»
  const pending = React.useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);
  // после явного сохранения/сброса экраном уход разрешён без вопросов
  const leaving = React.useRef(false);

  React.useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!dirty || leaving.current) return;
        e.preventDefault();
        pending.current = e.data.action;
        setAsking(true);
      }),
    [navigation, dirty],
  );

  // экран сам ведёт наружу (например, «Сохранить» сразу зовёт router.back()) — пометить уход
  // разрешённым ДО собственной навигации, чтобы beforeRemove её не перехватил
  const markLeaving = React.useCallback(() => {
    leaving.current = true;
  }, []);

  const onCancel = React.useCallback(() => setAsking(false), []);
  const onConfirm = React.useCallback(() => {
    setAsking(false);
    leaving.current = true;
    if (pending.current) navigation.dispatch(pending.current);
  }, [navigation]);

  return { asking, onCancel, onConfirm, markLeaving };
}
