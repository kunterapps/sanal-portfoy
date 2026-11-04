/**
 * Several portfolios side by side. Each portfolio keeps its own assets and
 * value history in localStorage; exchange rates and indices are shared.
 * The first portfolio uses the original storage keys, so data saved before
 * this feature shows up as "Ana Portföy" without any migration.
 */

export interface PortfolioMeta {
  id: string;
  name: string;
  createdAt: string;
}

export const DEFAULT_PORTFOLIO_ID = 'default';
export const DEFAULT_PORTFOLIO_NAME = 'Ana Portföy';
export const MAX_PORTFOLIO_NAME = 40;

const LIST_KEY = 'my_personal_portfolio_list';
const ACTIVE_KEY = 'my_personal_portfolio_active';
const ASSETS_KEY = 'my_personal_portfolio_assets';
const SNAPSHOTS_KEY = 'my_personal_portfolio_snapshots';

export function portfolioStorageKeys(id: string) {
  const suffix = id === DEFAULT_PORTFOLIO_ID ? '' : `__${id}`;
  return { assets: `${ASSETS_KEY}${suffix}`, snapshots: `${SNAPSHOTS_KEY}${suffix}` };
}

const defaultPortfolio = (): PortfolioMeta => ({
  id: DEFAULT_PORTFOLIO_ID,
  name: DEFAULT_PORTFOLIO_NAME,
  createdAt: new Date(0).toISOString(),
});

/** Keeps only well-formed entries with unique ids; never returns an empty list. */
export function sanitizePortfolioList(value: unknown): PortfolioMeta[] {
  const seen = new Set<string>();
  const list: PortfolioMeta[] = [];
  if (Array.isArray(value)) {
    for (const raw of value) {
      if (!raw || typeof raw !== 'object') continue;
      const p = raw as Record<string, unknown>;
      if (typeof p.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(p.id) || seen.has(p.id)) continue;
      const name = typeof p.name === 'string' ? cleanPortfolioName(p.name) : '';
      seen.add(p.id);
      list.push({
        id: p.id,
        name: name || DEFAULT_PORTFOLIO_NAME,
        createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date(0).toISOString(),
      });
    }
  }
  return list.length > 0 ? list : [defaultPortfolio()];
}

export function cleanPortfolioName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_PORTFOLIO_NAME);
}

export function loadPortfolioList(storage: Storage = localStorage): PortfolioMeta[] {
  try {
    return sanitizePortfolioList(JSON.parse(storage.getItem(LIST_KEY) || 'null'));
  } catch {
    return [defaultPortfolio()];
  }
}

export function savePortfolioList(list: PortfolioMeta[], storage: Storage = localStorage) {
  try {
    storage.setItem(LIST_KEY, JSON.stringify(list));
  } catch {}
}

export function loadActivePortfolioId(list: PortfolioMeta[], storage: Storage = localStorage): string {
  try {
    const id = storage.getItem(ACTIVE_KEY);
    if (id && list.some((p) => p.id === id)) return id;
  } catch {}
  return list[0].id;
}

export function saveActivePortfolioId(id: string, storage: Storage = localStorage) {
  try {
    storage.setItem(ACTIVE_KEY, id);
  } catch {}
}

/** A name that isn't taken yet: "Yeni Portföy", "Yeni Portföy 2", ... */
export function uniquePortfolioName(base: string, list: PortfolioMeta[]): string {
  const taken = new Set(list.map((p) => p.name.toLocaleLowerCase('tr-TR')));
  const clean = cleanPortfolioName(base) || 'Yeni Portföy';
  if (!taken.has(clean.toLocaleLowerCase('tr-TR'))) return clean;
  for (let n = 2; ; n++) {
    const candidate = `${clean.slice(0, MAX_PORTFOLIO_NAME - 3)} ${n}`;
    if (!taken.has(candidate.toLocaleLowerCase('tr-TR'))) return candidate;
  }
}

export function createPortfolio(name: string, list: PortfolioMeta[], now = new Date()): PortfolioMeta {
  return {
    id: `p_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: uniquePortfolioName(name, list),
    createdAt: now.toISOString(),
  };
}

/** Removes a portfolio's own data. The caller drops it from the list. */
export function deletePortfolioData(id: string, storage: Storage = localStorage) {
  const keys = portfolioStorageKeys(id);
  try {
    storage.removeItem(keys.assets);
    storage.removeItem(keys.snapshots);
  } catch {}
}
