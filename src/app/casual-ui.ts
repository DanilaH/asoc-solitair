export const casualIcons = {
  coin: 'art/generated/coin.webp', heart: 'art/ui/heart.webp', gift: 'art/ui/gift.webp',
  medal: 'art/ui/medal.webp', task: 'art/ui/task.webp', daily: 'art/generated/daily.webp',
  looks: 'art/generated/looks.webp', hint: 'art/generated/hint.webp', undo: 'art/generated/undo.webp',
  joker: 'art/generated/joker.webp', cycle: 'art/generated/cycle.webp', key: 'art/generated/key.webp',
  book: 'art/generated/book.webp', lock: 'art/generated/lock.webp', milestone: 'art/generated/milestone.webp',
};
type Icon = keyof typeof casualIcons;

export function casualIcon(key: Icon, className = 'casual-icon'): HTMLImageElement {
  const image = new Image();
  image.src = casualIcons[key]; image.alt = ''; image.className = className;
  return image;
}
const prizeArt: Record<string, Icon> = {
  Coins: 'coin', MoveHint: 'hint', Undo: 'undo', Medals: 'medal', Joker: 'joker',
  Definition: 'book', Shuffle: 'cycle', CardBack: 'looks', RandomBoostersChest: 'gift',
};
export function prizeIcon(kind: string): HTMLImageElement { return casualIcon(prizeArt[kind] ?? 'gift'); }

export function prizeToken(prize: { kind: string; quantity: number }): HTMLElement {
  const span = document.createElement('span');
  span.className = 'prize-token';
  span.append(prizeIcon(prize.kind), document.createTextNode('+' + prize.quantity.toLocaleString('ru-RU')));
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

export function configureCasualHome(allowLevelPicker: boolean) {
  const home = document.querySelector<HTMLElement>('#home')!;
  home.setAttribute('aria-label', 'Главная');
  const button = (id: string) => document.getElementById(id)!;
  const tray = document.createElement('div');
  tray.className = 'casual-tray';
  const shortcuts = document.createElement('nav');
  shortcuts.className = 'casual-shortcuts'; shortcuts.setAttribute('aria-label', 'Занятия');
  const entries = [
    ['daily-play', 'daily', 'На день'], ['calendar-open', 'daily', 'Календарь'],
    ['daily-bonus-open', 'gift', 'Бонус дня'], ['daily-tasks-open', 'task', 'Задания'],
    ['appearance-open', 'looks', 'Ваш стол'],
  ] as const;
  for (const [id, icon, label] of entries) {
    const item = button(id);
    item.classList.add('casual-shortcut');
    item.prepend(casualIcon(icon), Object.assign(document.createElement('strong'), { className: 'casual-short-label', textContent: label }));
    shortcuts.append(item);
  }
  for (const id of ['picture-home', 'campaign-liveops-open']) {
    const item = button(id);
    item.classList.add('casual-legacy');
    shortcuts.append(item);
  }
  button('win-cycle-open').append(casualIcon('gift'));
  tray.append(button('win-cycle-open'), button('home-play'), shortcuts, button('daily-resume-old'),
    button('campaign-monthly-confirmation'), button('campaign-monthly-bonus'));
  if (allowLevelPicker) tray.append(button('level-picker-open'));
  button('wallet-anchor').after(button('campaign-lives-open'));
  home.append(tray);
}
