/** Чистые преобразования ответов магазина в типы приложения (спека 53б). Ни SDK, ни react —
 *  всё под юнитами на фикстурах. Структурные типы *Like повторяют только нужные поля
 *  react-native-purchases (PurchasesOffering / CustomerInfo подходят им без кастов), чтобы
 *  тесты и веб-заглушка не тащили типы нативного пакета.
 *
 *  Правило спеки 53 «Цены и валюта»: строки цен (`priceString`, `pricePerMonthString`) отдаёт
 *  магазин уже отформатированными в валюте аккаунта покупателя — здесь их не собирают, не делят
 *  и не конвертируют (у Hermes урезанный ICU, урок hf-02). Считается только ПРОЦЕНТ скидки —
 *  из чисел, вниз, и только при полной паре в одной валюте: ценовые уровни по странам
 *  непропорциональны, константа «−40 %» в части регионов врала бы. */
import { localDateISO } from './dates';
import { PREMIUM_NONE, type PlanId, type PremiumState } from './premium';

export interface Offer {
  id: PlanId;
  /** строка магазина, как есть */
  price: string;
  /** «в пересчёте на месяц» — только у годового и только если магазин прислал строку */
  perMonth?: string;
  /** процент скидки годового против месячного ×12; нет — бейдж не рисуется */
  discountPct?: number;
}

export interface ProductLike {
  identifier: string;
  price: number;
  priceString: string;
  currencyCode: string;
  pricePerMonth: number | null;
  pricePerMonthString: string | null;
}
export interface PackageLike {
  product: ProductLike;
}
export interface OfferingLike {
  annual: PackageLike | null;
  monthly: PackageLike | null;
}
export interface EntitlementLike {
  productIdentifier: string;
  /** Базовый план Google (`month`/`year`): на Android SDK кладёт в productIdentifier только id
   *  подписки (`premium`), а план — сюда; на iOS и у потребляемых — null (док SDK). */
  productPlanIdentifier?: string | null;
  expirationDate: string | null;
  willRenew: boolean;
}
export interface CustomerInfoLike {
  entitlements: { active: Record<string, EntitlementLike> };
}

/** Идентификатор права в RevenueCat — единственная константа каталога в коде. */
export const ENTITLEMENT_ID = 'premium';
/** Ниже этого процента бейдж скидки не рисуется: «−2 %» — шум, не аргумент. */
export const MIN_DISCOUNT_PCT = 5;

/** Живой магазин есть только в нативной сборке с ключом. В Expo Go SDK переходит в Preview API
 *  Mode, но `configure` с боевым ключом бросает — поэтому Expo Go считается «магазина нет». */
export function purchasesAvailable(p: { platform: string; expoGo: boolean; apiKey: string | undefined }): boolean {
  return (p.platform === 'ios' || p.platform === 'android') && !p.expoGo && !!p.apiKey;
}

export function discountPercent(
  annualPerMonth: number | null,
  monthlyPrice: number | null,
  sameCurrency: boolean,
): number | undefined {
  if (!sameCurrency || annualPerMonth === null || monthlyPrice === null) return undefined;
  if (!(annualPerMonth > 0) || !(monthlyPrice > 0)) return undefined;
  const pct = Math.floor((1 - annualPerMonth / monthlyPrice) * 100);
  return pct >= MIN_DISCOUNT_PCT ? pct : undefined;
}

/** Предложения экрана: годовой первым (экран выбирает его по умолчанию), затем месячный.
 *  Нет пары — нет витрины: экран покажет «скоро», а не половину тарифов. */
export function toOffers(offering: OfferingLike | null): Offer[] {
  const annual = offering?.annual?.product;
  const monthly = offering?.monthly?.product;
  if (!annual || !monthly) return [];
  const year: Offer = { id: 'year', price: annual.priceString };
  if (annual.pricePerMonthString) year.perMonth = annual.pricePerMonthString;
  const pct = discountPercent(annual.pricePerMonth, monthly.price, annual.currencyCode === monthly.currencyCode);
  if (pct !== undefined) year.discountPct = pct;
  return [year, { id: 'month', price: monthly.priceString }];
}

/** Тариф по идентификатору продукта: Google `premium:year`, Apple `premium.year`, пакет `$rc_annual`. */
export function planOf(productIdentifier: string): PlanId | null {
  if (/year|annual/i.test(productIdentifier)) return 'year';
  if (/month/i.test(productIdentifier)) return 'month';
  return null;
}

/** Право из ответа магазина. Нет активного entitlement → PREMIUM_NONE (это «ответил: не куплено»,
 *  а не «не ответил» — за второе отвечает null у refreshEntitlement в адаптере). `until` —
 *  локальная дата: formatFullDate разбирает только YYYY-MM-DD. */
export function toPremium(info: CustomerInfoLike): PremiumState {
  const e = info.entitlements.active[ENTITLEMENT_ID];
  if (!e) return PREMIUM_NONE;
  return {
    active: true,
    source: 'store',
    until: e.expirationDate ? localDateISO(new Date(e.expirationDate)) : null,
    // Android: `premium` + `month` → `premium:month` (лайв 28.08: без плана панель теряла название тарифа)
    plan: planOf([e.productIdentifier, e.productPlanIdentifier].filter(Boolean).join(':')),
    willRenew: e.willRenew,
  };
}

/** Слияние ответа магазина с правом в сторе (спека 53б, решение 7): DEV-право магазин не трогает;
 *  ответ есть — он и есть правда; ответа нет (SDK бросил) — store-право доживает до `until`,
 *  дальше снимается локально (при следующем удачном ответе вернётся, если продлилось). */
export function mergeEntitlement(current: PremiumState, fromStore: PremiumState | null, todayISO: string): PremiumState {
  if (current.source === 'dev') return current;
  if (fromStore !== null) return fromStore;
  const expired = current.source === 'store' && current.until !== null && current.until < todayISO;
  return expired ? PREMIUM_NONE : current;
}

/** Равенство по полям — чтобы синхронизация не писала в persist одно и то же на каждом старте. */
export function samePremium(a: PremiumState, b: PremiumState): boolean {
  return a.active === b.active && a.source === b.source && a.until === b.until && a.plan === b.plan && a.willRenew === b.willRenew;
}
