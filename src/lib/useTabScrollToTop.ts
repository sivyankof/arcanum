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
  getParent: () => TabNavigation | undefined;
};

export function useTabScrollToTop(scrollToTop: () => void) {
  const nav = useNavigation() as unknown as TabNavigation;

  // `tabPress` эмитит таб-навигатор на СВОЙ маршрут; экран внутри вложенного стека (список
  // раскладов, спека 36) получает навигацию стека, поэтому подписываемся по всей цепочке
  // родителей — как useScrollToTop React Navigation. Фокус проверяем у самого экрана: при
  // открытом раскладе список не сфокусирован и к началу не едет
  React.useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    let current: TabNavigation | undefined = nav;
    while (current) {
      unsubscribes.push(current.addListener('tabPress', () => { if (nav.isFocused()) scrollToTop(); }));
      current = current.getParent();
    }
    return () => unsubscribes.forEach((u) => u());
  }, [nav, scrollToTop]);
}

/** То, что умеет прокручиваться к началу: у списков это `scrollToOffset`, у ScrollView — `scrollTo`. */
type Scrollable = {
  scrollToOffset?: (params: { offset: number; animated?: boolean | null }) => void;
  scrollTo?: (params: { y?: number; animated?: boolean }) => void;
};

/** Готовый ref для экрана таба: вешает прокрутку к началу по повторному тапу и возвращает ref,
 *  который остаётся передать списку или ScrollView. Избавляет каждый таб от одинаковых пяти строк. */
export function useTabTopRef<T extends Scrollable>() {
  const ref = React.useRef<T>(null);

  useTabScrollToTop(
    React.useCallback(() => {
      const view = ref.current;
      if (!view) return;
      if (view.scrollToOffset) view.scrollToOffset({ offset: 0, animated: true });
      else view.scrollTo?.({ y: 0, animated: true });
    }, []),
  );

  return ref;
}
