/** Веб-версия адаптера покупок — заглушка 62 БЕЗ единого импорта react-native-purchases:
 *  на вебе продуктов и покупок нет, а сам импорт SDK тянул бы его в веб-бандл (приём
 *  pushes.web.ts). Сигнатуры — те же, что у purchases.ts (параметры типизированы и оставлены
 *  на месте с подчёркиванием, образец — pushes.web.ts): `tsc` не сверяет .web.ts с потребителями
 *  (в tsconfig.json нет moduleSuffixes), поэтому забытый параметр здесь не поймает компилятор —
 *  только контракт-тест purchasesWeb.test.ts. */
import type { PlanId, PremiumState } from './premium';
import type { Offer } from './purchasesMap';

export type { PlanId } from './premium';
export type { Offer } from './purchasesMap';
export type PurchaseResult =
  | { ok: true; premium: PremiumState }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'error' | 'none' };

export const PURCHASES_AVAILABLE = false;
export async function init(): Promise<void> {}
export async function getOffers(): Promise<Offer[]> {
  return [];
}
export async function purchase(_id: PlanId): Promise<PurchaseResult> {
  return { ok: false, reason: 'unavailable' };
}
export async function restore(): Promise<PurchaseResult> {
  return { ok: false, reason: 'unavailable' };
}
export async function refreshEntitlement(): Promise<PremiumState | null> {
  return null;
}
export function onEntitlementChange(_cb: (premium: PremiumState) => void): () => void {
  return () => undefined;
}
export async function manageUrl(): Promise<string | null> {
  return null;
}
