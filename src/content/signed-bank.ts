import type { StorageAdapter } from '@danilah/mini-games-kit/platform';
import { applyBoard, assertBoard } from '../domain/engine';
import type { BoardCommand, Deal } from '../domain/types';

export interface SignedBank { manifest: string; payload: string; signature: string }
interface VerifiedBank { revision: number; wire: SignedBank; deals: readonly Deal[] }
interface StoredBank { schema: 1; active: number; highWater: number; banks: SignedBank[] }

const enc = new TextEncoder();
const MAX_MANIFEST = 1024;
const MAX_PAYLOAD = 650_000;
const MAX_DEALS = 20;
const MAX_PATH = 512;
const safeToken = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(value);
const natural = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function isCommand(command: BoardCommand, deal: Deal): boolean {
  if (!command || typeof command !== 'object') return false;
  if (command.type === 'draw' || command.type === 'recycle') return true;
  if (command.type !== 'transfer') return false;
  const legal = (location: typeof command.from, source: boolean) => {
    if (!location || !natural(location.index)) return false;
    if (location.kind === 'tableau') return location.index < deal.initial.tableau.length;
    if (location.kind === 'foundation') return !source && location.index < deal.initial.foundations.length;
    return location.kind === 'waste' && source && location.index === 0;
  };
  return legal(command.from, true) && legal(command.to, false);
}

function isRemoteDeal(deal: Deal, revision: number): boolean {
  if (!deal || !natural(deal.campaignLevel) || deal.campaignLevel <= 80 ||
    deal.id !== `campaign-c8-remote-r${revision}-${deal.campaignLevel}` || deal.version !== 1 ||
    typeof deal.title !== 'string' || !deal.title.trim() || deal.title.length > 100 ||
    !deal.initial || deal.initial.rulesVersion !== 3 || deal.initial.phase !== 'playing' ||
    !natural(deal.initial.movesLeft) || deal.initial.movesLeft === 0 ||
    !Array.isArray(deal.initial.tableau) || !Array.isArray(deal.initial.foundations) ||
    deal.initial.tableau.length < 2 || deal.initial.tableau.length > 5 ||
    deal.initial.foundations.length < 2 || deal.initial.foundations.length > 5 ||
    deal.daily || deal.lock || deal.frozen || deal.bound || deal.puzzle || deal.golden || deal.starter || deal.shufflePreview ||
    deal.bonusSlots || deal.training || !deal.cards || typeof deal.cards !== 'object' ||
    !Array.isArray(deal.winningPath) || !deal.winningPath.length || deal.winningPath.length > MAX_PATH ||
    deal.legacyWinningPath || deal.recoveryPaths || deal.tutorialPath || deal.legacyTutorialPath ||
    (deal.tags !== undefined && (!Array.isArray(deal.tags) || !deal.tags.every(safeToken)))) return false;

  const entries = Object.entries(deal.cards);
  if (!entries.length || entries.length > 200 || entries.some(([id, card]) => !safeToken(id) || !card || card.id !== id ||
    !safeToken(card.category) || !Object.hasOwn(deal.cards, card.category) || typeof card.text !== 'string' ||
    !card.text.trim() || card.text.length > 100 || typeof card.explanation !== 'string' || card.explanation.length > 420 ||
    (card.leader !== undefined && typeof card.leader !== 'boolean') ||
    card.ordered || card.rank || card.keyId ||
    (card.image !== undefined && (typeof card.image !== 'string' || !/^art\/generated\/[a-z0-9_-]+\.webp$/.test(card.image))))) return false;

  assertBoard(deal.initial, deal);
  let board = deal.initial;
  for (const command of deal.winningPath) {
    if (!isCommand(command, deal)) return false;
    const next = applyBoard(board, command, deal);
    if (typeof next === 'string') return false;
    board = next.board;
  }
  return board.phase === 'won';
}

export async function verifySignedBank(wire: SignedBank, publicKey: CryptoKey, subtle = crypto.subtle): Promise<VerifiedBank | undefined> {
  try {
    if (!wire || typeof wire.manifest !== 'string' || wire.manifest.length > MAX_MANIFEST ||
      typeof wire.payload !== 'string' || wire.payload.length > MAX_PAYLOAD ||
      typeof wire.signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(wire.signature)) return;
    const manifest = JSON.parse(wire.manifest);
    if (!manifest || manifest.schema !== 1 || manifest.product !== 'asoc-solitaire' ||
      !natural(manifest.revision) || manifest.revision === 0 ||
      !/^[a-f0-9]{64}$/.test(manifest.sha256)) return;
    const signature = Uint8Array.from(atob(wire.signature), value => value.charCodeAt(0));
    if (!await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, signature, enc.encode(wire.manifest))) return;
    const bytes = enc.encode(wire.payload);
    if (bytes.byteLength > MAX_PAYLOAD) return;
    const hash = Array.from(new Uint8Array(await subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== manifest.sha256) return;

    const deals = JSON.parse(wire.payload);
    if (!Array.isArray(deals) || !deals.length || deals.length > MAX_DEALS ||
      !deals.every(deal => isRemoteDeal(deal, manifest.revision)) ||
      new Set(deals.map(deal => deal.campaignLevel)).size !== deals.length) return;
    return { revision: manifest.revision, wire: { ...wire }, deals };
  } catch { return undefined; }
}

export class SignedBankCache {
  private tail: Promise<unknown> = Promise.resolve();
  private banks: VerifiedBank[] = [];
  private active = 0;
  private highWater = 0;
  private loaded = false;
  private readonly key = 'asoc-solitaire.content-banks.v1';

  constructor(private readonly disk: StorageAdapter, private readonly publicKey: CryptoKey) {}

  private serial<T>(run: () => Promise<T>): Promise<T> {
    const task = this.tail.then(run);
    this.tail = task.catch(() => undefined);
    return task;
  }

  open() {
    return this.serial(() => this.hydrate());
  }

  private async hydrate(): Promise<boolean> {
    if (this.loaded) return true;
    let raw: string | null;
    try { raw = await this.disk.getItem(this.key); }
    catch { return false; }
    this.loaded = true;
    if (raw === null) return true;
    try {
      const saved: StoredBank = JSON.parse(raw);
      if (!saved || saved.schema !== 1 || !Array.isArray(saved.banks) || !natural(saved.active) || !natural(saved.highWater)) return true;
      const banks: VerifiedBank[] = [];
      for (const wire of saved.banks) {
        const bank = await verifySignedBank(wire, this.publicKey);
        if (bank && !banks.some(previous => previous.revision === bank.revision)) banks.push(bank);
      }
      this.banks = banks;
      const newest = Math.max(0, ...banks.map(bank => bank.revision));
      this.highWater = Math.max(newest, saved.highWater);
      this.active = saved.active === 0 || banks.some(bank => bank.revision === saved.active) ? saved.active : newest;
    } catch { /* Invalid remote cache does not affect the published local bank. */ }
    return true;
  }

  refresh(download: (signal: AbortSignal) => Promise<SignedBank>, timeoutMs = 1500): Promise<boolean> {
    return this.serial(async () => {
      if (!natural(timeoutMs) || timeoutMs === 0 || !await this.hydrate()) return false;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<undefined>(resolve => {
          timer = setTimeout(() => { resolve(undefined); controller.abort(); }, timeoutMs);
        });
        const wire = await Promise.race([download(controller.signal), timeout]);
        const next = wire && await verifySignedBank(wire, this.publicKey);
        if (!next || next.revision <= this.highWater) return false;
        return await this.persist([...this.banks, next], next.revision, next.revision);
      } catch { return false; }
      finally { clearTimeout(timer); }
    });
  }

  rollback(revision: number): Promise<boolean> {
    return this.serial(async () => {
      if (!await this.hydrate() || (revision !== 0 && !this.banks.some(bank => bank.revision === revision))) return false;
      return this.persist(this.banks, revision, this.highWater);
    });
  }

  private async persist(banks: VerifiedBank[], active: number, highWater: number): Promise<boolean> {
    const stored: StoredBank = { schema: 1, active, highWater, banks: banks.map(bank => bank.wire) };
    const raw = JSON.stringify(stored);
    try { await this.disk.setItem(this.key, raw); }
    catch {
      try { if (await this.disk.getItem(this.key) !== raw) return false; }
      catch { return false; }
    }
    this.banks = banks;
    this.active = active;
    this.highWater = highWater;
    return true;
  }

  findPinned(id: string): Deal | undefined {
    const deal = this.banks.flatMap(bank => bank.deals).find(deal => deal.id === id);
    return deal ? structuredClone(deal) : undefined;
  }

  chooseFresh(local: Deal): Deal {
    const selected = this.banks.find(bank => bank.revision === this.active)?.deals.find(deal => deal.campaignLevel === local.campaignLevel);
    return selected ? structuredClone(selected) : local;
  }
}
