export const casualIcons = {
  coin: 'art/generated/coin.webp', heart: 'art/ui/heart.webp', gift: 'art/ui/gift.webp',
  medal: 'art/ui/medal.webp', task: 'art/ui/task.webp', daily: 'art/generated/daily.webp',
  looks: 'art/generated/looks.webp', hint: 'art/generated/hint.webp', undo: 'art/generated/undo.webp',
  joker: 'art/generated/joker.webp', shuffle: 'art/ui/shuffle.svg', cycle: 'art/generated/cycle.webp', key: 'art/generated/key.webp',
  dailyDeal: 'art/ui/daily-deal.webp', draw: 'art/ui/draw-stack.webp', link: 'art/ui/category-link.webp',
  album: 'art/ui/keepsake-album.webp', book: 'art/generated/book.webp', lock: 'art/generated/lock.webp', milestone: 'art/generated/milestone.webp',
};
type Icon = keyof typeof casualIcons;

export function casualIcon(key: Icon, className = 'casual-icon'): HTMLImageElement {
  const image = new Image();
  image.src = casualIcons[key]; image.alt = ''; image.className = className;
  return image;
}
const prizeArt: Record<string, Icon> = {
  Coins: 'coin', MoveHint: 'hint', Undo: 'undo', Medals: 'medal', Joker: 'joker',
  Definition: 'book', Shuffle: 'shuffle', CardBack: 'looks', RandomBoostersChest: 'gift',
};
export function prizeIcon(kind: string): HTMLImageElement { return casualIcon(prizeArt[kind] ?? 'gift'); }

export function prizeToken(prize: { kind: string; quantity: number }): HTMLElement {
  const span = document.createElement('span');
  span.className = 'prize-token';
  const value = document.createElement('span');
  value.className = 'prize-count';
  value.textContent = '+' + prize.quantity.toLocaleString('ru-RU');
  span.append(prizeIcon(prize.kind), value);
  return span;
}

export function videoGlyph(): HTMLElement {
  const span = document.createElement('span');
  span.className = 'video-glyph'; span.setAttribute('aria-hidden', 'true');
  return span;
}

export function progressTrack(current: number, target: number): HTMLElement {
  const track = document.createElement('span');
  track.className = 'casual-track'; track.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('i');
  fill.style.width = (target > 0 ? Math.min(current / target, 1) * 100 : 0) + '%';
  track.append(fill);
  return track;
}

export function winStamps(count: number): HTMLElement {
  const line = document.createElement('span');
  line.className = 'win-stamps'; line.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 5; i++) {
    const pip = document.createElement('i');
    if (i < count) { pip.className = 'lit'; pip.textContent = '✓'; }
    line.append(pip);
  }
  line.append(casualIcon('gift'));
  return line;
}

export function observeScrollEdges(body: HTMLElement) {
  const frame = body.parentElement!;
  const update = () => {
    const remaining = body.scrollHeight - body.clientHeight - body.scrollTop;
    frame.toggleAttribute('data-scroll-down', body.clientHeight > 0 && remaining > 2);
    frame.toggleAttribute('data-scroll-up', body.clientHeight > 0 && body.scrollTop > 2);
  };
  body.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(body);
  new MutationObserver(update).observe(body, { childList: true, subtree: true });
  update();
}

export function configureCasualHome(allowLevelPicker: boolean) {
  const home = document.querySelector<HTMLElement>('#home')!;
  home.setAttribute('aria-label', 'Главная');
  const button = (id: string) => document.getElementById(id)!;
  const tray = document.createElement('div');
  tray.className = 'casual-tray';
  const shortcuts = document.createElement('nav');
  shortcuts.className = 'casual-shortcuts'; shortcuts.setAttribute('aria-label', 'Занятия');
  const entries = [
    ['daily-play', 'dailyDeal', 'Раздача'], ['calendar-open', 'daily', 'Календарь'],
    ['daily-bonus-open', 'gift', 'Бонус дня'], ['daily-tasks-open', 'task', 'Задания'],
    ['appearance-open', 'looks', 'Ваш стол'],
  ] as const;
  for (const [id, icon, label] of entries) {
    const item = button(id);
    if (id === 'calendar-open') item.textContent = '';
    item.classList.add('casual-shortcut');
    item.prepend(casualIcon(icon), Object.assign(document.createElement('strong'), { className: 'casual-short-label', textContent: label }));
    shortcuts.append(item);
  }
  const archive = document.createElement('nav');
  archive.className = 'casual-archive';
  archive.setAttribute('aria-label', 'Сохранённые занятия');
  for (const id of ['picture-home', 'campaign-liveops-open', 'daily-resume-old']) archive.append(button(id));
  button('win-cycle-open').append(casualIcon('gift'));
  tray.append(button('win-cycle-open'), button('home-play'), button('home-unlock-track'), shortcuts, archive,
    button('campaign-monthly-confirmation'), button('campaign-monthly-bonus'));
  if (allowLevelPicker) tray.append(button('level-picker-open'));
  button('wallet-anchor').after(button('campaign-lives-open'));
  home.append(tray);
  observeScrollEdges(home);
}

export function configureCasualDialogs() {
  const icons: Record<string, Icon> = {
    settings: 'looks', helpers: 'hint', 'coins-dialog': 'coin', 'campaign-lives': 'heart', calendar: 'daily',
    appearance: 'looks', 'cycle-info': 'gift', 'picture-dialog': 'album', 'bonus-offer': 'link',
    'privacy-dialog': 'book', 'inspect-dialog': 'book', 'daily-tasks-dialog': 'task', 'daily-bonus-dialog': 'gift',
    'campaign-liveops': 'medal', 'random-joker-warning': 'joker', 'shuffle-warning': 'shuffle',
  };
  for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog')) {
    dialog.classList.add('casual-dialog');
    const body = dialog.querySelector<HTMLElement>('.sheet-body, #pause-options');
    if (body) observeScrollEdges(body);
    if (['result', 'daily-bonus-dialog', 'daily-tasks-dialog', 'picture-dialog', 'cycle-info'].includes(dialog.id)) {
      const counters = document.createElement('div');
      counters.className = 'reward-counts'; counters.setAttribute('role', 'status');
      dialog.append(counters);
    }
    const title = document.getElementById(dialog.getAttribute('aria-labelledby') ?? '');
    const icon = icons[dialog.id];
    if (!title || !icon) continue;
    const heading = document.createElement('div');
    heading.className = 'casual-dialog-title';
    title.before(heading);
    heading.append(casualIcon(icon), title);
  }
}

const progressKey = 'asoc-solitaire.task-presentation.v1';

export function taskProgressBaseline(key: string, actual: number) {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(progressKey) ?? '[]');
    const entries: [string, number][] = Array.isArray(stored) ? stored.filter(entry =>
      Array.isArray(entry) && typeof entry[0] === 'string' && Number.isSafeInteger(entry[1]) && entry[1] >= 0) : [];
    const before = entries.find(([id]) => id === key)?.[1] ?? 0;
    localStorage.setItem(progressKey, JSON.stringify([...entries.filter(([id]) => id !== key), [key, actual]].slice(-64)));
    return Math.min(before, actual);
  } catch {
    return actual;
  }
}
