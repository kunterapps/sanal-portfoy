/**
 * The whole account (every portfolio with its assets and value history) as
 * one document, which is what goes to Google Drive, plus the rules that decide
 * which side wins when the two differ.
 */
import { PortfolioAsset, PortfolioSnapshot } from '../types/portfolio';
import { parsePortfolioBackup } from './importValidation';
import {
  PortfolioMeta,
  deletePortfolioData,
  loadPortfolioList,
  portfolioStorageKeys,
  sanitizePortfolioList,
  savePortfolioList,
} from './portfolios';

export interface SyncedPortfolio extends PortfolioMeta {
  assets: PortfolioAsset[];
  snapshots: PortfolioSnapshot[];
}

export interface SyncDocument {
  app: 'sanal-portfoy';
  version: 1;
  /** When the device that wrote it last saved it */
  updatedAt: string;
  portfolios: SyncedPortfolio[];
}

function readArray(storage: Storage, key: string): unknown[] {
  try {
    const value = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/** Everything this browser holds, in list order */
export function readLocalPortfolios(storage: Storage = localStorage): SyncedPortfolio[] {
  return loadPortfolioList(storage).map((meta) => {
    const keys = portfolioStorageKeys(meta.id);
    return {
      ...meta,
      assets: readArray(storage, keys.assets) as PortfolioAsset[],
      snapshots: readArray(storage, keys.snapshots) as PortfolioSnapshot[],
    };
  });
}

export function buildSyncDocument(portfolios: SyncedPortfolio[], now = new Date()): SyncDocument {
  return { app: 'sanal-portfoy', version: 1, updatedAt: now.toISOString(), portfolios };
}

/** Short fingerprint of the content, to tell whether anything changed since the last sync */
export function contentHash(portfolios: SyncedPortfolio[]): string {
  const text = JSON.stringify(portfolios);
  let h1 = 0x811c9dc5;
  let h2 = 5381;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2, 33) ^ c;
  }
  return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}:${text.length}`;
}

/** Validates a document read from Drive; null if it isn't one */
export function parseSyncDocument(value: unknown): SyncDocument | null {
  if (!value || typeof value !== 'object') return null;
  const doc = value as Record<string, unknown>;
  if (doc.app !== 'sanal-portfoy' || !Array.isArray(doc.portfolios) || doc.portfolios.length === 0) return null;
  const metas = sanitizePortfolioList(doc.portfolios);
  const raw = new Map(
    (doc.portfolios as unknown[])
      .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
      .map((p) => [p.id, p])
  );
  const portfolios = metas.map((meta): SyncedPortfolio => {
    const source = raw.get(meta.id) ?? {};
    const parsed = parsePortfolioBackup({ assets: Array.isArray(source.assets) ? source.assets : [], snapshots: source.snapshots });
    return { ...meta, assets: parsed.assets, snapshots: parsed.snapshots };
  });
  return {
    app: 'sanal-portfoy',
    version: 1,
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : new Date(0).toISOString(),
    portfolios,
  };
}

/** Replaces this browser's portfolios with the given ones */
export function writeLocalPortfolios(portfolios: SyncedPortfolio[], storage: Storage = localStorage) {
  const keep = new Set(portfolios.map((p) => p.id));
  for (const old of loadPortfolioList(storage)) {
    if (!keep.has(old.id)) deletePortfolioData(old.id, storage);
  }
  for (const p of portfolios) {
    const keys = portfolioStorageKeys(p.id);
    storage.setItem(keys.assets, JSON.stringify(p.assets));
    storage.setItem(keys.snapshots, JSON.stringify(p.snapshots));
  }
  savePortfolioList(
    portfolios.map(({ id, name, createdAt }) => ({ id, name, createdAt })),
    storage
  );
}

export const countAssets = (portfolios: SyncedPortfolio[]) => portfolios.reduce((n, p) => n + p.assets.length, 0);

export type SyncAction = 'none' | 'push' | 'adopt' | 'ask';

export interface SyncInputs {
  /** Drive's modifiedTime of the file, or null when there is no file yet */
  remoteModified: string | null;
  /** Drive's modifiedTime the last time this browser synced; null before the first sync */
  lastRemoteModified: string | null;
  localHash: string;
  lastSyncedHash: string | null;
  /** When this browser first changed something that isn't on Drive yet (ISO), if any */
  dirtySince: string | null;
  /** Needed only when both sides changed, or on the first sync */
  remote?: { updatedAt: string; hash: string; empty: boolean } | null;
  localEmpty: boolean;
}

/**
 * Decides what to do. Changes on one side only are copied over; when both
 * sides changed, the later edit wins (the whole account, not per asset). On
 * the very first sync of a browser that already has data, the user picks.
 */
export function decideSync(i: SyncInputs): SyncAction {
  if (!i.remoteModified) return 'push';
  if (!i.lastRemoteModified) {
    if (!i.remote) return 'none';
    if (i.remote.hash === i.localHash) return 'none';
    if (i.localEmpty) return 'adopt';
    if (i.remote.empty) return 'push';
    return 'ask';
  }
  const remoteChanged = i.remoteModified !== i.lastRemoteModified;
  const localChanged = i.localHash !== i.lastSyncedHash;
  if (!remoteChanged) return localChanged ? 'push' : 'none';
  if (!localChanged) return 'adopt';
  // Both changed: an edit made here after the other device saved wins
  if (i.dirtySince && i.remote && i.dirtySince > i.remote.updatedAt) return 'push';
  return 'adopt';
}
