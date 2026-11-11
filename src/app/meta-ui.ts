import { campaignCount, cosmeticUnlocked, currentDailyStreak, daysLabel, dayNumber, localDay } from '../domain/meta';
import { BALANCE } from '../domain/balance';
import { CAMPAIGN_LENGTH } from '../domain/progression';
import type { Save } from '../domain/types';
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
export const campaignAttempt = (save: Save) => save.attempt.daily ? save.parked?.campaign : save.attempt;
export const dailyAttempt = (save: Save) => save.attempt.daily ? save.attempt : save.parked?.daily;
const pips = (count: number) => Array.from({ length: 5 }, (_, i) => `<i class="${i < count ? 'lit' : ''}">✦</i>`).join('');
export function renderMeta(save: Save, busy: boolean) {
  const meta = save.meta!, today = localDay(), done = meta.dailyDates.includes(today), daily = dailyAttempt(save), n = campaignCount(save), target = Math.min(CAMPAIGN_LENGTH, (Math.floor(n / 10) + 1) * 10);
  $('#app').dataset.palette = cosmeticUnlocked(save, 'palette') ? save.settings.palette ?? 'green' : 'green';
  $('#app').dataset.back = cosmeticUnlocked(save, 'cardBack') ? save.settings.cardBack ?? 'classic' : 'classic';
  const basicReady = campaignCount(save) >= 2;
  $('.daily-card').hidden = !basicReady && !daily && meta.dailyDates.length === 0;
  $('#win-cycle-open').hidden = n === 0; $('#looks-open').hidden = n === 0; $('#appearance-open').hidden = n === 0;
  $('#win-cycle-pips').innerHTML = pips(meta.winCycle);
  $('#cycle-reward').textContent = `+${BALANCE.meta.cycleCoins} монет и подсказка`;
  $('#calendar-reward-copy').textContent = `За день — ${BALANCE.meta.dailyCoins} монет. На 3-м дне серии — ещё ${BALANCE.meta.day3Coins}; на 7-м и каждых следующих семи — ${BALANCE.meta.day7Coins} и отмена. Пропуск сбрасывает текущую серию.`;
  $('#win-cycle-count').textContent = `${meta.winCycle} / 5 новых побед`;
  $('#milestone-title').textContent = n >= CAMPAIGN_LENGTH ? 'Кампания пройдена' : `Веха ${target}`;
  $('#milestone-copy').textContent = n >= CAMPAIGN_LENGTH ? 'Оформление и положение колоды' : target === 10 ? `Стол «Чернила» и ${BALANCE.meta.milestoneCoins} монет` : target === 20 ? `Рубашка «Ромбы» и ${BALANCE.meta.milestoneCoins} монет` : `${BALANCE.meta.milestoneCoins} монет`;
  $('#milestone-fill').style.width = `${n >= CAMPAIGN_LENGTH ? 100 : n % 10 * 10}%`; $('#milestone-progress').textContent = n >= CAMPAIGN_LENGTH ? `${n} / ${CAMPAIGN_LENGTH}` : `${n % 10} / 10`;
  $('#daily-date').textContent = new Date(`${today}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  $('#daily-status').textContent = done ? `Готово · серия ${currentDailyStreak(save, today)} дн.` : daily?.daily?.dayId === today && daily.board.phase === 'playing' ? 'Продолжить' : '';
  $('#daily-play').setAttribute('aria-label', done ? 'Повторить задание дня без награды' : 'Играть в задание дня');
  $<HTMLButtonElement>('#daily-play').disabled = busy;
  $('#daily-resume-old').hidden = !daily || daily.daily?.dayId === today || daily.board.phase === 'won';
  $('#daily-resume-old').textContent = daily?.daily ? `Доиграть ${new Date(daily.daily.dayId + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · тренировка` : '';
  $('#calendar-summary').textContent = `${daysLabel(currentDailyStreak(save, today))} подряд · всего ${meta.dailyDates.length} завершено`;
  const date = new Date(), year = date.getFullYear(), month = date.getMonth();
  $('#calendar-month').textContent = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const grid = $('#calendar-grid'); grid.replaceChildren();
  const weekday = (new Date(year, month, 1).getDay() + 6) % 7;
  for (let i = 0; i < weekday; i++) grid.append(document.createElement('span'));
  for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) {
    const id = localDay(new Date(year, month, day)), cell = document.createElement('span'), complete = meta.dailyDates.includes(id);
    cell.textContent = String(day); cell.className = `calendar-day${complete ? ' complete' : ''}${id === today ? ' today' : ''}${dayNumber(id) > dayNumber(today) ? ' future' : ''}`;
    cell.setAttribute('aria-label', `${id}${complete ? ', выполнено' : id === today ? ', сегодня' : ''}`); grid.append(cell);
  }
  $('#appearance-preview').dataset.palette = save.settings.palette ?? 'green'; $('#appearance-preview').dataset.back = save.settings.cardBack ?? 'classic';
  for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-palette], button[data-card-back]')) {
    const kind = button.dataset.palette ? 'palette' : 'cardBack', value = button.dataset.palette ?? button.dataset.cardBack!;
    const unlocked = value === 'green' || value === 'classic' || cosmeticUnlocked(save, kind);
    button.disabled = busy || !unlocked; button.setAttribute('aria-pressed', String((save.settings[kind] ?? (kind === 'palette' ? 'green' : 'classic')) === value));
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-deck-side]')) { button.disabled = busy; button.setAttribute('aria-pressed', String((save.settings.deckSide ?? 'right') === button.dataset.deckSide)); }
  for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-deck-position]')) { button.disabled = busy; button.setAttribute('aria-pressed', String((save.settings.deckPosition ?? 'top') === button.dataset.deckPosition)); }
}
