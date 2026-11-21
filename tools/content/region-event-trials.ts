const positive = (value: number) => Number.isSafeInteger(value) && value > 0;
const natural = (value: number) => Number.isSafeInteger(value) && value >= 0;

interface RegionState {
  level: number; stars: number; built: readonly string[]; creditedWins: readonly string[]; completed: readonly string[];
}
interface RegionDefinition {
  id: string; level: number; buildings: readonly { id: string; stars: number; after?: string }[];
}
export function recordRegionWin(state: RegionState, receipt: { id: string; firstWin: boolean; stars: number }): RegionState {
  if (!receipt.firstWin || !receipt.id || !positive(receipt.stars) || state.creditedWins.includes(receipt.id) ||
    !natural(state.stars + receipt.stars)) return state;
  return { ...state, stars: state.stars + receipt.stars, creditedWins: [...state.creditedWins, receipt.id] };
}
export function buildRegion(state: RegionState, region: RegionDefinition, id: string): RegionState {
  const building = region.buildings.find(item => item.id === id), key = `${region.id}:${id}`;
  if (state.level < region.level || !building || !positive(building.stars) || state.stars < building.stars ||
    state.built.includes(key) || (building.after && !state.built.includes(`${region.id}:${building.after}`))) return state;
  const built = [...state.built, key], complete = region.buildings.every(item => built.includes(`${region.id}:${item.id}`));
  return { ...state, stars: state.stars - building.stars, built,
    completed: complete && !state.completed.includes(region.id) ? [...state.completed, region.id] : state.completed };
}

interface CascadeWindow { id: string; priority: number; start: number; end: number; slot: string; after?: string }
export function cascadeSchedule(windows: readonly CascadeWindow[], state: { now: number; completed: readonly string[];
  active: readonly CascadeWindow[]; pendingClaims: readonly string[] }) {
  const slots = new Set(state.active.filter(item => item.start <= state.now && state.now < item.end).map(item => item.slot));
  const ordered = [...windows].sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
  const next: CascadeWindow[] = [];
  const ids = new Set(state.active.map(item => item.id));
  for (const entry of ordered) {
    if (!entry.id || !entry.slot || !natural(entry.priority) || !natural(state.now) ||
      state.now < entry.start || state.now >= entry.end || slots.has(entry.slot) ||
      ids.has(entry.id) || state.pendingClaims.includes(entry.id) || state.completed.includes(entry.id) ||
      (entry.after && !state.completed.includes(entry.after))) continue;
    next.push(entry);
    slots.add(entry.slot);
    ids.add(entry.id);
  }
  return { next, pendingClaims: state.pendingClaims };
}

interface DigState { version: 1; stage: string; tokens: number; opened: readonly number[]; finds: readonly string[]; claimed: boolean }
interface DigBoard { id: string; cells: readonly { cost: number; find?: string }[]; required: readonly string[] }
export function excavate(state: DigState, board: DigBoard, cell: number): DigState {
  const tile = board.cells[cell];
  if (state.version !== 1 || state.stage !== board.id || !tile || !natural(cell) ||
    !positive(tile.cost) || state.tokens < tile.cost || state.opened.includes(cell) || state.claimed) return state;
  return { ...state, tokens: state.tokens - tile.cost, opened: [...state.opened, cell],
    finds: tile.find && !state.finds.includes(tile.find) ? [...state.finds, tile.find] : state.finds };
}
export function claimDig(state: DigState, board: DigBoard): DigState {
  return state.stage !== board.id || state.claimed || !board.required.length ||
    !board.required.every(find => state.finds.includes(find)) ? state : { ...state, claimed: true };
}

interface WheelState { tokens: number; coins: number; offers: readonly { id: string; coins: number; claimed?: true }[] }
interface WheelWedge { id: string; weight: number; coins: number }
export function wheelOdds(wedges: readonly WheelWedge[]) {
  if (!wedges.length || wedges.some(wedge => !wedge.id || !positive(wedge.weight) || !positive(wedge.coins)) ||
    new Set(wedges.map(wedge => wedge.id)).size !== wedges.length) return [];
  const den = wedges.reduce((total, wedge) => total + wedge.weight, 0);
  if (!positive(den)) return [];
  return wedges.map(wedge => ({ id: wedge.id, numerator: wedge.weight, denominator: den }));
}
export function spinWheel(state: WheelState, wedges: readonly WheelWedge[], id: string, draw: (total: number) => number): WheelState {
  const den = wheelOdds(wedges)[0]?.denominator;
  if (!den || !id || state.tokens < 1 || state.offers.some(offer => offer.id === id)) return state;
  const pick = draw(den);
  if (!natural(pick) || pick >= den) return state;
  let cutoff = 0;
  for (const wedge of wedges) {
    cutoff += wedge.weight;
    if (pick < cutoff) return { ...state, tokens: state.tokens - 1, offers: [...state.offers, { id, coins: wedge.coins }] };
  }
  return state;
}
export function claimWheel(state: WheelState, id: string): WheelState {
  const prize = state.offers.find(entry => entry.id === id);
  if (!prize || prize.claimed || !natural(state.coins + prize.coins)) return state;
  return { ...state, coins: state.coins + prize.coins, offers: state.offers.map(entry => entry === prize ? { ...entry, claimed: true } : entry) };
}

interface TreasureState { version: 1; chapter: number; step: number; tokens: number; coins: number; keys: readonly string[] }
export function findTreasure(state: TreasureState, chapters: readonly (readonly { cost: number; coins: number }[])[], id: string) {
  const chapter = chapters[state.chapter], tile = chapter?.[state.step];
  if (state.version !== 1 || !id || !tile || !positive(tile.cost) || !positive(tile.coins) ||
    !natural(state.coins + tile.coins) || state.tokens < tile.cost || state.keys.includes(id)) return state;
  const end = state.step + 1 === chapter.length;
  return { ...state, chapter: state.chapter + Number(end), step: end ? 0 : state.step + 1,
    tokens: state.tokens - tile.cost, coins: state.coins + tile.coins, keys: [...state.keys, id] };
}
