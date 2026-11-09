import Phaser from 'phaser';
import { getBackingStoreSize, getRenderPixelRatio } from '@danilah/mini-games-kit/core';
import { destroyRenderer } from '@danilah/mini-games-kit/phaser';
import { installTouchActivation } from '@danilah/mini-games-kit/feel';
import { introDeal } from './content/intro';
import { boardKey, dispatch, freshSave, STREAK } from './domain/engine';
import type { BoardCommand, Command } from './domain/types';
import { BoardScene } from './game/BoardScene';
import { createRuntime, storage } from './platform/runtime';
import './style.css';

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const deal = introDeal;
let scene: BoardScene | undefined;
let game: Phaser.Game | undefined;
let worker: Worker | undefined;
let workerDeadline: ReturnType<typeof setTimeout> | undefined;
let outcomeTimer: ReturnType<typeof setTimeout> | undefined;
let messageTimer: ReturnType<typeof setTimeout> | undefined;
let inspectMode = false;
let alive = true;
let ready = false;
const abort = new AbortController();
const domOptions = { signal: abort.signal };
const dialogs = [...document.querySelectorAll<HTMLDialogElement>('dialog')];
const runtime = createRuntime(() => { scene?.cancel(); }, () => {
  if (scene?.back()) return;
  if (dialogs.some(d => d.open)) closeDialogs();
  else if (inspectMode) setInspect(false);
  else openDialog('#settings');
});

function closeDialogs() { dialogs.forEach(d => d.close()); runtime.activity.setBlocked('modal', false); }
function openDialog(selector: string) { closeDialogs(); scene?.cancel(); runtime.activity.setBlocked('modal', true); $<HTMLDialogElement>(selector).showModal(); }
function message(text: string, error = false) {
  clearTimeout(messageTimer); $('#message').textContent = text; $('#message').classList.toggle('error', error);
  if (error) messageTimer = setTimeout(() => message('Собирайте карты одной категории вместе'), 1800);
}
function setInspect(value: boolean) { inspectMode = value; $('#inspect').setAttribute('aria-pressed', String(value)); scene?.setInspect(value); message(value ? 'Нажмите на открытую карточку' : 'Собирайте карты одной категории вместе'); }

try {
  let save = storage.load(deal) ?? freshSave(deal, crypto.randomUUID());
  let activeHint: { key: string; action: BoardCommand; guaranteed: boolean } | undefined;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) save.settings.reducedMotion = true;
  storage.write(save);
  runtime.setMute(!save.settings.sfx);
  const coins = Array.from({ length: 24 }, () => { const node = document.createElement('span'); node.className = 'flying-coin'; node.textContent = '✦'; $('#coin-layer').append(node); return { node, busy: false, animation: null as Animation | null }; });
  function coinBurst() {
    if (save.settings.reducedMotion || new URLSearchParams(location.search).get('fxCoins') === '0') return;
    const source = $('#streak-reward').getBoundingClientRect(), target = $('.coin-icon').getBoundingClientRect();
    for (let i = 0; i < 8; i++) {
      const coin = coins.find(c => !c.busy); if (!coin) break;
      coin.busy = true; coin.node.style.display = 'block';
      const sx = source.x + source.width / 2 - 10, sy = source.y + source.height / 2 - 10;
      const tx = target.x + target.width / 2 - 10, ty = target.y + target.height / 2 - 10;
      coin.animation = coin.node.animate([{ transform: `translate(${sx}px,${sy}px) scale(.5)`, opacity: 0 },
        { transform: `translate(${sx + (i - 3.5) * 10}px,${sy - 35 - i % 3 * 8}px) scale(1)`, opacity: 1, offset: .27 },
        { transform: `translate(${tx}px,${ty}px) scale(.8)`, opacity: 1 }], { duration: 550, delay: i * 23, easing: 'ease-in-out' });
      coin.animation.onfinish = () => { coin.busy = false; coin.node.style.display = 'none'; $('.wallet').classList.remove('bump'); void $('.wallet').offsetWidth; $('.wallet').classList.add('bump'); };
    }
  }
  function renderHud() {
    const board = save.attempt.board;
    $('#coins').textContent = String(save.profile.coins);
    $('#moves').textContent = board.movesLeft === null ? '∞' : String(board.movesLeft);
    $('#move-fill').style.width = `${100 * (board.movesLeft ?? 32) / 32}%`;
    $('#hint-count').textContent = String(save.profile.hints); $('#undo-count').textContent = String(save.profile.undos);
    $<HTMLButtonElement>('#hint').disabled = board.phase !== 'playing' || save.profile.hints === 0 || Boolean(workerDeadline);
    $<HTMLButtonElement>('#undo').disabled = board.phase === 'won' || save.profile.undos === 0 || !save.attempt.undo.length;
    const tier = STREAK[save.attempt.streak.tier];
    $('#streak').replaceChildren(...Array.from({ length: tier.count }, (_, index) => { const cell = document.createElement('i'); cell.className = index < save.attempt.streak.progress ? 'filled' : ''; return cell; }));
    $('#streak').setAttribute('aria-label', `${save.attempt.streak.progress} из ${tier.count}`);
    $('#streak-reward').firstChild!.textContent = `+${tier.coins} `;
    $<HTMLInputElement>('#sfx').checked = save.settings.sfx;
    $<HTMLInputElement>('#reduced').checked = save.settings.reducedMotion;
  }
  function outcome() {
    if (save.attempt.board.phase === 'playing') return;
    const won = save.attempt.board.phase === 'won';
    $('#result-title').textContent = won ? 'Всё сошлось!' : 'Ходы закончились';
    $('#result-copy').textContent = won ? 'Все три категории собраны' : 'Можно отменить последний ход или попробовать тот же расклад снова.';
    $('#result-rewards').innerHTML = won ? `<div class="reward-line"><span>За победу</span><strong>+25</strong></div><div class="reward-line"><span>Осталось ходов: ${save.attempt.board.movesLeft ?? 0}</span><strong>+${2 * (save.attempt.board.movesLeft ?? 0)}</strong></div><div class="reward-line"><span>Серии за партию · уже получено</span><strong>${save.attempt.streak.coins}</strong></div>` : '';
    $('#result-rewards').hidden = !won;
    $('#result-undo').hidden = won || !save.profile.undos || !save.attempt.undo.length;
    openDialog('#result');
  }
  function execute(cmd: Command) {
    if (!alive) return false;
    const result = dispatch(save, cmd, deal);
    try { if (result.next.revision !== save.revision) storage.write(result.next); }
    catch { message('Не удалось сохранить ход. Попробуйте ещё раз.', true); scene?.cancel(); return false; }
    save = result.next;
    if (result.accepted) {
      if (cmd.type !== 'hint') activeHint = undefined;
      scene?.clearHint();
      const boardCommand = ['transfer', 'draw', 'recycle'].includes(cmd.type) ? cmd as BoardCommand : undefined;
      scene?.sync(result.events, cmd.type === 'restart', boardCommand);
      const major = result.events.find(e => e.type === 'win') ?? result.events.find(e => e.type === 'complete') ?? result.events.find(e => e.type === 'coins') ?? result.events[0];
      if (major) runtime.play(major.type);
      if (result.events.some(e => e.type === 'coins')) coinBurst();
      if (cmd.type === 'restart') message('Перенесите категорию в свободный верхний слот');
      if (save.attempt.board.phase !== 'playing') {
        clearTimeout(outcomeTimer); outcomeTimer = setTimeout(outcome, save.attempt.board.phase === 'won' ? 650 : 100);
      }
    } else { scene?.cancel(); runtime.play('invalid'); message(result.reason ?? 'Сюда не подходит', true); }
    renderHud();
    return result.accepted;
  }
  const root = $('#game-root');
  function size() {
    const rect = root.getBoundingClientRect(), ratio = getRenderPixelRatio(2);
    return { rect, backing: getBackingStoreSize(Math.max(1, rect.width), Math.max(1, rect.height), ratio) };
  }
  const initial = size();
  scene = new BoardScene({ deal, getSave: () => save, command: execute, sound: name => runtime.play(name),
    inspect(id) {
      const card = deal.cards[id];
      $('#word-title').textContent = card.text; $('#word-description').textContent = card.explanation;
      openDialog('#inspect-dialog');
    },
    ready(active) {
      scene = active;
      active.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
        ready = true; $('#loading').hidden = true; $('#app').dataset.ready = 'true';
        if (save.attempt.board.phase !== 'playing') outcome();
      });
    },
  });
  game = new Phaser.Game({ type: Phaser.AUTO, parent: root, width: initial.backing.width, height: initial.backing.height,
    transparent: true, banner: false, audio: { noAudio: true }, scene: [scene],
    scale: { mode: Phaser.Scale.NONE, zoom: initial.rect.width / initial.backing.width },
  });
  const renderer = game;
  const resize = new ResizeObserver(() => {
    if (!ready) return;
    const next = size(); renderer.loop.wake(); renderer.scale.setZoom(next.rect.width / next.backing.width); renderer.scale.resize(next.backing.width, next.backing.height);
  });
  resize.observe(root);
  const unblock = runtime.activity.onBlockedChange(blocked => {
    scene?.setEnabled(!blocked);
    if (!renderer.isBooted) return;
    if (blocked && ready) { renderer.loop.sleep(); coins.forEach(c => { c.animation?.cancel(); c.busy = false; c.node.style.display = 'none'; }); }
    else renderer.loop.wake();
  });
  renderer.events.on(Phaser.Core.Events.POST_RENDER, () => {
    if (ready && (runtime.activity.isBlocked() || !scene?.hasMotion())) renderer.loop.sleep();
  });
  // Input and explicit UI changes wake the sleeping renderer before visual work.
  const wake = () => { if (!runtime.activity.isBlocked()) renderer.loop.wake(); };
  root.addEventListener('pointerdown', wake, domOptions); root.addEventListener('pointermove', wake, domOptions);
  document.addEventListener('pointerdown', wake, { ...domOptions, capture: true });
  window.addEventListener('pointercancel', () => scene?.cancel(), domOptions);
  window.addEventListener('blur', () => scene?.cancel(), domOptions);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { scene?.cancel(); setInspect(false); } }, domOptions);
  dialogs.forEach(dialog => dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialogs(); }, domOptions));
  document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(button => button.addEventListener('click', closeDialogs, domOptions));
  $('#menu').addEventListener('click', () => { runtime.play('ui'); openDialog('#settings'); }, domOptions);
  $('#undo').addEventListener('click', () => execute({ type: 'undo' }), domOptions);
  $('#inspect').addEventListener('click', () => setInspect(!inspectMode), domOptions);
  $('#restart').addEventListener('click', () => { closeDialogs(); execute({ type: 'restart', attemptId: crypto.randomUUID() }); }, domOptions);
  $('#replay').addEventListener('click', () => { closeDialogs(); execute({ type: 'restart', attemptId: crypto.randomUUID() }); }, domOptions);
  $('#result-undo').addEventListener('click', () => { closeDialogs(); execute({ type: 'undo' }); }, domOptions);
  for (const [id, key] of [['sfx', 'sfx'], ['reduced', 'reducedMotion']] as const) {
    $<HTMLInputElement>(`#${id}`).addEventListener('change', event => {
      const next = structuredClone(save); next.settings[key] = (event.target as HTMLInputElement).checked; next.revision++;
      try { storage.write(next); save = next; runtime.setMute(!save.settings.sfx); } catch { message('Настройки не сохранились', true); }
      renderHud();
    }, domOptions);
  }
  $('#hint').addEventListener('click', () => {
    if (workerDeadline) return;
    if (activeHint?.key === boardKey(save.attempt.board)) {
      renderer.loop.wake(); scene?.hint(activeHint.action);
      message(activeHint.guaranteed ? 'Попробуйте так — карты перенесите сами' : 'Допустимый ход — продолжение не гарантировано');
      return;
    }
    scene?.cancel(); message('Ищем связь…');
    worker ??= new Worker(new URL('./game/hint.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ revision: number; action?: BoardCommand; guaranteed: boolean }>) => {
      clearTimeout(workerDeadline); workerDeadline = undefined;
      const hint = event.data;
      if (hint.revision !== save.revision || !hint.action || runtime.activity.isBlocked()) { message('Сейчас подходящей подсказки нет'); renderHud(); return; }
      if (!execute({ type: 'hint', revision: hint.revision, action: hint.action })) return;
      activeHint = { key: boardKey(save.attempt.board), action: hint.action, guaranteed: hint.guaranteed };
      renderer.loop.wake(); scene?.hint(hint.action);
      message(hint.guaranteed ? 'Попробуйте так — карты перенесите сами' : 'Допустимый ход — продолжение не гарантировано');
    };
    worker.onerror = () => { clearTimeout(workerDeadline); workerDeadline = undefined; worker?.terminate(); worker = undefined; message('Не удалось подготовить подсказку', true); renderHud(); };
    workerDeadline = setTimeout(() => { worker?.terminate(); worker = undefined; workerDeadline = undefined; message('Поиск занял слишком много времени. Подсказка не потрачена.', true); renderHud(); }, 5000);
    worker.postMessage({ revision: save.revision, board: save.attempt.board, deal }); renderHud();
  }, domOptions);
  const removeTouch = installTouchActivation($('#dock'), { resolveButton: target => target instanceof Element ? target.closest('button') : null });
  renderHud();
  const cleanup = () => {
    if (!alive) return; alive = false; clearTimeout(workerDeadline); clearTimeout(outcomeTimer); clearTimeout(messageTimer);
    abort.abort(); removeTouch(); coins.forEach(c => { c.animation?.cancel(); c.node.remove(); });
    worker?.terminate(); resize.disconnect(); unblock(); runtime.destroy(); destroyRenderer(renderer);
  };
  window.addEventListener('pagehide', event => { if (!event.persisted) cleanup(); }, domOptions);
  window.addEventListener('pageshow', () => { if (alive) renderer.loop.wake(); }, domOptions);
  import.meta.hot?.dispose(cleanup);
} catch (error) {
  runtime.destroy(); game && destroyRenderer(game);
  const alert = document.createElement('div'); alert.className = 'fatal'; alert.setAttribute('role', 'alert');
  const title = document.createElement('h2'); title.textContent = 'Не удалось открыть партию';
  const detail = document.createElement('p'); detail.textContent = error instanceof Error ? error.message : String(error);
  alert.append(title, detail); document.body.append(alert); console.error(error);
}
