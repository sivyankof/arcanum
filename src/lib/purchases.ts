/** Адаптер покупок (спека 53). В 53а — честная заглушка: react-native-purchases (RevenueCat) —
 *  нативный модуль, в Expo Go не работает, поэтому «оформить» и «восстановить» отвечают
 *  'unavailable', а экран показывает диалог «появится в сборке из стора». В 53б этот файл
 *  получает реализацию на RevenueCat (+ purchases.web.ts — заглушка для веба, приём pushes.web.ts);
 *  экраны и стор правок не потребуют — они говорят только с этим модулем.
 *  Цены — плейсхолдеры макета (master-plan §3.4), настоящие приедут из магазина в 53б. */
import type { PremiumState } from './premium';

export const PURCHASES_AVAILABLE = false;
export type PlanId = 'year' | 'month';
export interface Offer {
  id: PlanId;
  price: string;
  /** цена в пересчёте на месяц — только у годового */
  perMonth?: string;
  /** бейдж скидки — только у годового */
  discount?: string;
}
export type PurchaseResult =
  | { ok: true; premium: PremiumState }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'error' };

const PLACEHOLDER_OFFERS: Offer[] = [
  { id: 'year', price: '2 890 ₽', perMonth: '241 ₽', discount: '−40 %' },
  { id: 'month', price: '399 ₽' },
];

export async function getOffers(): Promise<Offer[]> {
  return PLACEHOLDER_OFFERS;
}
export async function purchase(_id: PlanId): Promise<PurchaseResult> {
  return { ok: false, reason: 'unavailable' };
}
export async function restore(): Promise<PurchaseResult> {
  return { ok: false, reason: 'unavailable' };
}
/** null — источника права нет (заглушка); 53б вернёт состояние из магазина. */
export async function refreshEntitlement(): Promise<PremiumState | null> {
  return null;
}
