import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ArrowUpDown, 
  Edit2, 
  Trash2, 
  DollarSign, 
  ExternalLink,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  ArrowLeftRight
} from 'lucide-react';
import { PortfolioAsset, AssetCategory, Currency, ExchangeRates } from '../types/portfolio';
import { 
  getAssetProfitLoss, 
  formatCurrency, 
  formatPercent, 
  formatNumber,
  CATEGORY_METADATA 
} from '../utils/portfolioCalculations';
import { getGoldDisplayDetails } from '../utils/goldCalculations';
import { isClosedPosition } from '../utils/transactions';

interface AssetTableProps {
  assets: PortfolioAsset[];
  rates: ExchangeRates;
  baseCurrency: Currency;
  onEditAsset: (asset: PortfolioAsset) => void;
  onQuickPriceEdit: (asset: PortfolioAsset) => void;
  onOpenTransactions: (asset: PortfolioAsset) => void;
  onDeleteAsset: (id: string) => void;
}

type SortField = 'symbol' | 'value' | 'share' | 'profit' | 'price' | 'quantity';
type SortDirection = 'asc' | 'desc';

export const AssetTable: React.FC<AssetTableProps> = ({
  assets,
  rates,
  baseCurrency,
  onEditAsset,
  onQuickPriceEdit,
  onOpenTransactions,
  onDeleteAsset,
}) => {
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const tabs: { key: string; label: string; count?: number }[] = [
    { key: 'ALL', label: 'Tüm Varlıklar' },
    { key: 'FOREIGN_STOCK', label: 'Yabancı ETF & Hisse' },
    { key: 'BIST', label: 'BIST Hisseleri' },
    { key: 'COMMODITY', label: 'Altın & Kıymetli Maden' },
    { key: 'CRYPTO', label: 'Kripto Varlıklar' },
    { key: 'TEFAS_BEFAS', label: 'TEFAS / BEFAS Fonları' },
    { key: 'CASH', label: 'Nakit & Döviz' },
  ];

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const totalPortfolioValueTRY = useMemo(() => {
    return assets.reduce((sum, asset) => {
      const pl = getAssetProfitLoss(asset, rates);
      return sum + pl.valueTRY;
    }, 0);
  }, [assets, rates]);

  const processedAssets = useMemo(() => {
    return assets.map((asset) => {
      const pl = getAssetProfitLoss(asset, rates);
      const displayValue = baseCurrency === 'TRY' ? pl.valueTRY : pl.valueUSD;
      const displayCost = baseCurrency === 'TRY' ? pl.costTRY : pl.costUSD;
      const displayProfit = baseCurrency === 'TRY' ? pl.profitTRY : pl.profitUSD;
      const portfolioSharePercent = totalPortfolioValueTRY > 0 ? (pl.valueTRY / totalPortfolioValueTRY) * 100 : 0;

      return {
        ...asset,
        pl,
        displayValue,
        displayCost,
        displayProfit,
        portfolioSharePercent,
      };
    });
  }, [assets, rates, baseCurrency, totalPortfolioValueTRY]);

  const filteredAndSortedAssets = useMemo(() => {
    return processedAssets
      .filter((asset) => {
        // Category Tab Filter
        if (activeTab === 'TEFAS_BEFAS') {
          if (asset.category !== 'TEFAS' && asset.category !== 'BEFAS') return false;
        } else if (activeTab !== 'ALL' && asset.category !== activeTab) {
          return false;
        }

        // Search Query Filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchSym = asset.symbol.toLowerCase().includes(q);
          const matchName = asset.name.toLowerCase().includes(q);
          const matchCat = (CATEGORY_METADATA[asset.category]?.label || '').toLowerCase().includes(q);
          return matchSym || matchName || matchCat;
        }

        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'symbol') {
          diff = a.symbol.localeCompare(b.symbol);
        } else if (sortField === 'value') {
          diff = a.displayValue - b.displayValue;
        } else if (sortField === 'share') {
          diff = a.portfolioSharePercent - b.portfolioSharePercent;
        } else if (sortField === 'profit') {
          diff = a.pl.profitPercent - b.pl.profitPercent;
        } else if (sortField === 'price') {
          diff = a.currentPrice - b.currentPrice;
        } else if (sortField === 'quantity') {
          diff = a.quantity - b.quantity;
        }
        return sortDirection === 'desc' ? -diff : diff;
      });
  }, [processedAssets, activeTab, searchQuery, sortField, sortDirection]);

  return (
    <section className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Table Toolbar & Category Filter Tabs */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {tabs.map((tab) => {
            const count = tab.key === 'ALL'
              ? assets.length
              : tab.key === 'TEFAS_BEFAS'
              ? assets.filter((a) => a.category === 'TEFAS' || a.category === 'BEFAS').length
              : assets.filter((a) => a.category === tab.key).length;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  activeTab === tab.key
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800/60'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === tab.key ? 'bg-indigo-700/80 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative shrink-0 w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Sembol veya varlık ara..."
            className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 pl-8 pr-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-800">
            <tr>
              <th
                onClick={() => handleSort('symbol')}
                className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Varlık / Sembol</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              <th
                onClick={() => handleSort('quantity')}
                className="py-3.5 px-4 text-right cursor-pointer hover:text-white transition-colors select-none"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Adet / Gramaj</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              <th className="py-3.5 px-4 text-right">
                <span>Ortalama Maliyet</span>
              </th>

              <th
                onClick={() => handleSort('price')}
                className="py-3.5 px-4 text-right cursor-pointer hover:text-white transition-colors select-none"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Anlık Fiyat</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              <th
                onClick={() => handleSort('value')}
                className="py-3.5 px-4 text-right cursor-pointer hover:text-white transition-colors select-none"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Toplam Değer ({baseCurrency})</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              <th
                onClick={() => handleSort('share')}
                className="py-3.5 px-4 text-right cursor-pointer hover:text-white transition-colors select-none"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Portföy Payı (%)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              <th
                onClick={() => handleSort('profit')}
                className="py-3.5 px-4 text-right cursor-pointer hover:text-white transition-colors select-none"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Kâr / Zarar (%)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              <th className="py-3.5 px-4 text-center">İşlemler</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60">
            {filteredAndSortedAssets.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-500">
                  {searchQuery ? 'Arama kriterlerine uygun varlık bulunamadı.' : 'Bu kategoride henüz bir varlık eklenmedi.'}
                </td>
              </tr>
            ) : (
              filteredAndSortedAssets.map((asset) => {
                const isPositive = asset.pl.profitPercent >= 0;
                const isGold = asset.category === 'COMMODITY' && asset.goldType;
                const goldDetails = isGold ? getGoldDisplayDetails(asset.goldType!) : null;

                return (
                  <tr
                    key={asset.id}
                    className={`hover:bg-slate-850/50 transition-colors group ${isClosedPosition(asset) ? 'opacity-60' : ''}`}
                  >
                    {/* Symbol & Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-start gap-2.5">
                        <div
                          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                          style={{ backgroundColor: CATEGORY_METADATA[asset.category]?.color || '#94a3b8' }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-100 font-mono tracking-tight text-sm">
                              {asset.symbol}
                            </span>
                            {isClosedPosition(asset) && (
                              <span className="text-[10px] px-1.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-sans">
                                Kapandı
                              </span>
                            )}
                            {isGold && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/40 text-amber-300 border border-amber-900/40 font-mono">
                                {goldDetails?.shortName}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                            {asset.name}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-200">
                      <span className="font-semibold">{formatNumber(asset.quantity, asset.quantity % 1 === 0 ? 0 : 4)}</span>
                      <span className="text-slate-500 text-[11px] ml-1">
                        {isGold && !goldDetails?.isUnitPiece ? 'gr' : 'ad.'}
                      </span>
                    </td>

                    {/* Cost */}
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-300">
                      <div>
                        {formatCurrency(asset.costPrice, asset.costCurrency, 2)}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Top: {formatCurrency(asset.quantity * asset.costPrice, asset.costCurrency, 0)}
                      </div>
                    </td>

                    {/* Current Price */}
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      <div className="font-bold text-white">
                        {formatCurrency(asset.currentPrice, asset.currentCurrency, 2)}
                      </div>
                      {asset.priceStale && (
                        <div
                          className="inline-flex items-center gap-1 text-[10px] text-amber-400"
                          title={`Son güncellemede canlı fiyat alınamadı. Gösterilen fiyat: ${new Date(asset.lastUpdated).toLocaleString('tr-TR')}`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Eski fiyat
                        </div>
                      )}
                      <button
                        onClick={() => onQuickPriceEdit(asset)}
                        title="Fiyatı elle güncelle"
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 underline inline-block"
                      >
                        Fiyat Değiştir
                      </button>
                    </td>

                    {/* Total Value */}
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      <div className="font-bold text-indigo-300 text-sm">
                        {formatCurrency(asset.displayValue, baseCurrency, 2)}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {baseCurrency === 'TRY' ? `≈ $${formatNumber(asset.pl.valueUSD, 0)}` : `≈ ₺${formatNumber(asset.pl.valueTRY, 0)}`}
                      </div>
                    </td>

                    {/* Portföy Payı (%) */}
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      <div className="font-bold text-slate-200 text-xs">
                        %{asset.portfolioSharePercent.toFixed(1)}
                      </div>
                      <div className="w-16 h-1.5 bg-slate-900 rounded-full overflow-hidden ml-auto mt-1 border border-slate-800">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(3, asset.portfolioSharePercent))}%`,
                            backgroundColor: CATEGORY_METADATA[asset.category]?.color || '#6366f1',
                          }}
                        />
                      </div>
                    </td>

                    {/* Profit / Loss */}
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      <div className={`font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? '+' : ''}{formatCurrency(asset.displayProfit, baseCurrency, 0)}
                      </div>
                      <div className={`text-[11px] font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatPercent(asset.pl.profitPercent)}
                      </div>
                      {!!asset.realizedProfit && (
                        <div
                          className={`text-[10px] ${asset.realizedProfit > 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}
                          title="Satışlardan gerçekleşen kâr/zarar"
                        >
                          Gerç.: {asset.realizedProfit > 0 ? '+' : '-'}
                          {formatCurrency(Math.abs(asset.realizedProfit), asset.costCurrency, 0)}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onOpenTransactions(asset)}
                          title="Alış / Satış İşlemleri"
                          className="p-1.5 text-emerald-400 hover:text-emerald-300 bg-emerald-950/20 hover:bg-emerald-950/50 rounded-lg transition-colors"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onEditAsset(asset)}
                          title="Varlığı Düzenle"
                          className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteAsset(asset.id)}
                          title="Varlığı Sil"
                          className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-950/20 hover:bg-rose-950/50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer Summary */}
      <div className="p-3.5 px-5 bg-slate-900/60 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
        <span className="font-mono">
          Gösterilen Varlık: {filteredAndSortedAssets.length} / {assets.length}
        </span>
        <span className="text-[11px] text-slate-500">
          Tüm veriler tarayıcınızın yerel belleğinde (localStorage) saklanmaktadır
        </span>
      </div>
    </section>
  );
};
