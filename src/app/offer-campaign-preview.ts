import { withBuiltinWelcome, createOfferCampaignDispatcher, OfferTrigger, type OfferEvent, type OfferCampaignDefinition } from '../domain/commerce/offer-campaigns';
import type { SaveStore } from '../platform/storage';

const base = {
  version: 1, revision: 'qa-local-v1', enabled: true, provenance: 'PRODUCT_ADAPTED',
  minLevel: 0, maxLevel: 0, minSession: 0, minInstallAgeSeconds: 0,
  lifetimeSeconds: 120, activationCooldownSeconds: 0, repeatShowCooldownSeconds: 0,
  maxTotalShows: 0, maxActivations: 0, maxShowsPerActivation: 0,
} as const;

export function mountOfferCampaignPreview(
  store: SaveStore,
  openDialog: (selector: string) => void,
  level: () => number,
  signal: AbortSignal,
) {
  const find = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const entry = find<HTMLButtonElement>('offer-campaign-preview-open');
  const sheet = find<HTMLDialogElement>('offer-campaign-preview');
  const status = find('offer-campaign-preview-status');
  const display = find<HTMLDialogElement>('context-offer-preview');
  const present = (handler: string, title: string, text: string) => () => {
    if (!sheet.open || display.open) return;
    return { reveal: () => {
      find('context-offer-title').textContent = title;
      find('context-offer-description').textContent = text;
      display.dataset.presenter = handler;
      openDialog('#context-offer-preview');
    } };
  };
  const welcome = { ...base, campaignId: 'welcome-qa', windowId: 'welcome_offer', skus: ['qa-welcome'] };
  const coins: OfferCampaignDefinition = { ...base, campaignId: 'coins-qa', windowId: 'boosters_coins_offer', skus: ['qa-coins'],
    priority: 100, activationTriggers: [OfferTrigger.OutOfCoins], displayTriggers: [OfferTrigger.OutOfCoins] };
  const hint: OfferCampaignDefinition = { ...base, campaignId: 'hint-qa', windowId: 'boosters_hint_offer', skus: ['qa-hint'],
    priority: 100, activationTriggers: [OfferTrigger.OutOfBooster], displayTriggers: [OfferTrigger.OutOfBooster] };
  const dispatch = createOfferCampaignDispatcher(store, {
    enabled: true, definitions: withBuiltinWelcome([coins, hint], welcome), presenters: {
      named: {
        welcome_offer: present('ShowWelcomeOffer', 'Добро пожаловать', 'Проверка приветственного предложения.'),
        boosters_coins_offer: present('ShowBoostersCoinsOffer', 'Монеты и помощники', 'Проверка предложения при нехватке монет.'),
        boosters_hint_offer: present('ShowBoostersHintOffer', 'Подсказки', 'Проверка предложения при нехватке подсказок.'),
      },
      fallback: present('Fallback', 'Предложение', 'Общий экран тестового предложения.'),
    },
  });
  const event = (trigger: 0 | 5 | 6): OfferEvent => {
    const common = { id: crypto.randomUUID(), at: Date.now(), accountId: 'qa-azur-context-offers', installedAt: 0, session: 1, level: level() };
    return trigger === 6 ? { ...common, trigger, booster: 'hint' } : { ...common, trigger };
  };
  entry.hidden = false;
  entry.addEventListener('click', () => { status.textContent = ''; openDialog('#offer-campaign-preview'); }, { signal });
  let busy = false;
  sheet.addEventListener('click', async click => {
    const button = (click.target as HTMLElement).closest<HTMLButtonElement>('button[data-offer-event]');
    if (!button || !sheet.open || busy) return;
    const kind = Number(button.dataset.offerEvent);
    if (kind !== 0 && kind !== 5 && kind !== 6) return;
    button.disabled = busy = true;
    try {
      const result = await dispatch(event(kind));
      status.textContent = result.status === 'presenter-accepted' ? '' : 'Подходящего предложения нет.';
    } catch {
      status.textContent = 'Не удалось сохранить показ. Повторите попытку.';
    } finally { button.disabled = busy = false; }
  }, { signal });
}
