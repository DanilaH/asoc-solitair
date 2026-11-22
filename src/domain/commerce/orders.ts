import { PRODUCT_INDEX, type ProductDefinition, type ProductGood } from './catalog';
import type { Save } from '../types';

interface OrderPrice { currency: string; minorUnits: number }
export interface CheckoutBinding {
  provider: string;
  appId: string;
  storeProductId: string;
  sku: string;
  price: OrderPrice;
  seasonId?: string;
}
export interface PurchaseQuery { accountId: string; invoiceId: string; binding: CheckoutBinding }
type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded';

export interface VerifiedPurchase {
  provider: string;
  appId: string;
  storeProductId: string;
  price: OrderPrice;
  accountId: string;
  invoiceId: string;
  purchaseId?: string;
  seasonId?: string;
  status: OrderStatus;
  sequence: number;
  effectiveAt: number;
  proofRef: string;
}

export interface PurchaseOrder extends VerifiedPurchase {
  schema: 1;
  sku: string;
  grant?: { id: string; issuedAt: number };
  acknowledged?: true;
  walletApplied?: true;
}
export interface CommerceJournal {
  version: 1;
  orders: PurchaseOrder[];
}

/** The authenticated provider adapter establishes this trust boundary. The client callback only selects an invoice. */
export interface PurchaseAuthority {
  verify(query: PurchaseQuery): Promise<VerifiedPurchase | undefined>;
  /** Repeated confirmations for the same provider invoice must be idempotent. */
  acknowledge(order: PurchaseOrder, purchaseType: ProductDefinition['purchaseType']): Promise<void>;
}

interface Store {
  readonly state: Save;
  mutate<T>(change: (next: Save) => T): Promise<T>;
}

const token = (value: unknown): value is string => typeof value === 'string' && /^[0-9A-Za-z_.:-]{1,128}$/.test(value);
const natural = (value: number) => Number.isSafeInteger(value) && value >= 0;
const validPrice = (price: OrderPrice) => Boolean(price && /^[A-Z]{3}$/.test(price.currency) &&
  natural(price.minorUnits) && price.minorUnits > 0);

const invoiceKey = ({ provider, appId, invoiceId }: Pick<PurchaseOrder, 'provider'|'appId'|'invoiceId'>) =>
  JSON.stringify([provider, appId, invoiceId]);
const purchaseKey = ({ provider, appId, purchaseId }: Pick<PurchaseOrder, 'provider'|'appId'|'purchaseId'>) =>
  JSON.stringify([provider, appId, purchaseId]);

function validProof(proof: VerifiedPurchase): boolean {
  return Boolean(proof && [proof.provider, proof.appId, proof.storeProductId, proof.accountId, proof.invoiceId, proof.proofRef].every(token) &&
    natural(proof.sequence) && natural(proof.effectiveAt) && validPrice(proof.price) &&
    ['pending', 'paid', 'cancelled', 'refunded'].includes(proof.status) &&
    (proof.seasonId === undefined || token(proof.seasonId)) &&
    (proof.purchaseId === undefined ? ['pending', 'cancelled'].includes(proof.status) : token(proof.purchaseId)));
}

function sameContract(order: VerifiedPurchase, query: PurchaseQuery): boolean {
  const { binding } = query;
  return order.provider === binding.provider && order.appId === binding.appId && order.storeProductId === binding.storeProductId &&
    order.invoiceId === query.invoiceId && order.accountId === query.accountId && order.seasonId === binding.seasonId &&
    order.price.currency === binding.price.currency && order.price.minorUnits === binding.price.minorUnits;
}

export function validCommerceJournal(value: CommerceJournal): boolean {
  if (!value || value.version !== 1 || !Array.isArray(value.orders)) return false;
  const invoices = new Set<string>(), purchases = new Set<string>();
  return value.orders.every(order => {
    if (!validProof(order) || order.schema !== 1 || !PRODUCT_INDEX.has(order.sku)) return false;
    const invoice = invoiceKey(order), purchase = purchaseKey(order);
    if (invoices.has(invoice) || (order.purchaseId && purchases.has(purchase))) return false;
    invoices.add(invoice);
    if (order.purchaseId) purchases.add(purchase);
    return (order.grant === undefined || (order.grant?.id === purchase && natural(order.grant.issuedAt) && order.purchaseId &&
      ['paid', 'refunded'].includes(order.status))) &&
      (order.acknowledged === undefined || order.acknowledged === true && order.grant !== undefined) &&
      (order.walletApplied === undefined || order.walletApplied === true && order.acknowledged === true);
  });
}

function applyObservation(save: Save, proof: VerifiedPurchase, query: PurchaseQuery): PurchaseOrder | undefined {
  const item = PRODUCT_INDEX.get(query.binding.sku);
  if (!item || !validProof(proof) || !validPrice(query.binding.price) || !sameContract(proof, query) ||
    (item.eligibility === 'once-per-season') !== Boolean(proof.seasonId)) return;
  const key = invoiceKey(proof);
  const state = save.commerce ?? { version: 1 as const, orders: [] };
  const previous = state.orders.find(order => invoiceKey(order) === key);
  if (previous && (!sameContract(previous, query) || previous.sku !== item.sku ||
    (previous.purchaseId && proof.purchaseId && previous.purchaseId !== proof.purchaseId))) return;
  if (proof.purchaseId && state.orders.some(order => invoiceKey(order) !== key && purchaseKey(order) === purchaseKey(proof))) return;
  if (previous && (proof.sequence <= previous.sequence || previous.status === 'refunded' || previous.status === 'cancelled')) return previous;
  if (previous?.status === 'paid' && proof.status !== 'paid' && proof.status !== 'refunded') return previous;

  const order: PurchaseOrder = {
    ...proof, schema: 1, sku: item.sku, ...(previous?.purchaseId ? { purchaseId: previous.purchaseId } : {}),
    ...(previous?.grant ? { grant: previous.grant } : {}), ...(previous?.acknowledged ? { acknowledged: true } : {}), ...(previous?.walletApplied ? { walletApplied: true } : {}),
  };
  const alreadyEntitled = item.eligibility !== 'repeatable' && state.orders.some(other => other.accountId === order.accountId &&
    other.sku === item.sku && other.seasonId === order.seasonId && other.status === 'paid' && other.grant !== undefined);
  if (proof.status === 'paid' && !order.grant && !alreadyEntitled) {
    order.grant = { id: purchaseKey(order), issuedAt: proof.effectiveAt };
  }
  save.commerce = { ...state, orders: [...state.orders.filter(entry => entry !== previous), order] };
  return order;
}

export interface ActiveGood { grantId: string; sku: string; good: ProductGood; seasonId?: string; expiresAt?: number }
export function activePurchaseGoods(journal: CommerceJournal | undefined, accountId: string, now: number, seasonId?: string): ActiveGood[] {
  if (!journal || !token(accountId) || !natural(now)) return [];
  const result: ActiveGood[] = [];
  for (const order of journal.orders) {
    if (order.status !== 'paid' || !order.grant || order.accountId !== accountId || order.grant.issuedAt > now) continue;
    for (const good of PRODUCT_INDEX.get(order.sku)?.benefits ?? []) {
      const expiresAt = good.type === 'unlimited' || good.type === 'vip' ? order.grant.issuedAt + good.durationMs : undefined;
      if (expiresAt !== undefined && (!natural(expiresAt) || now >= expiresAt)) continue;
      if ((good.type === 'pass' || good.type === 'piggy') && order.seasonId !== seasonId) continue;
      result.push({ grantId: order.grant.id, sku: order.sku, good, ...((good.type === 'pass' || good.type === 'piggy') ? { seasonId } : {}),
        ...(expiresAt === undefined ? {} : { expiresAt }) });
    }
  }
  return result;
}

interface CommerceSession {
  accountId: string;
  bindingFor(sku: string): CheckoutBinding | undefined;
}
interface OrderLookup { invoiceId: string; sku: string }

export class PurchaseReconciler {
  private readonly pendingAck = new Map<string, Promise<void>>();

  constructor(private readonly store: Store, private readonly authority: PurchaseAuthority, private readonly session: CommerceSession) {}

  recover() {
    const pending = this.store.state.commerce?.orders.filter(order => order.accountId === this.session.accountId &&
      (order.status === 'pending' || (order.status === 'paid' && !order.acknowledged))) ?? [];
    return Promise.allSettled(pending.map(order => this.check(order)));
  }

  async check({ invoiceId, sku: productKey }: OrderLookup): Promise<'ignored' | 'recorded' | 'acknowledged'> {
    const { accountId } = this.session;
    if (!token(accountId) || !token(invoiceId) || !PRODUCT_INDEX.has(productKey)) return 'ignored';
    const binding = this.session.bindingFor(productKey);
    if (!binding || binding.sku !== productKey || !validPrice(binding.price)) return 'ignored';
    const query = { accountId, invoiceId, binding };
    const observation = await this.authority.verify(query);
    if (!observation) return 'ignored';
    const recorded = await this.store.mutate(next => applyObservation(next, observation, query));
    if (!recorded) return 'ignored';
    const key = invoiceKey(recorded);
    const current = this.store.state.commerce?.orders.find(order => invoiceKey(order) === key);
    if (current?.status !== 'paid' || !current.grant) return 'recorded';
    if (current.acknowledged) return 'acknowledged';

    const sku = PRODUCT_INDEX.get(current.sku)!;
    let flight = this.pendingAck.get(key);
    if (!flight) {
      flight = Promise.resolve().then(async () => {
        const latest = this.store.state.commerce?.orders.find(order => invoiceKey(order) === key);
        if (latest?.status !== 'paid' || latest.grant?.id !== current.grant?.id || latest.acknowledged) return;
        await this.authority.acknowledge(latest, sku.purchaseType);
        await this.store.mutate(next => {
          const durable = next.commerce?.orders.find(order => invoiceKey(order) === key);
          if (durable?.status === 'paid' && durable.grant?.id === latest.grant?.id) durable.acknowledged = true;
        });
      }).finally(() => { this.pendingAck.delete(key); });
      this.pendingAck.set(key, flight);
    }
    try { await flight; } catch { return 'recorded'; }
    return this.store.state.commerce?.orders.some(order => invoiceKey(order) === key && order.acknowledged)
      ? 'acknowledged' : 'recorded';
  }
}
