import type { CommerceJournal, PurchaseQuery } from './orders';

interface WelcomeWait {
  version: 1; query: PurchaseQuery; deadline: number;
  status: 'pending' | 'timed-out' | 'paid' | 'restored' | 'failed' | 'revoked';
}

export function startWelcomeWait(query: PurchaseQuery, at: number, timeoutSeconds: number): WelcomeWait {
  const deadline = at + Math.max(5, timeoutSeconds) * 1000;
  if (!query.accountId || !query.binding.sku || !query.invoiceId || !Number.isSafeInteger(at) || at < 0 || !Number.isSafeInteger(deadline)) {
    throw Error('Invalid Welcome purchase UI context');
  }
  return { version: 1, query: structuredClone(query), deadline, status: 'pending' };
}

/** Restores display state only. Rights and duplicate receipts belong to the existing P23 reconciler. */
export function welcomePurchaseUi(wait: WelcomeWait, at: number, journal?: CommerceJournal, restored = false): WelcomeWait {
  const { binding, accountId, invoiceId } = wait.query;
  const order = journal?.orders.find(entry => entry.sku === binding.sku && entry.invoiceId === invoiceId &&
    entry.accountId === accountId && entry.provider === binding.provider && entry.appId === binding.appId &&
    entry.storeProductId === binding.storeProductId && entry.price.currency === binding.price.currency &&
    entry.price.minorUnits === binding.price.minorUnits && entry.seasonId === binding.seasonId && entry.effectiveAt <= at);
  if (order?.status === 'refunded') return { ...wait, status: 'revoked' };
  if (order?.status === 'paid' && order.grant) {
    return { ...wait, status: restored || wait.status === 'restored' ? 'restored' : 'paid' };
  }
  if (order?.status === 'cancelled') return { ...wait, status: 'failed' };
  if (wait.status === 'pending' && at >= wait.deadline) return { ...wait, status: 'timed-out' };
  return wait;
}
