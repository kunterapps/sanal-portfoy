import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, RefreshCw, Calendar } from 'lucide-react';
import { Currency } from '../types/portfolio';
import { formatCurrency, formatPercent } from '../utils/portfolioCalculations';
import { DailyChange } from '../utils/snapshots';

interface ExecutiveSummaryProps {
  totals: {
    totalValueTRY: number;
    totalValueUSD: number;
    totalCostTRY: number;
    totalCostUSD: number;
    totalProfitTRY: number;
    totalProfitUSD: number;
    totalProfitPercent: number;
    assetCount: number;
  };
  dailyChange: DailyChange | null;
  baseCurrency: Currency;
  onToggleCurrency: (c: Currency) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  lastUpdated: string;
}

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({
  totals,
  dailyChange,
  baseCurrency,
  onToggleCurrency,
  isRefreshing,
  onRefresh,
  lastUpdated,
}) => {
  const isProfit = totals.totalProfitTRY >= 0;
  const isDailyPositive = (dailyChange?.changeTRY ?? 0) >= 0;

  const displayValue = baseCurrency === 'TRY' ? totals.totalValueTRY : totals.totalValueUSD;
  const secondaryValue = baseCurrency === 'TRY' ? totals.totalValueUSD : totals.totalValueTRY;
  const secondaryCurrency: Currency = baseCurrency === 'TRY' ? 'USD' : 'TRY';

  const displayProfit = baseCurrency === 'TRY' ? totals.totalProfitTRY : totals.totalProfitUSD;
  const displayDaily = dailyChange
    ? baseCurrency === 'TRY'
      ? dailyChange.changeTRY
      : dailyChange.changeUSD
    : 0;
  const dailyColor = isDailyPositive ? 'text-emerald-400' : 'text-rose-400';
  const sinceLabel = dailyChange
    ? (() => {
        const [y, m, d] = dailyChange.sinceDate.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
      })()
    : null;

  const timeFormatted = lastUpdated 
    ? new Date(lastUpdated).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : 'Canlı';

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Toplam Portföy Değeri */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2.5">
            <span>Toplam Portföy Değeri</span>
            {/* Dual Currency Segmented Switch */}
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => onToggleCurrency('TRY')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                  baseCurrency === 'TRY'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                TRY
              </button>
              <button
                type="button"
                onClick={() => onToggleCurrency('USD')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                  baseCurrency === 'USD'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                USD
              </button>
            </div>
          </div>

          <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-white tabular-nums">
            {formatCurrency(displayValue, baseCurrency, 2)}
          </div>
        </div>

        <div className="text-xs text-slate-400 font-mono mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between tabular-nums">
          <span className="text-slate-500">Çift Kur Karşılığı:</span>
          <span className="text-slate-300 font-semibold">{formatCurrency(secondaryValue, secondaryCurrency, 2)}</span>
        </div>
      </div>

      {/* 2. Toplam Kâr / Zarar */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2.5">
            <span>Toplam Net Kâr / Zarar</span>
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold font-mono ${
              isProfit ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {isProfit ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {formatPercent(totals.totalProfitPercent)}
            </span>
          </div>

          <div className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight tabular-nums ${
            isProfit ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {isProfit ? '+' : '-'}{formatCurrency(Math.abs(displayProfit), baseCurrency, 2)}
          </div>
        </div>

        <div className="text-xs text-slate-500 font-mono mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
          <span>Toplam Yatırılan Maliyet:</span>
          <span className="text-slate-300 font-medium tabular-nums">
            {formatCurrency(baseCurrency === 'TRY' ? totals.totalCostTRY : totals.totalCostUSD, baseCurrency, 2)}
          </span>
        </div>
      </div>

      {/* 3. Günlük Değişim */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2.5">
            <span>Son Kayıttan Bu Yana Değişim</span>
            {dailyChange && (
              <span className={`text-[11px] font-semibold font-mono ${dailyColor}`}>
                {formatPercent(dailyChange.percent)}
              </span>
            )}
          </div>

          {dailyChange ? (
            <div className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight tabular-nums ${dailyColor}`}>
              {isDailyPositive ? '+' : '-'}{formatCurrency(Math.abs(displayDaily), baseCurrency, 2)}
            </div>
          ) : (
            <div className="text-sm text-slate-400 leading-snug">
              Henüz önceki güne ait kayıt yok. Değişim yarından itibaren burada görünecek.
            </div>
          )}
        </div>

        <div className="text-xs text-slate-500 font-mono mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
          <span>Karşılaştırma:</span>
          <span className="text-slate-400">{sinceLabel ?? 'Bugün ilk kayıt'}</span>
        </div>
      </div>

      {/* 4. Portföy Durumu & Canlı Senkronizasyon */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2.5">
            <span>Kayıtlı Varlık Sayısı</span>
            <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
              <Calendar className="w-3 h-3 text-slate-500" />
              {timeFormatted}
            </span>
          </div>

          <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-white tabular-nums">
            {totals.assetCount} <span className="text-sm font-normal text-slate-400 font-sans">Enstrüman</span>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800/80">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-full py-1.5 px-3 bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg transition-colors flex items-center justify-center gap-2 border border-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
            <span>{isRefreshing ? 'Piyasalar Taranıyor...' : 'Canlı Fiyatları Güncelle'}</span>
          </button>
        </div>
      </div>
    </section>
  );
};
