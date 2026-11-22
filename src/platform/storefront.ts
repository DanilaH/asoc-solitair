import { Capacitor, registerPlugin } from '@capacitor/core';
import { PRODUCT_INDEX } from '../domain/commerce/catalog';
import { PurchaseReconciler, type CheckoutBinding, type PurchaseAuthority, type PurchaseOrder } from '../domain/commerce/orders';
import { rewardOfferState } from '../domain/reward-offers';
import { purchaseTaskSignal, recordTaskSignal } from '../domain/events/daily-tasks';
import type { CommercialContext } from '../domain/commerce/offer-policy';
import type { SaveStore } from './storage';

interface MerchantStatus { authorized: boolean; provider: string; appId: string; accountId: string; products: CheckoutBinding[]; context?: Partial<Pick<CommercialContext,'firstPlayedAt'|'birthdayOptInWindow'|'scheduledCampaign'|'rotation'>> }
interface Invoice { invoiceId: string; sku: string }
interface MerchantBridge {
  verify: PurchaseAuthority['verify'];
  acknowledge(options: { order: PurchaseOrder; purchaseType: 'consumable'|'nonConsumable' }): Promise<void>;
  status(): Promise<MerchantStatus>;
  checkout(binding: CheckoutBinding): Promise<Invoice | null>;
  restore(): Promise<Invoice[]>;
}

export function createStorefront(store: SaveStore) {
  const bridge = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('SolitaireCheckout')
    ? registerPlugin<MerchantBridge>('SolitaireCheckout') : undefined;
  let merchant: MerchantStatus | undefined;
  const bindingFor = (sku: string) => merchant?.products.find(binding => binding.sku === sku &&
    binding.provider === merchant?.provider && binding.appId === merchant.appId && PRODUCT_INDEX.has(sku) &&
    /^[A-Z]{3}$/.test(binding.price?.currency ?? '') && Number.isSafeInteger(binding.price.minorUnits) && binding.price.minorUnits > 0);
  const reconciler = () => bridge && merchant ? new PurchaseReconciler(store, { verify: query => bridge.verify(query), acknowledge: (order, purchaseType) => bridge.acknowledge({ order, purchaseType }) }, { accountId: merchant.accountId, bindingFor }) : undefined;
  async function credit() {
    if (!merchant) return;
    const { provider, accountId } = merchant;
    await store.mutate(save => {
      for (const order of save.commerce?.orders ?? []) {
        if (order.provider !== provider || order.accountId !== accountId || order.status !== 'paid' || !order.grant || !order.acknowledged || order.walletApplied) continue;
        const signal = purchaseTaskSignal(order, provider);
        if (signal && save.dailyTasks) recordTaskSignal(save, Date.now(), signal);
        creditWallet(save, order);
      }
    });
  }
  return {
    get context() { return merchant?.context; },
    get accountId() { return merchant?.accountId ?? ''; },
    bindingFor,
    async refresh() {
      const status = await bridge?.status().catch(() => undefined);
      merchant = status?.authorized === true && Array.isArray(status.products) && status.accountId && status.provider && status.appId ? status : undefined;
      await store.mutate(next => { if (merchant) next.commerceAccount = merchant.accountId; else delete next.commerceAccount; });
      await reconciler()?.recover();
      await credit();
    },
    async checkout(sku: string) {
      const binding = bindingFor(sku), app = reconciler();
      if (!bridge || !binding || !app) return false;
      const invoice = await bridge.checkout(binding);
      if (invoice?.sku !== sku) return false;
      const ready = await app.check(invoice);
      await credit();
      return ready !== 'ignored';
    },
    async restore() {
      const app = reconciler();
      if (!bridge || !app) return false;
      for (const invoice of await bridge.restore()) await app.check(invoice);
      await credit();
      return true;
    },
  };
}

function creditWallet(save: SaveStore['state'], order: PurchaseOrder) {
  if (order.walletApplied) return;
  const goods = PRODUCT_INDEX.get(order.sku)?.benefits;
  if (!goods) return;
  const increments = { coins: 0, hints: 0, undos: 0, jokers: 0 };
  let definitions = 0;
  for (const good of goods) {
    if (good.type !== 'charge') continue;
    switch (good.resource) {
      case 'coin': increments.coins += good.quantity; break;
      case 'hint': increments.hints += good.quantity; break;
      case 'undo': increments.undos += good.quantity; break;
      case 'joker': increments.jokers += good.quantity; break;
      case 'definition': definitions += good.quantity; break;
    }
  }
  for (const key of Object.keys(increments) as (keyof typeof increments)[]) {
    if (!Number.isSafeInteger(save.profile[key] + increments[key])) return;
  }
  for (const key of Object.keys(increments) as (keyof typeof increments)[]) save.profile[key] += increments[key];
  if (definitions) rewardOfferState(save).definitions += definitions;
  order.walletApplied = true;
  save.revision++;
}
