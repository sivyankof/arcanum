/** Синхронизация права Premium с магазином (спека 53б). Живёт в корневом layout, один раз.
 *  Три точки: монтирование (старт), возврат из фона (правило 10: истечение подписки — тоже
 *  временнóе, useFocusEffect его не ловит) и push SDK (покупка, продление, отмена).
 *  Без магазина (Expo Go, веб, нет ключа) — no-op: адаптер отдаёт заглушки, стор не трогается,
 *  DEV-право тумблера живёт как жило. */
import React from 'react';
import { useApp } from '../store/useApp';
import { localDateISO } from './dates';
import type { PremiumState } from './premium';
import { init, onEntitlementChange, refreshEntitlement } from './purchases';
import { mergeEntitlement, samePremium } from './purchasesMap';
import { useAppActive } from './useAppActive';

/** Ответ магазина (или его отсутствие) → стор. Пишет только при реальной перемене: иначе каждый
 *  старт клал бы в persist одно и то же. */
export function applyEntitlement(fromStore: PremiumState | null): void {
  const { premium, setPremium } = useApp.getState();
  const next = mergeEntitlement(premium, fromStore, localDateISO());
  if (!samePremium(next, premium)) setPremium(next);
}

export function usePremiumSync(): void {
  React.useEffect(() => {
    let alive = true;
    let unsubscribe: () => void = () => undefined;
    let unsubHydration: () => void = () => undefined;
    (async () => {
      await init();
      if (!alive) return;
      unsubscribe = onEntitlementChange(applyEntitlement);
      const fromStore = await refreshEntitlement();
      if (!alive) return;
      // Этот эффект может отработать ДО конца гидрации persist (тот же приём-образец, что
      // app/_layout.tsx:46-50, — там по той же причине держат отдельную перепроверку hasHydrated).
      // Завершая гидрацию, persist сливает файл поверхностно: `set(merge(persisted, get()), true)`
      // отдаёт ключу `premium` содержимое ФАЙЛА, если запись из магазина легла раньше слияния —
      // «магазин говорит АКТИВНА, а в файле ещё НЕТ» тогда проживёт до следующего сворачивания
      // приложения. Поэтому первый ответ магазина применяем не раньше, чем гидрация кончится.
      if (useApp.persist.hasHydrated()) {
        applyEntitlement(fromStore);
      } else {
        unsubHydration = useApp.persist.onFinishHydration(() => {
          if (alive) applyEntitlement(fromStore);
        });
      }
    })().catch((err) => console.warn('[purchases] синхронизация права не удалась:', err));
    return () => {
      alive = false;
      unsubscribe();
      unsubHydration();
    };
  }, []);
  useAppActive(() => {
    refreshEntitlement()
      .then(applyEntitlement)
      .catch((err) => console.warn('[purchases] синхронизация права не удалась:', err));
  });
}
