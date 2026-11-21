import { expect, it, vi } from 'vitest';
import type { StorageAdapter } from '@danilah/mini-games-kit/platform';
import { beyond80Deals } from '../../src/content/campaign-v8-beyond';
import { SignedBankCache, verifySignedBank, type SignedBank } from '../../src/content/signed-bank';
import { freshSave } from '../../src/domain/engine';
import { decodeSave } from '../../src/platform/storage';
import type { Deal } from '../../src/domain/types';

const enc = new TextEncoder(), base = beyond80Deals[0];
const pair = () => crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
function revision(number: number): Deal {
  const { recoveryPaths: _paths, ...frozen } = base;
  return { ...frozen, id: `campaign-c8-remote-r${number}-81`, tags: ['content8-beyond80'] };
}
async function sign(privateKey: CryptoKey, number: number, deals = [revision(number)]): Promise<SignedBank> {
  const payload = JSON.stringify(deals);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(payload)));
  const sha256 = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  const manifest = JSON.stringify({ schema: 1, product: 'asoc-solitaire', revision: number, sha256 });
  const bytes = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, enc.encode(manifest)));
  return { manifest, payload, signature: btoa(String.fromCharCode(...bytes)) };
}

function storage() {
  let value: string | null = null;
  const disk: StorageAdapter = { getItem: async () => value, setItem: async (_key, raw) => { value = raw; }, removeItem: async () => { value = null; } };
  return { disk, raw: () => value };
}

it('verifies the exact manifest, payload, immutable identifiers and legal winning witness before publishing', async () => {
  const signer = await pair(), wrong = await pair(), wire = await sign(signer.privateKey, 1);
  expect(await verifySignedBank(wire, signer.publicKey)).toMatchObject({ revision: 1 });
  expect(await verifySignedBank(wire, wrong.publicKey)).toBeUndefined();
  expect(await verifySignedBank({ ...wire, payload: wire.payload + ' ' }, signer.publicKey)).toBeUndefined();
  expect(await verifySignedBank({ ...wire, manifest: wire.manifest.replace(':1,', ':2,') }, signer.publicKey)).toBeUndefined();
  expect(await verifySignedBank(await sign(signer.privateKey, 1, [base]), signer.publicKey)).toBeUndefined();
  const invalid = { ...revision(1), winningPath: [{ type: 'unknown' }] } as unknown as Deal;
  expect(await verifySignedBank(await sign(signer.privateKey, 1, [invalid]), signer.publicKey)).toBeUndefined();
  expect(await verifySignedBank(await sign(signer.privateKey, 1, [revision(1), revision(1)]), signer.publicKey)).toBeUndefined();
});

it('keeps pinned old deals after restore and manual rollback, rejects replay and falls back offline', async () => {
  const signer = await pair(), old = await sign(signer.privateKey, 1), newer = await sign(signer.privateKey, 2);
  const saved = storage(), cache = new SignedBankCache(saved.disk, signer.publicKey);
  expect(cache.chooseFresh(base)).toBe(base);
  expect(await cache.refresh(async () => old)).toBe(true);
  const first = cache.chooseFresh(base);
  const save = freshSave(first, 'pinned-remote');
  save.contentVersion = 8;
  const sameSnapshot = structuredClone(first.initial);
  expect(await cache.refresh(async () => newer)).toBe(true);
  expect(cache.chooseFresh(base).id).toBe(revision(2).id);
  expect(cache.findPinned(save.attempt.dealId)?.initial).toEqual(sameSnapshot);
  expect(await cache.refresh(async () => { throw Error('offline'); })).toBe(false);

  const cold = new SignedBankCache(saved.disk, signer.publicKey);
  await cold.open();
  expect(cold.chooseFresh(base).id).toBe(revision(2).id);
  expect(await cold.rollback(1)).toBe(true);
  expect(await cold.refresh(async () => old)).toBe(false);
  expect(cold.findPinned(revision(2).id)).toBeDefined();
  expect(await cold.rollback(0)).toBe(true);
  expect(cold.chooseFresh(base)).toBe(base);
  expect(cold.findPinned(save.attempt.dealId)).toBeDefined();
});

it('aborts a stalled download and keeps retry and uncertain writes idempotent', async () => {
  const signer = await pair(), wire = await sign(signer.privateKey, 1);
  const saved = storage(), cache = new SignedBankCache(saved.disk, signer.publicKey);
  const callback = vi.fn();
  const timed = await cache.refresh(signal => new Promise(() => signal.addEventListener('abort', callback, { once: true })), 5);
  expect(timed).toBe(false);
  expect(callback).toHaveBeenCalledTimes(1);
  const realWrite = saved.disk.setItem;
  saved.disk.setItem = async () => { throw Error('disk unavailable'); };
  expect(await cache.refresh(async () => wire)).toBe(false);
  expect(cache.chooseFresh(base)).toBe(base);
  saved.disk.setItem = async (key, value) => { await realWrite(key, value); throw Error('lost acknowledgement'); };
  expect(await cache.refresh(async () => wire)).toBe(true);
  expect(cache.chooseFresh(base).id).toBe(revision(1).id);
});

it.skipIf(import.meta.env.VITE_CONTENT8_PREVIEW !== '1')('restores a real old remote attempt without replacing its board', async () => {
  const signer = await pair(), saved = storage(), cache = new SignedBankCache(saved.disk, signer.publicKey);
  await cache.refresh(() => sign(signer.privateKey, 1));
  const original = cache.chooseFresh(base);
  const game = freshSave(original, 'archived-bank');
  await cache.refresh(() => sign(signer.privateKey, 2));
  const restored = decodeSave(JSON.stringify(game), id => cache.findPinned(id));
  expect(restored.attempt).toEqual(game.attempt);
  expect(cache.chooseFresh(base).id).not.toBe(restored.attempt.dealId);
});
