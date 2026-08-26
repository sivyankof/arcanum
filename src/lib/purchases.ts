/** Адаптер покупок (спеки 53, 62). Экраны говорят только с этим модулем; в 53б он получает
 *  реализацию на RevenueCat (`react-native-purchases` — нативный модуль, в Expo Go не работает;
 *  тогда же появится `purchases.web.ts` — заглушка без нативного импорта, приём `pushes.web.ts`,
 *  и dev-сервер веба обязан быть перезапущен с --clear, чтобы увидеть новый файл — урок 06б).
 *
 *  Правило спеки 62: пейвол никогда не показывает цену, которой не назвал магазин, и не предлагает
 *  кнопку, которая не может купить. Поэтому без SDK (`PURCHASES_AVAILABLE === false`) `getOffers`
 *  отдаёт ПУСТОЙ список, а экран рисует состояние «скоро». Плейсхолдерных цен задачи 53а
 *  здесь больше нет: фолбэк на выдуманную цену пережил бы 53б (магазин не ответил — показали
 *  рубли). Витрина с ценами до 53б живёт только в макете (`v-paywall`, состояние А).
 *
 *  ⚠️ Для 53б (спека 53, раздел «Цены и валюта»): `price` приходит ГОТОВОЙ строкой магазина
 *  (`product.priceString` через RevenueCat) — валюту выбирает страна аккаунта магазина, а не язык
 *  приложения, и форматировать число самим нельзя (у Hermes на телефоне урезанный ICU, урок hf-02);
 *  `discount` считается из фактической пары «год / месяц × 12», а не константой: ценовые уровни
 *  Apple и Google по странам непропорциональны. Тип `price: string` менять не придётся. */
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

/** Предложения магазина. Без SDK — []; в 53б: `getOfferings()` RevenueCat, а сбой сети, страна
 *  без продаж и неодобренный продукт — тот же [] (экран показывает «скоро», спека 62, Д1). */
export async function getOffers(): Promise<Offer[]> {
  return [];
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
