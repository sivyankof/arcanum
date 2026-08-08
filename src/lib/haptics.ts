/** Тактильный отклик по событиям (пункт 8 motion-spec).
 *  Heavy — только переворот карты дня; Light — переключение табов и фильтров;
 *  Success — завершение урока и 7-й день серии. На скролле — никогда.
 *  Вся вибрация в приложении идёт через эти функции, напрямую expo-haptics не дёргаем. */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

const fire = (run: () => Promise<void>) => {
  if (supported) run().catch(() => {}); // на устройствах без вибромотора просто молчим
};

/** Лёгкое касание: смена таба, фильтра, сегмента. */
export const hapticTap = () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** Сильный отклик: только момент переворота карты дня. */
export const hapticReveal = () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));

/** Успех: завершённый урок, 7-й день серии. */
export const hapticSuccess = () =>
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** Отказ: тап по заблокированному уроку. */
export const hapticWarning = () =>
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
