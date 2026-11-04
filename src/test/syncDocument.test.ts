import { describe, expect, it } from 'vitest';
import {
  SyncInputs,
  buildSyncDocument,
  contentHash,
  decideSync,
  parseSyncDocument,
  readLocalPortfolios,
  writeLocalPortfolios,
} from '../utils/syncDocument';
import { makeAsset } from './fixtures';
import { memoryStorage } from './memoryStorage';
import { ensureTransactions } from '../utils/transactions';

const asset = ensureTransactions(makeAsset());

describe('sync document', () => {
  it('reads every portfolio from local storage', () => {
    const storage = memoryStorage({
      my_personal_portfolio_list: JSON.stringify([
        { id: 'default', name: 'Ana Portföy', createdAt: 'x' },
        { id: 'p_2', name: 'Emeklilik', createdAt: 'y' },
      ]),
      my_personal_portfolio_assets: JSON.stringify([asset]),
      my_personal_portfolio_assets__p_2: '[]',
    });
    const local = readLocalPortfolios(storage);
    expect(local.map((p) => [p.name, p.assets.length, p.snapshots.length])).toEqual([
      ['Ana Portföy', 1, 0],
      ['Emeklilik', 0, 0],
    ]);
  });

  it('round-trips through Drive and replaces local portfolios', () => {
    const doc = buildSyncDocument([
      { id: 'p_9', name: 'Drive', createdAt: 'z', assets: [asset], snapshots: [] },
    ]);
    const parsed = parseSyncDocument(JSON.parse(JSON.stringify(doc)));
    expect(parsed?.portfolios[0]).toMatchObject({ id: 'p_9', name: 'Drive' });
    expect(parsed?.portfolios[0].assets[0].symbol).toBe('THYAO');

    const storage = memoryStorage({
      my_personal_portfolio_assets: JSON.stringify([asset]),
      my_personal_portfolio_active: 'default',
    });
    writeLocalPortfolios(parsed!.portfolios, storage);
    expect(storage.getItem('my_personal_portfolio_assets')).toBeNull();
    expect(readLocalPortfolios(storage).map((p) => p.id)).toEqual(['p_9']);
    expect(contentHash(readLocalPortfolios(storage))).toBe(contentHash(parsed!.portfolios));
  });

  it('rejects files that are not sync documents', () => {
    expect(parseSyncDocument(null)).toBeNull();
    expect(parseSyncDocument({ app: 'other', portfolios: [] })).toBeNull();
    expect(parseSyncDocument([asset])).toBeNull();
  });

  it('hashes content changes', () => {
    const a = [{ id: 'default', name: 'A', createdAt: 'x', assets: [asset], snapshots: [] }];
    const b = [{ ...a[0], assets: [{ ...asset, quantity: 11 }] }];
    expect(contentHash(a)).toBe(contentHash(JSON.parse(JSON.stringify(a))));
    expect(contentHash(a)).not.toBe(contentHash(b));
  });
});

describe('decideSync', () => {
  const base: SyncInputs = {
    remoteModified: 'r1',
    lastRemoteModified: 'r1',
    localHash: 'h1',
    lastSyncedHash: 'h1',
    dirtySince: null,
    remote: null,
    localEmpty: false,
  };
  const remote = (updatedAt: string, hash = 'h2', empty = false) => ({ updatedAt, hash, empty });

  it('creates the Drive file when there is none', () => {
    expect(decideSync({ ...base, remoteModified: null })).toBe('push');
  });

  it('does nothing when neither side changed', () => {
    expect(decideSync(base)).toBe('none');
  });

  it('uploads local-only changes and takes remote-only changes', () => {
    expect(decideSync({ ...base, localHash: 'h3' })).toBe('push');
    expect(decideSync({ ...base, remoteModified: 'r2', remote: remote('2026-11-04T10:00:00Z') })).toBe('adopt');
  });

  it('lets the later edit win when both changed', () => {
    const both = { ...base, remoteModified: 'r2', localHash: 'h3', remote: remote('2026-11-04T10:00:00Z') };
    expect(decideSync({ ...both, dirtySince: '2026-11-04T11:00:00Z' })).toBe('push');
    expect(decideSync({ ...both, dirtySince: '2026-11-04T09:00:00Z' })).toBe('adopt');
    // Changes that aren't edits (startup price refresh) never beat the other device
    expect(decideSync({ ...both, dirtySince: null })).toBe('adopt');
  });

  it('asks on the first sync only when both sides have different data', () => {
    const first = { ...base, lastRemoteModified: null, lastSyncedHash: null };
    expect(decideSync({ ...first, remote: remote('t', 'h1') })).toBe('none');
    expect(decideSync({ ...first, remote: remote('t'), localEmpty: true })).toBe('adopt');
    expect(decideSync({ ...first, remote: remote('t', 'h2', true) })).toBe('push');
    expect(decideSync({ ...first, remote: remote('t') })).toBe('ask');
  });
});
