/** Адаптер покупок (спеки 53, 62, 53б) — ЕДИНСТВЕННЫЙ файл с импортом react-native-purchases.
 *  Экраны и хук синхронизации говорят только с ним; веб получает purchases.web.ts (без SDK,
 *  приём pushes.web.ts). Метро выбирает файл по суффиксу — dev-сервер веба после появления
 *  .web.ts перезапускать с --clear (урок 06б).
 *
 *  Живой магазин есть только в нативной сборке с ключом (purchasesAvailable): в Expo Go SDK
 *  уходит в Preview API Mode, но `configure` с боевым ключом бросает, а на вебе продукты
 *  недоступны — там адаптер ведёт себя как заглушка 62: [] / 'unavailable' / null, экран
 *  рисует «скоро». Так же ведёт себя сборка без ключа — деградация честная, без падения.
 *
 *  Правило спеки 62: пейвол не показывает цену, которой не назвал магазин, и не предлагает
 *  кнопку, которая не может купить. Цен и идентификаторов продуктов здесь нет: пакеты —
 *  offering.annual / offering.monthly, право — entitlement «premium» (purchasesMap). */
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import type { PlanId, PremiumState } from './premium';
import { apiKey, isExpoGo, platform } from './purchasesEnv';
import { purchasesAvailable, toOffers, toPremium, type Offer } from './purchasesMap';

export type { PlanId } from './premium';
export type { Offer } from './purchasesMap';

export type PurchaseResult =
  | { ok: true; premium: PremiumState }
  /** none — только у restore: магазин ответил, активной подписки у аккаунта нет */
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'error' | 'none' };

const KEY = apiKey();
export const PURCHASES_AVAILABLE = purchasesAvailable({ platform, expoGo: isExpoGo(), apiKey: KEY });

/** Страница подписок магазина, если SDK не дал managementURL (аккаунт без покупок). */
const MANAGE_FALLBACK =
  platform === 'android'
    ? 'https://play.google.com/store/account/subscriptions?package=app.arcanum.tarot'
    : 'https://apps.apple.com/account/subscriptions';

let configured = false;
/** configure — синхронный и ровно один раз; повторный вызов SDK считает ошибкой. Флаг поднимаем
 *  ПОСЛЕ успешного вызова: между проверкой и вызовом нет await, гонки нет, а если configure
 *  бросит — модуль не должен навсегда решить, что настроен, и запереть себе следующую попытку. */
export async function init(): Promise<void> {
  if (!PURCHASES_AVAILABLE || configured) return;
  Purchases.configure({ apiKey: KEY as string });
  configured = true;
  await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
}

async function packageFor(id: PlanId): Promise<PurchasesPackage | null> {
  const current = (await Purchases.getOfferings()).current;
  return (id === 'year' ? current?.annual : current?.monthly) ?? null;
}

/** Предложения магазина; сбой сети, страна без продаж, неодобренный продукт — [] («скоро», 62 Д1). */
export async function getOffers(): Promise<Offer[]> {
  if (!PURCHASES_AVAILABLE) return [];
  try {
    await init();
    return toOffers((await Purchases.getOfferings()).current);
  } catch {
    return [];
  }
}

export async function purchase(id: PlanId): Promise<PurchaseResult> {
  if (!PURCHASES_AVAILABLE) return { ok: false, reason: 'unavailable' };
  try {
    await init();
    const pkg = await packageFor(id);
    if (!pkg) return { ok: false, reason: 'error' };
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { ok: true, premium: toPremium(customerInfo) };
  } catch (e) {
    // закрытый лист оплаты — не ошибка: экран молчит (спека 53б, решение 10)
    return { ok: false, reason: (e as { userCancelled?: boolean }).userCancelled ? 'cancelled' : 'error' };
  }
}

export async function restore(): Promise<PurchaseResult> {
  if (!PURCHASES_AVAILABLE) return { ok: false, reason: 'unavailable' };
  try {
    await init();
    const premium = toPremium(await Purchases.restorePurchases());
    return premium.active ? { ok: true, premium } : { ok: false, reason: 'none' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** null — источника нет или SDK не ответил (стор не трогать, mergeEntitlement решит по until);
 *  PREMIUM_NONE — ответил «не куплено». */
export async function refreshEntitlement(): Promise<PremiumState | null> {
  if (!PURCHASES_AVAILABLE) return null;
  try {
    await init();
    return toPremium(await Purchases.getCustomerInfo());
  } catch {
    return null;
  }
}

/** Push от SDK: покупка, продление, отмена, восстановление. Вызывать после init(). */
export function onEntitlementChange(cb: (premium: PremiumState) => void): () => void {
  if (!PURCHASES_AVAILABLE) return () => undefined;
  const listener = (info: CustomerInfo) => cb(toPremium(info));
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

export async function manageUrl(): Promise<string | null> {
  if (!PURCHASES_AVAILABLE) return null;
  try {
    await init();
    return (await Purchases.getCustomerInfo()).managementURL ?? MANAGE_FALLBACK;
  } catch {
    return MANAGE_FALLBACK;
  }
}
