/** Повторный тап по уже активному табу прокручивает экран к началу (спека 04е).
 *
 *  Проверка `isFocused()` обязательна: событие `tabPress` прилетает и при переходе с другой
 *  вкладки, а там прокрутка к началу — лишнее движение. */
import { useNavigation } from 'expo-router';
import React from 'react';

/** `tabPress` не входит в публичные типы навигации expo-router (событие живёт в bottom-tabs),
 *  поэтому описываем ровно ту часть, которой пользуемся, вместо `any`. */
type TabNavigation = {
  addListener: (event: 'tabPress', cb: () => void) => () => void;
  isFocused: () => boolean;
};

export function useTabScrollToTop(scrollToTop: () => void) {
  const nav = useNavigation() as unknown as TabNavigation;

  React.useEffect(
    () =>
      nav.addListener('tabPress', () => {
        if (nav.isFocused()) scrollToTop();
      }),
    [nav, scrollToTop],
  );
}
