import { WIN_STREAK, stagedStreak, streakStatus } from '../domain/events/win-streak';
import { campaignCount, cosmeticUnlocked, currentDailyStreak, daysLabel, dayNumber, localDay } from '../domain/meta';
import { BALANCE } from '../domain/balance';
import { CAMPAIGN_LENGTH, dailyModeAvailable } from '../domain/progression';
import type { Save } from '../domain/types';
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
export const campaignAttempt = (save: Save) => save.attempt.daily ? save.parked?.campaign : save.attempt;
export const dailyAttempt = (save: Save) => save.attempt.daily ? save.attempt : save.parked?.daily;
const pips = (count: number, goal = 5) => Array.from({ length: goal }, (_, i) => `<i class="${i < count ? 'lit' : ''}">✦</i>`).join('');
export function renderMeta(save: Save, busy: boolean) {
  const meta = save.meta!, today = localDay(), done = meta.dailyDates.includes(today), daily = dailyAttempt(save), n = Math.min(CAMPAIGN_LENGTH, campaignCount(save)), target = (Math.floor(n / 10) + 1) * 10;
  $('#app').dataset.palette = cosmeticUnlocked(save, 'palette') ? save.settings.palette ?? 'green' : 'green';
  $('#app').dataset.back = cosmeticUnlocked(save, 'cardBack') ? save.settings.cardBack ?? 'classic' : 'classic';
  const noDaily = !dailyModeAvailable(save);
  $('.daily-card').hidden = noDaily;
  if ($('#app').hasAttribute('data-casual')) {
    $('#daily-play').hidden = noDaily;
    $('#calendar-open').hidden = noDaily;
  }
  const staged = stagedStreak(save);
  const streak = streakStatus(save);
  $('#win-cycle-open').hidden = n === 0 || n >= CAMPAIGN_LENGTH && !streak.ready;
  $('#appearance-open').hidden = n === 0;
  $('#win-cycle-open strong').textContent = staged ? 'Серия побед' : 'Пять побед';
  $('#win-cycle-pips').innerHTML = staged ? pips(streak.progress, streak.goal) : pips(meta.winCycle);
  $('#cycle-reward').textContent = staged ? `+${streak.reward.coins} монет` : `+${BALANCE.meta.cycleCoins} монет и подсказка`;
  $('#calendar-reward-copy').textContent = `За день — ${BALANCE.meta.dailyCoins} монет. Серия из 3 дней: +${BALANCE.meta.day3Coins}. За 7 дней, затем каждые 7: +${BALANCE.meta.day7Coins} и отмена. Пропуск сбрасывает серию.`;
  $('#win-cycle-count').textContent = staged
    ? streak.ready ? `Готово наград · ${streak.ready}` : `Ступень ${streak.index + 1} · ${streak.progress}/${streak.goal}`
    : `${meta.winCycle} из 5 побед`;
  $('#cycle-title').textContent = staged ? 'Серия побед' : 'Пять побед';
  $('#cycle-copy').textContent = staged ? 'Первое прохождение уровня кампании добавляет одну победу к текущей ступени.'
    : `За пять впервые пройденных уровней начисляются ${BALANCE.meta.cycleCoins} монет и подсказка.`;
  $('#cycle-rule').textContent = staged ? 'После подтверждённого поражения обнуляется текущая ступень. Готовые награды сохраняются.'
    : 'Перезапуск и смена незавершённого уровня сбрасывают отметки. Отмена хода, продолжение, пауза и ежедневный уровень их сохраняют.';
  const stages = $('#cycle-stages');
  stages.hidden = !staged;
  if (staged) stages.replaceChildren(...WIN_STREAK.map(({ wins, coins, hints }, index) => {
    const row = document.createElement('li');
    const progress = index < streak.index ? 'Пройдено' : index === streak.index ? `${streak.progress}/${wins}` : `${wins} побед`;
    row.textContent = `${progress} · ${coins} монет${hints ? ' и подсказка' : ''}`;
    return row;
  }));
  const claim = $<HTMLButtonElement>('#cycle-claim');
  claim.hidden = !staged || streak.ready === 0;
  claim.disabled = busy;
  $('#milestone-title').textContent = n >= CAMPAIGN_LENGTH ? 'Кампания пройдена' : target > CAMPAIGN_LENGTH ? 'Последняя глава' : `Награда за ${target} уровней`;
  $('#milestone-copy').textContent = n >= CAMPAIGN_LENGTH ? 'Оформление и положение колоды' : target > CAMPAIGN_LENGTH ? `До конца осталось ${CAMPAIGN_LENGTH - n}` : target === 10 ? `Стол «Чернила» и ${BALANCE.meta.milestoneCoins} монет` : target === 20 ? `Рубашка «Ромбы» и ${BALANCE.meta.milestoneCoins} монет` : `${BALANCE.meta.milestoneCoins} монет`;
  $('#milestone-fill').style.width = `${n >= CAMPAIGN_LENGTH ? 100 : n % 10 * 10}%`; $('#milestone-progress').textContent = n >= CAMPAIGN_LENGTH ? `${n} / ${CAMPAIGN_LENGTH}` : target > CAMPAIGN_LENGTH ? `${n} / ${CAMPAIGN_LENGTH}` : `${n % 10} / 10`;
  $('#daily-date').textContent = new Date(`${today}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  $('#daily-status').textContent = done ? `Готово · серия ${currentDailyStreak(save, today)} дн.` : daily?.daily?.dayId === today && daily.board.phase === 'playing' ? 'Продолжить' : '';
  const dailyStarted = daily?.daily?.dayId === today && daily.board.phase === 'playing';
  $('#daily-play').dataset.dailyState = done ? 'complete' : dailyStarted ? 'started' : 'ready';
  $('#daily-play').setAttribute('aria-label', done ? 'Повторить ежедневный уровень без награды' :
    dailyStarted ? 'Продолжить ежедневный уровень' : 'Играть в ежедневный уровень');
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
  const preview = $('#appearance-preview');
  preview.dataset.palette = save.settings.palette ?? 'green';
  preview.dataset.back = save.settings.cardBack ?? 'classic';
  preview.dataset.deckSide = save.settings.deckSide ?? 'right';
  preview.dataset.deckPosition = save.settings.deckPosition ?? 'top';
  for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-palette], button[data-card-back]')) {
    const kind = button.dataset.palette ? 'palette' : 'cardBack', value = button.dataset.palette ?? button.dataset.cardBack!;
    const unlocked = value === 'green' || value === 'classic' || cosmeticUnlocked(save, kind);
    button.disabled = busy || !unlocked; button.setAttribute('aria-pressed', String((save.settings[kind] ?? (kind === 'palette' ? 'green' : 'classic')) === value));
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-deck-side]')) { button.disabled = busy; button.setAttribute('aria-pressed', String((save.settings.deckSide ?? 'right') === button.dataset.deckSide)); }
  for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-deck-position]')) { button.disabled = busy; button.setAttribute('aria-pressed', String((save.settings.deckPosition ?? 'top') === button.dataset.deckPosition)); }
}
