import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  Edit2,
  Trash2,
  DollarSign,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ArrowLeftRight,
} from 'lucide-react';
import { PortfolioAsset, Currency, ExchangeRates } from '../types/portfolio';
import {
  getAssetProfitLoss,
  getExposureCurrency,
  formatCurrency,
  formatPercent,
  formatNumber,
  CATEGORY_METADATA,
  CURRENCY_METADATA,
} from '../utils/portfolioCalculations';
import { getGoldDisplayDetails } from '../utils/goldCalculations';
import { isClosedPosition } from '../utils/transactions';

interface AssetTableProps {
  assets: PortfolioAsset[];
  rates: ExchangeRates;
  baseCurrency: Currency;
  /** Price change since the previous recorded day, as a fraction, by asset id */
  dayChanges: Record<string, number>;
  onEditAsset: (asset: PortfolioAsset) => void;
  onQuickPriceEdit: (asset: PortfolioAsset) => void;
  onOpenTransactions: (asset: PortfolioAsset) => void;
  onDeleteAsset: (id: string) => void;
}

type SortField = 'symbol' | 'value' | 'share' | 'profit' | 'price' | 'quantity' | 'day';
type SortDirection = 'asc' | 'desc';
type GroupMode = 'CATEGORY' | 'CURRENCY' | 'NONE';

const GROUP_STORAGE_KEY = 'my_personal_portfolio_table_group';

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'value', label: 'Değer' },
  { field: 'day', label: 'Gün' },
  { field: 'profit', label: 'Kâr / Zarar' },
  { field: 'share', label: 'Pay' },
  { field: 'symbol', label: 'Sembol' },
  { field: 'price', label: 'Fiyat' },
  { field: 'quantity', label: 'Miktar' },
];

const GROUP_OPTIONS: { key: GroupMode; label: string }[] = [
  { key: 'CATEGORY', label: 'Sınıf' },
  { key: 'CURRENCY', label: 'Para birimi' },
  { key: 'NONE', label: 'Yok' },
];

const TABS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'Tümü' },
  { key: 'FOREIGN_STOCK', label: 'Yabancı' },
  { key: 'BIST', label: 'BIST' },
  { key: 'COMMODITY', label: 'Altın' },
  { key: 'CRYPTO', label: 'Kripto' },
  { key: 'TEFAS_BEFAS', label: 'Fon' },
  { key: 'CASH', label: 'Nakit' },
];

const matchesTab = (asset: PortfolioAsset, tab: string) =>
  tab === 'ALL' ||
  (tab === 'TEFAS_BEFAS' ? asset.category === 'TEFAS' || asset.category === 'BEFAS' : asset.category === tab);

const loadGroupMode = (): GroupMode => {
  try {
    const stored = localStorage.getItem(GROUP_STORAGE_KEY);
    if (stored === 'CATEGORY' || stored === 'CURRENCY' || stored === 'NONE') return stored;
  } catch {}
  return 'CATEGORY';
};

const tone = (n: number) => (n >= 0 ? 'text-emerald-400' : 'text-rose-400');

const DayChange: React.FC<{ change: number | undefined }> = ({ change }) => {
  if (change === undefined) {
    return (
      <span className="text-slate-600" title="Önceki güne ait fiyat kaydı yok">
        —
      </span>
    );
  }
  const pct = change * 100;
  if (Math.abs(pct) < 0.005) return <span className="text-slate-500">0,00%</span>;
  return <span className={tone(pct)}>{formatPercent(pct)}</span>;
};

export const AssetTable: React.FC<AssetTableProps> = ({
  assets,
  rates,
  baseCurrency,
  dayChanges,
  onEditAsset,
  onQuickPriceEdit,
  onOpenTransactions,
  onDeleteAsset,
}) => {
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [groupMode, setGroupModeState] = useState<GroupMode>(loadGroupMode);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const setGroupMode = (mode: GroupMode) => {
    setGroupModeState(mode);
    setCollapsed(new Set());
    try {
      localStorage.setItem(GROUP_STORAGE_KEY, mode);
    } catch {}
  };

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const processedAssets = useMemo(() => {
    const totalValueTRY = assets.reduce((sum, a) => sum + getAssetProfitLoss(a, rates).valueTRY, 0);
    return assets.map((asset) => {
      const pl = getAssetProfitLoss(asset, rates);
      const isTRY = baseCurrency === 'TRY';
      return {
        ...asset,
        pl,
        displayValue: isTRY ? pl.valueTRY : pl.valueUSD,
        displayCost: isTRY ? pl.costTRY : pl.costUSD,
        displayProfit: isTRY ? pl.profitTRY : pl.profitUSD,
        portfolioSharePercent: totalValueTRY > 0 ? (pl.valueTRY / totalValueTRY) * 100 : 0,
        dayChange: dayChanges[asset.id] as number | undefined,
      };
    });
  }, [assets, rates, baseCurrency, dayChanges]);

  type Row = (typeof processedAssets)[number];

  const filteredAndSortedAssets = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return processedAssets
      .filter((asset) => {
        if (!matchesTab(asset, activeTab)) return false;
        if (!q) return true;
        return (
          asset.symbol.toLowerCase().includes(q) ||
          asset.name.toLowerCase().includes(q) ||
          (CATEGORY_METADATA[asset.category]?.label || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'symbol') diff = a.symbol.localeCompare(b.symbol);
        else if (sortField === 'value') diff = a.displayValue - b.displayValue;
        else if (sortField === 'share') diff = a.portfolioSharePercent - b.portfolioSharePercent;
        else if (sortField === 'profit') diff = a.pl.profitPercent - b.pl.profitPercent;
        else if (sortField === 'price') diff = a.currentPrice - b.currentPrice;
        else if (sortField === 'quantity') diff = a.quantity - b.quantity;
        else if (sortField === 'day') diff = (a.dayChange ?? -Infinity) - (b.dayChange ?? -Infinity);
        return sortDirection === 'desc' ? -diff : diff;
      });
  }, [processedAssets, activeTab, searchQuery, sortField, sortDirection]);

  // Rows split into groups with subtotals; one unnamed group when grouping is off
  const groups = useMemo(() => {
    if (groupMode === 'NONE') {
      return [{ key: 'ALL', label: '', color: '', rows: filteredAndSortedAssets }];
    }
    const byKey = new Map<string, Row[]>();
    filteredAndSortedAssets.forEach((row) => {
      const key = groupMode === 'CATEGORY' ? row.category : getExposureCurrency(row);
      byKey.set(key, [...(byKey.get(key) ?? []), row]);
    });
    return [...byKey.entries()]
      .map(([key, rows]) => ({
        key,
        label:
          groupMode === 'CATEGORY'
            ? CATEGORY_METADATA[key as keyof typeof CATEGORY_METADATA].label
            : CURRENCY_METADATA[key as Currency].label,
        color:
          groupMode === 'CATEGORY'
            ? CATEGORY_METADATA[key as keyof typeof CATEGORY_METADATA].color
            : CURRENCY_METADATA[key as Currency].color,
        rows,
      }))
      .sort(
        (a, b) =>
          b.rows.reduce((s, r) => s + r.pl.valueTRY, 0) - a.rows.reduce((s, r) => s + r.pl.valueTRY, 0)
      );
  }, [filteredAndSortedAssets, groupMode]);

  const groupTotals = (rows: Row[]) => {
    const value = rows.reduce((s, r) => s + r.displayValue, 0);
    const cost = rows.reduce((s, r) => s + r.displayCost, 0);
    const share = rows.reduce((s, r) => s + r.portfolioSharePercent, 0);
    // Value-weighted day change over the rows that have one
    let before = 0;
    let now = 0;
    rows.forEach((r) => {
      if (r.dayChange === undefined) return;
      now += r.displayValue;
      before += r.displayValue / (1 + r.dayChange);
    });
    return {
      value,
      profit: value - cost,
      profitPercent: cost > 0 ? ((value - cost) / cost) * 100 : 0,
      share,
      dayChange: before > 0 ? now / before - 1 : undefined,
    };
  };

  const emptyMessage = searchQuery
    ? 'Arama kriterlerine uygun varlık bulunamadı.'
    : 'Bu kategoride henüz bir varlık eklenmedi.';

  const unitLabel = (asset: PortfolioAsset) => {
    const gold = asset.category === 'COMMODITY' && asset.goldType ? getGoldDisplayDetails(asset.goldType) : null;
    return gold && !gold.isUnitPiece ? 'gr' : 'ad.';
  };

  const badges = (asset: PortfolioAsset) => {
    const gold = asset.category === 'COMMODITY' && asset.goldType ? getGoldDisplayDetails(asset.goldType) : null;
    return (
      <>
        {isClosedPosition(asset) && (
          <span className="text-xs px-1.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Kapandı</span>
        )}
        {gold && (
          <span className="text-xs px-1.5 rounded bg-amber-950/40 text-amber-300 border border-amber-900/40">
            {gold.shortName}
          </span>
        )}
      </>
    );
  };

  const SortHeader: React.FC<{ field: SortField; children: React.ReactNode; align?: 'left' | 'right' }> = ({
    field,
    children,
    align = 'right',
  }) => (
    <th
      onClick={() => handleSort(field)}
      className={`py-2.5 px-3 cursor-pointer hover:text-white transition-colors select-none ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${sortField === field ? 'text-slate-200' : ''}`}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {children}
        {sortField === field ? (
          sortDirection === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-600" />
        )}
      </span>
    </th>
  );

  const iconButton =
    'w-7 h-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-700/70 focus-visible:text-white focus-visible:bg-slate-700/70 transition-colors';

  return (
    <section className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden">
      {/* Toolbar: category filter, search, grouping */}
      <div className="p-3 sm:p-4 border-b border-slate-800 space-y-3">
        <div className="flex flex-col-reverse xl:flex-row xl:items-center justify-between gap-3">
          <div className="no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 flex items-center gap-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible">
            {TABS.map((tab) => {
              const count = assets.filter((a) => matchesTab(a, tab.key)).length;
              if (count === 0 && tab.key !== 'ALL') return null;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`h-8 px-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors flex shrink-0 items-center gap-1.5 border ${
                    isActive
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'text-slate-300 hover:text-white bg-slate-900/60 border-slate-800 hover:bg-slate-800/60'
                  }`}
                >
                  {tab.label}
                  <span className={`text-xs tabular-nums ${isActive ? 'text-indigo-200' : 'text-slate-500'}`}>{count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 w-full xl:w-auto xl:flex-nowrap">
            <div className="relative flex-1 min-w-[10rem] xl:w-56">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Varlık ara..."
                className="w-full h-8 bg-slate-900 border border-slate-800 text-sm text-slate-200 placeholder:text-slate-500 pl-9 pr-3 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Sort control for the card list (the table sorts via its headers) */}
            <div className="md:hidden flex items-center shrink-0">
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                aria-label="Sıralama"
                className="h-8 bg-slate-900 border border-slate-800 text-sm text-slate-200 pl-2 pr-1 rounded-l-lg focus:outline-none focus:border-indigo-500"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.field} value={o.field}>{o.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                aria-label={sortDirection === 'desc' ? 'Azalan sıralama' : 'Artan sıralama'}
                className="h-8 w-8 inline-flex items-center justify-center bg-slate-900 border border-l-0 border-slate-800 text-slate-300 rounded-r-lg"
              >
                {sortDirection === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="hidden sm:inline text-xs text-slate-500">Grupla</span>
              <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                {GROUP_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setGroupMode(o.key)}
                    className={`h-7 px-2 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                      groupMode === o.key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card list for phones */}
      <ul className="md:hidden divide-y divide-slate-800/60">
        {filteredAndSortedAssets.length === 0 ? (
          <li className="text-center py-12 px-4 text-sm text-slate-500">{emptyMessage}</li>
        ) : (
          groups.map((group) => {
            const t = groupTotals(group.rows);
            const isCollapsed = collapsed.has(group.key);
            return (
              <React.Fragment key={group.key}>
                {groupMode !== 'NONE' && (
                  <li>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-900/70 text-left"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                        <span className="font-semibold text-slate-100 truncate">{group.label}</span>
                        <span className="text-xs text-slate-500">{group.rows.length}</span>
                      </span>
                      <span className="text-right tabular-nums text-sm shrink-0">
                        <span className="font-semibold text-white">{formatCurrency(t.value, baseCurrency, 0)}</span>
                        <span className={`ml-2 text-xs ${tone(t.profit)}`}>{formatPercent(t.profitPercent)}</span>
                      </span>
                    </button>
                  </li>
                )}
                {!isCollapsed &&
                  group.rows.map((asset) => (
                    <li key={asset.id} className={`px-4 py-3.5 space-y-3 ${isClosedPosition(asset) ? 'opacity-60' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className="w-2 h-2 rounded-full mt-2 shrink-0"
                            style={{ backgroundColor: CATEGORY_METADATA[asset.category]?.color || '#94a3b8' }}
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-slate-100">{asset.symbol}</span>
                              {badges(asset)}
                            </div>
                            <div className="text-xs text-slate-400 truncate mt-0.5">{asset.name}</div>
                          </div>
                        </div>
                        <div className="text-right tabular-nums shrink-0">
                          <div className="font-semibold text-slate-100">
                            <span className="text-xs font-medium text-slate-500 mr-1.5" title="Portföy payı">
                              %{asset.portfolioSharePercent.toFixed(1)}
                            </span>
                            {formatCurrency(asset.displayValue, baseCurrency, 0)}
                          </div>
                          <div className={`text-xs font-medium ${tone(asset.displayProfit)}`}>
                            {asset.displayProfit >= 0 ? '+' : ''}
                            {formatCurrency(asset.displayProfit, baseCurrency, 0)} · {formatPercent(asset.pl.profitPercent)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
                        <div className="min-w-0">
                          <div className="text-slate-500">Miktar</div>
                          <div className="text-slate-200 font-medium truncate">
                            {formatNumber(asset.quantity, asset.quantity % 1 === 0 ? 0 : 4)}{' '}
                            <span className="text-slate-500">{unitLabel(asset)}</span>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-slate-500">Ort. Maliyet</div>
                          <div className="text-slate-300 truncate">{formatCurrency(asset.costPrice, asset.costCurrency, 2)}</div>
                        </div>
                        <div className="min-w-0 text-right">
                          <div className="text-slate-500">
                            Fiyat · <DayChange change={asset.dayChange} />
                          </div>
                          <div className="text-white font-medium truncate">
                            {formatCurrency(asset.currentPrice, asset.currentCurrency, 2)}
                          </div>
                        </div>
                      </div>

                      {asset.priceStale && (
                        <div className="flex items-center gap-1 text-xs text-amber-400">
                          <AlertTriangle className="w-3 h-3" />
                          Son güncellemede canlı fiyat alınamadı, gösterilen fiyat eski.
                        </div>
                      )}
                      {asset.fxExposurePct !== undefined && (
                        <div className="text-xs text-slate-500">Fon portföyünün %{asset.fxExposurePct.toFixed(1)}'i döviz</div>
                      )}
                      {!!asset.realizedProfit && (
                        <div className={`text-xs ${asset.realizedProfit > 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                          Gerçekleşmiş K/Z: {asset.realizedProfit > 0 ? '+' : '-'}
                          {formatCurrency(Math.abs(asset.realizedProfit), asset.costCurrency, 0)}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onOpenTransactions(asset)}
                          className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/30 active:bg-emerald-950/60 border border-emerald-900/40 rounded-lg"
                        >
                          <ArrowLeftRight className="w-4 h-4" />
                          Alış / Satış
                        </button>
                        <button
                          onClick={() => onQuickPriceEdit(asset)}
                          className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-300 bg-indigo-950/30 active:bg-indigo-950/60 border border-indigo-900/40 rounded-lg"
                        >
                          <DollarSign className="w-4 h-4" />
                          Fiyat
                        </button>
                        <button
                          onClick={() => onEditAsset(asset)}
                          aria-label="Varlığı Düzenle"
                          className="w-9 h-9 shrink-0 inline-flex items-center justify-center text-slate-300 bg-slate-800/80 active:bg-slate-700 rounded-lg"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteAsset(asset.id)}
                          aria-label="Varlığı Sil"
                          className="w-9 h-9 shrink-0 inline-flex items-center justify-center text-rose-400 bg-rose-950/20 active:bg-rose-950/50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
              </React.Fragment>
            );
          })
        )}
      </ul>

      {/* Table from md up */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500 text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-b border-slate-800">
            <tr>
              <SortHeader field="symbol" align="left">Varlık</SortHeader>
              <SortHeader field="quantity">Miktar</SortHeader>
              <th className="py-2.5 px-3 text-right hidden 2xl:table-cell">Ort. Maliyet</th>
              <SortHeader field="price">Fiyat</SortHeader>
              <SortHeader field="day">Gün</SortHeader>
              <SortHeader field="value">Değer</SortHeader>
              <SortHeader field="share">Pay</SortHeader>
              <SortHeader field="profit">K/Z</SortHeader>
              <th className="py-2.5 px-3 w-[7.5rem]">
                <span className="sr-only">İşlemler</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredAndSortedAssets.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-slate-500">{emptyMessage}</td>
              </tr>
            ) : (
              groups.map((group) => {
                const t = groupTotals(group.rows);
                const isCollapsed = collapsed.has(group.key);
                return (
                  <React.Fragment key={group.key}>
                    {groupMode !== 'NONE' && (
                      <tr
                        onClick={() => toggleGroup(group.key)}
                        className="bg-slate-900/70 border-y border-slate-800 cursor-pointer select-none hover:bg-slate-900 tabular-nums whitespace-nowrap"
                      >
                        <td className="py-2 px-3" colSpan={2}>
                          <span className="flex items-center gap-2">
                            <ChevronRight
                              className={`w-4 h-4 text-slate-500 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                            />
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                            <span className="font-semibold text-slate-100">{group.label}</span>
                            <span className="text-xs text-slate-500">{group.rows.length} varlık</span>
                          </span>
                        </td>
                        <td className="hidden 2xl:table-cell" />
                        <td />
                        <td className="py-2 px-3 text-right font-medium">
                          <DayChange change={t.dayChange} />
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-white">
                          {formatCurrency(t.value, baseCurrency, 0)}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-300">%{t.share.toFixed(1)}</td>
                        <td className={`py-2 px-3 text-right font-semibold ${tone(t.profit)}`}>
                          {t.profit >= 0 ? '+' : ''}
                          {formatCurrency(t.profit, baseCurrency, 0)}
                          <span className="ml-1.5 text-xs font-medium">{formatPercent(t.profitPercent)}</span>
                        </td>
                        <td />
                      </tr>
                    )}

                    {!isCollapsed &&
                      group.rows.map((asset) => (
                        <tr
                          key={asset.id}
                          className={`group border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${
                            isClosedPosition(asset) ? 'opacity-60' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-start gap-2.5">
                              <span
                                className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                                style={{ backgroundColor: CATEGORY_METADATA[asset.category]?.color || '#94a3b8' }}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-slate-100">{asset.symbol}</span>
                                  {badges(asset)}
                                </div>
                                <div className="text-xs text-slate-500 truncate max-w-[13rem]" title={asset.name}>
                                  {asset.name}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-slate-200">
                            {formatNumber(asset.quantity, asset.quantity % 1 === 0 ? 0 : 4)}
                            <span className="text-slate-500 text-xs ml-1">{unitLabel(asset)}</span>
                          </td>

                          <td
                            className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-slate-400 hidden 2xl:table-cell"
                            title={`Toplam maliyet ${formatCurrency(asset.quantity * asset.costPrice, asset.costCurrency, 0)}`}
                          >
                            {formatCurrency(asset.costPrice, asset.costCurrency, 2)}
                          </td>

                          <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-slate-100">
                              {asset.priceStale && (
                                <span
                                  title={`Son güncellemede canlı fiyat alınamadı. Gösterilen fiyat: ${new Date(asset.lastUpdated).toLocaleString('tr-TR')}`}
                                >
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" aria-label="Eski fiyat" />
                                </span>
                              )}
                              {formatCurrency(asset.currentPrice, asset.currentCurrency, 2)}
                            </span>
                            {asset.fxExposurePct !== undefined && (
                              <div
                                className="text-xs text-slate-500"
                                title="TEFAS portföy dağılımına göre döviz, altın ve yabancı menkul kıymet payı"
                              >
                                Döviz %{asset.fxExposurePct.toFixed(1)}
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-medium">
                            <DayChange change={asset.dayChange} />
                          </td>

                          <td
                            className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-semibold text-white"
                            title={baseCurrency === 'TRY' ? `≈ $${formatNumber(asset.pl.valueUSD, 0)}` : `≈ ₺${formatNumber(asset.pl.valueTRY, 0)}`}
                          >
                            {formatCurrency(asset.displayValue, baseCurrency, 0)}
                          </td>

                          <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-slate-400">
                            %{asset.portfolioSharePercent.toFixed(1)}
                          </td>

                          <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                            <div className={`font-semibold ${tone(asset.displayProfit)}`}>
                              {asset.displayProfit >= 0 ? '+' : ''}
                              {formatCurrency(asset.displayProfit, baseCurrency, 0)}
                            </div>
                            <div className={`text-xs ${tone(asset.displayProfit)}`}>
                              {formatPercent(asset.pl.profitPercent)}
                              {!!asset.realizedProfit && (
                                <span
                                  className="text-slate-500 ml-1.5"
                                  title="Satışlardan gerçekleşen kâr/zarar"
                                >
                                  Gerç. {asset.realizedProfit > 0 ? '+' : '-'}
                                  {formatCurrency(Math.abs(asset.realizedProfit), asset.costCurrency, 0)}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* With a mouse, actions show on hover or keyboard focus to keep rows quiet; touch screens always show them */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center justify-end gap-0.5 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              <button onClick={() => onOpenTransactions(asset)} title="Alış / Satış" className={`${iconButton} hover:text-emerald-300`}>
                                <ArrowLeftRight className="w-4 h-4" />
                              </button>
                              <button onClick={() => onQuickPriceEdit(asset)} title="Fiyatı elle değiştir" className={iconButton}>
                                <DollarSign className="w-4 h-4" />
                              </button>
                              <button onClick={() => onEditAsset(asset)} title="Düzenle" className={iconButton}>
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => onDeleteAsset(asset.id)} title="Sil" className={`${iconButton} hover:text-rose-400`}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {filteredAndSortedAssets.length !== assets.length && (
        <div className="px-4 py-2.5 border-t border-slate-800 text-xs text-slate-500 tabular-nums">
          Gösterilen: {filteredAndSortedAssets.length} / {assets.length} varlık
        </div>
      )}
    </section>
  );
};
