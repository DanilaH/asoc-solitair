import { expect, it } from 'vitest';
import { introDeal } from '../../src/content/intro';
import { dispatch, freshAttempt, freshSave } from '../../src/domain/engine';
import { claimPicture, observePictureClock, openPictureEvent, pictureClosed, pictureTokens, recordPictureWin,
  revealPicturePart, validPicture } from '../../src/domain/events/picture';
import { recoverable } from '../fixtures/content8-loss';

const now = Date.UTC(2026, 10, 21, 12);
function winLevel(state: ReturnType<typeof freshSave>, level: number) {
  const deal = { ...recoverable, id: `picture-proof-${level}`, campaignLevel: level };
  let playing = { ...state, attempt: freshAttempt(deal, `proof-${level}`) };
  for (const move of deal.winningPath.slice(0, -1)) playing = dispatch(playing, move, deal).next;
  return { playing, won: dispatch(playing, deal.winningPath.at(-1)!, deal).next, deal };
}

it('pays two tokens and separate coins only on a real first win; spending and claim stay idempotent', () => {
  const original = freshSave(recoverable, 'gallery');
  expect(openPictureEvent(original, now)).toBe(true);
  expect(openPictureEvent(original, now)).toBe(false);
  expect(revealPicturePart(original, 0)).toBe(false);
  let state = original;
  for (let level = 16; level < 22; level++) {
    const { playing, won, deal } = winLevel(state, level);
    const baseline = won.profile.coins;
    expect(recordPictureWin(playing, won, deal, now)).toBe(true);
    expect(won.profile.coins).toBe(baseline + 3);
    expect(recordPictureWin(playing, won, deal, now)).toBe(false);
    state = won;
  }
  expect(pictureTokens(state)).toBe(12);
  for (let part = 0; part < 6; part++) {
    expect(revealPicturePart(state, part)).toBe(true);
    expect(revealPicturePart(state, part)).toBe(false);
  }
  expect(pictureTokens(state)).toBe(0);
  const restored: typeof state = JSON.parse(JSON.stringify(state));
  expect(validPicture(restored)).toBe(true);
  const coins = restored.profile.coins, hints = restored.profile.hints;
  expect(claimPicture(restored, now + 8 * 86_400_000)).toBe(true);
  expect(claimPicture(restored, now + 8 * 86_400_000)).toBe(false);
  expect(restored.profile).toMatchObject({ coins: coins + 20, hints: hints + 1 });
  expect(validPicture(restored)).toBe(true);
});

it('expires earning while retaining parts and excluding daily/replayed wins', () => {
  const save = freshSave(introDeal, 'new-gallery');
  openPictureEvent(save, now);
  const sample = winLevel(save, 16);
  expect(recordPictureWin(sample.playing, sample.won, sample.deal, now)).toBe(true);
  expect(revealPicturePart(sample.won, 0)).toBe(true);
  const closed = now + 8 * 86_400_000;
  observePictureClock(sample.won, closed);
  expect(pictureClosed(sample.won, now)).toBe(true);
  const replay = winLevel(sample.won, 16);
  const next = winLevel(sample.won, 17);
  expect(recordPictureWin(replay.playing, replay.won, replay.deal, now)).toBe(false);
  expect(recordPictureWin(next.playing, next.won, next.deal, now)).toBe(false);
  expect(revealPicturePart(next.won, 1)).toBe(true);
  expect(revealPicturePart(next.won, -1)).toBe(false);
  expect(claimPicture(next.won, closed)).toBe(false);
});
