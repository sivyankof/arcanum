/** Гейт ухода с несохранённого экрана (спека 05: `app/note/[date].tsx`; спека 36: `SpreadScreen`).
 *  Пока экран «грязный» (dirty), перехватывает кнопку «назад», нативный свайп-жест и любую другую
 *  попытку снять экран со стека — и откладывает её до ответа пользователя в диалоге. Сам диалог
 *  остаётся на экране — подписи «Уйти без сохранения?» у заметки и расклада разные.
 *
 *  ⚠️ Дефект с лайв-проверки: ручной `navigation.addListener('beforeRemove', …)` + `e.preventDefault()`
 *  не успевает за нативным свайпом-назад на iOS — экран уже снят жестом к моменту, когда JS доезжает
 *  до `preventDefault()`, и получается рассогласование (натив считает экран ушедшим, JS — ещё живым;
 *  следующий вход на тот же маршрут переиспользует это состояние и диалог всплывает сам). Лечение —
 *  `usePreventRemove` (React Navigation 7, `@react-navigation/native`, реэкспорт из `core`): у native
 *  stack (`@react-navigation/native-stack` → `NativeStackView`) он пробрасывает наш булев флаг в проп
 *  `preventNativeDismiss` самого экрана, а react-native-screens на iOS этим пропом блокирует
 *  незавершённый свайп НА НАТИВНОМ СЛОЕ — до всякого JS расхождения взяться неоткуда.
 *
 *  ⚠️ Внутренний слушатель `usePreventRemove` вызывает `e.preventDefault()` БЕЗУСЛОВНО, как только
 *  первый аргумент (`preventRemove`) истинный — наш колбэк не может «пропустить» одну конкретную
 *  попытку. Единственный способ довести действие до цели — передиспетчить его самим, а это сработает
 *  только когда `preventRemove` уже ЛОЖЬ (иначе тот же перехват сработает на передиспетч рекурсивно
 *  и уронит стек вызовов). Поэтому «уходим» — состояние (`leaving`), а не только ref: булев аргумент
 *  хука обязан обновиться РЕНДЕРОМ, и лишь на следующем рендере эффект ниже передиспетчит ИМЕННО то
 *  действие, которое попытался сделать пользователь (кнопка, свайп, popToTop), а не голый
 *  `router.back()`. `leavingRef` — синхронная половина: `markLeaving()` мгновенно решает, показывать
 *  ли диалог ПРЯМО в момент первой (обязательно перехваченной) попытки — вызов `markLeaving()` и
 *  последующая навигация экрана происходят синхронно в одном тике, а состояние до этого момента
 *  ещё не долетело (React батчит `markLeaving(); …; router.back()` в один проход).
 *
 *  ⚠️ `Alert.alert` в react-native-web — пустая заглушка: системный алерт не показался бы вовсе,
 *  а задержанный уход не снялся бы никогда. Подтверждение — `ConfirmDialog`, а не `Alert`.
 */
import { usePreventRemove } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import React from 'react';

export function useLeaveGuard(dirty: boolean) {
  const navigation = useNavigation();
  const [asking, setAsking] = React.useState(false);
  // действие навигации, задержанное вопросом «уйти без сохранения?» — ждёт передиспетчеризации
  const pending = React.useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);
  // синхронная половина «уходим без вопроса»: читается ВНУТРИ колбэка usePreventRemove в момент
  // самой первой (обязательно перехваченной) попытки, ref обновляется мгновенно — state ниже ещё нет
  const leavingRef = React.useRef(false);
  // реактивная половина: гасит preventRemove на СЛЕДУЮЩЕМ рендере (см. комментарий к файлу)
  const [leaving, setLeaving] = React.useState(false);

  usePreventRemove(dirty && !leaving, (e) => {
    pending.current = e.data.action;
    if (!leavingRef.current) setAsking(true);
  });

  // preventRemove погас после markLeaving()/onConfirm() — довершаем ИМЕННО ту попытку, что была
  // перехвачена (кнопка, свайп, popToTop), а не произвольный router.back()
  React.useEffect(() => {
    if (!leaving || !pending.current) return;
    const action = pending.current;
    pending.current = null;
    navigation.dispatch(action);
  }, [leaving, navigation]);

  // экран сам ведёт наружу (например, «Сохранить» сразу зовёт router.back()) — пометить уход
  // разрешённым ДО собственной навигации; state триггерит рендер, дальше уход доведёт эффект выше
  const markLeaving = React.useCallback(() => {
    leavingRef.current = true;
    setLeaving(true);
  }, []);

  const onCancel = React.useCallback(() => setAsking(false), []);
  const onConfirm = React.useCallback(() => {
    setAsking(false);
    markLeaving();
  }, [markLeaving]);

  return { asking, onCancel, onConfirm, markLeaving };
}
