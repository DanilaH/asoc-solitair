import type { Deal, Save } from '../types';
import { claimMilestone, eventKey, observeEvents, recordEventWin, settledFirstWin, type EventDefinition } from './ledger';

export const PICTURE_PREVIEW = import.meta.env?.VITE_CONTENT8_PICTURE === '1';
export const PICTURE_TITLE = 'Апельсиновая оранжерея';
export const PICTURE_PRICES = [1, 1, 2, 2, 3, 3] as const;
const DAY = 86_400_000;
const TOKENS = 2;
const WIN_COINS = 3;
const PICTURE_ID = 'orangery';
const SOURCE_ID = 'hitapps-puzzle-event';

export interface PictureState {
  version: 1;
  eventKey: string;
  parts: number[];
  lastWinAttempt?: string;
  gallery?: { id: typeof PICTURE_ID; at: number };
}
const natural = (value: number) => Number.isSafeInteger(value) && value >= 0;

export function validPicture(save: Save): boolean {
  const picture = save.picture;
  if (!picture) return false;
  const event = save.events?.events.find(entry => eventKey(entry.definition) === picture.eventKey);
  return Boolean(event?.definition.id === PICTURE_ID && event.definition.sourceFeatureId === SOURCE_ID &&
    picture.version === 1 && Array.isArray(picture.parts) && picture.parts.every(part => natural(part) && part < PICTURE_PRICES.length) &&
    new Set(picture.parts).size === picture.parts.length &&
    (picture.lastWinAttempt === undefined || typeof picture.lastWinAttempt === 'string') &&
    pictureTokens(save) >= 0 && (picture.gallery === undefined || (picture.gallery.id === PICTURE_ID &&
      picture.parts.length === PICTURE_PRICES.length && natural(picture.gallery.at) && event.claimed.includes('illustration'))));
}

export function openPictureEvent(save: Save, now: number): boolean {
  if (save.picture || !natural(now)) return false;
  const start = now - now % DAY;
  const definition: EventDefinition = { id: PICTURE_ID, sourceFeatureId: SOURCE_ID, version: 1, daily: false,
    minCampaignLevel: 1, schedule: { clock: 'local', zone: 'Europe/Moscow', start, end: start + 7 * DAY },
    milestones: [{ id: 'illustration', threshold: 6, reward: { coins: 20, hints: 1 } }] };
  observeEvents(save, [definition], { localMs: now });
  const key = eventKey(definition);
  if (!save.events?.events.some(event => eventKey(event.definition) === key)) return false;
  save.picture = { version: 1, eventKey: key, parts: [] };
  return true;
}

function pictureEvent(save: Save) {
  return save.events?.events.find(event => eventKey(event.definition) === save.picture?.eventKey);
}

export function observePictureClock(save: Save, now: number): void {
  const event = pictureEvent(save);
  if (event && !save.picture?.gallery) observeEvents(save, [event.definition], { localMs: now });
}

export function pictureTokens(save: Save): number {
  const earned = (pictureEvent(save)?.wins.length ?? 0) * TOKENS;
  const spent = (save.picture?.parts ?? []).reduce((sum, part) => sum + PICTURE_PRICES[part], 0);
  return earned - spent;
}

export function pictureClosed(save: Save, now: number): boolean {
  const end = pictureEvent(save)?.definition.schedule.end;
  return end === undefined || Math.max(save.events?.clocks.local ?? 0, now) >= end;
}

export function recordPictureWin(before: Save, after: Save, deal: Deal, now: number): boolean {
  const event = pictureEvent(after), picture = after.picture;
  if (!picture || !event || picture.gallery || !natural(after.profile.coins + WIN_COINS)) return false;
  const win = settledFirstWin(before, after, deal);
  if (!win || !recordEventWin(after, [event.definition], win, { localMs: now })) return false;
  after.profile.coins += WIN_COINS;
  picture.lastWinAttempt = after.attempt.id;
  return true;
}

export function revealPicturePart(save: Save, part: number): boolean {
  const picture = save.picture, price = PICTURE_PRICES[part];
  if (!picture || !price || picture.parts.includes(part) || pictureTokens(save) < price) return false;
  picture.parts.push(part);
  return true;
}

export function claimPicture(save: Save, now: number): boolean {
  const picture = save.picture;
  const milestone = pictureEvent(save)?.definition.milestones[0];
  if (!picture || !milestone || picture.gallery || picture.parts.length !== PICTURE_PRICES.length || !natural(now)) return false;
  if (!claimMilestone(save, picture.eventKey, milestone.id)) return false;
  picture.gallery = { id: PICTURE_ID, at: now };
  return true;
}
