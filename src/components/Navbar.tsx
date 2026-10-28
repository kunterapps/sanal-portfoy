import React, { useEffect, useRef } from 'react';
import { Plus, TrendingUp, RefreshCw, Download } from 'lucide-react';
import { ExchangeRates } from '../types/portfolio';
import { MarketIndex } from '../services/marketDataService';
import { calculateGoldUnitPrice } from '../utils/goldCalculations';
import { formatCurrency } from '../utils/portfolioCalculations';

interface NavbarProps {
  rates: ExchangeRates;
  indices: MarketIndex[];
  isRefreshing: boolean;
  onRefresh: () => void;
  onOpenAddModal: () => void;
  onOpenExportModal: () => void;
}

const formatIndexValue = (value: number) =>
  value.toLocaleString('tr-TR', value >= 1000 ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const IndexItem: React.FC<{ index: MarketIndex }> = ({ index }) => {
  const pct = index.changePct;
  const asOf = new Date(index.asOf).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <span className="text-slate-500" title={`${index.label}: ${asOf} itibarıyla`}>
      {index.label}{' '}
      <span className="text-slate-200 font-semibold">
        {index.unit}
        {formatIndexValue(index.price)}
      </span>
      {pct !== null && (
        <span className={`ml-1 font-medium ${pct > 0 ? 'text-emerald-400' : pct < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
          {pct > 0 ? '▲' : pct < 0 ? '▼' : ''}
          {Math.abs(pct).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
        </span>
      )}
    </span>
  );
};

export const Navbar: React.FC<NavbarProps> = ({
  rates,
  indices,
  isRefreshing,
  onRefresh,
  onOpenAddModal,
  onOpenExportModal,
}) => {
  const ceyrekPrice = calculateGoldUnitPrice('CEYREK', rates.GRAM_GOLD_TRY, rates.SILVER_GRAM_TRY, rates);
  const headerRef = useRef<HTMLElement>(null);

  // Publish the header height (it grows by the rate strip below xl) so sticky content can sit right under it
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const publish = () => document.documentElement.style.setProperty('--nav-h', `${el.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <header ref={headerRef} className="sticky top-0 z-40 w-full border-b border-slate-800 bg-[#090d16]/90 backdrop-blur-md transition-all">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3 sm:gap-6 px-4 sm:px-6 lg:px-8 h-14 sm:h-16">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/25">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="text-base font-extrabold tracking-tight text-white whitespace-nowrap">
            PORTFÖYÜM
          </span>
        </div>

        {/* Zone 2: Live Market Ticker */}
        <div className="hidden xl:flex items-center gap-4 h-9 text-[13px] whitespace-nowrap tabular-nums text-slate-400 bg-slate-900/90 px-4 rounded-lg border border-slate-800/80 shadow-inner">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">USD/TRY</span>
            <span className="text-slate-200 font-semibold tabular-nums">₺{rates.USD_TRY.toFixed(2)}</span>
          </div>
          <div className="w-px h-4 bg-slate-700" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">EUR/TRY</span>
            <span className="text-slate-200 font-semibold tabular-nums">₺{rates.EUR_TRY.toFixed(2)}</span>
          </div>
          <div className="w-px h-4 bg-slate-700" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Gram Altın</span>
            <span className="text-amber-400 font-semibold tabular-nums">{formatCurrency(rates.GRAM_GOLD_TRY, 'TRY', 0)}</span>
          </div>
          <div className="w-px h-4 bg-slate-700" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Çeyrek</span>
            <span className="text-amber-300 font-semibold tabular-nums">{formatCurrency(ceyrekPrice, 'TRY', 0)}</span>
          </div>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Piyasa kurlarını yenile"
            className="text-slate-400 hover:text-slate-200 transition-colors ml-1 p-0.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>

        {/* Zone 3: Primary Action & Tools */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onOpenExportModal}
            title="JSON Yedekleme ve İçe/Dışa Aktarma"
            className="inline-flex items-center gap-2 h-9 px-3 text-sm font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">Yedekle / Yükle</span>
          </button>

          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-600/30 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Varlık Ekle</span>
          </button>
        </div>
      </div>

      {/* Second strip: rates (only where the ticker above is hidden) and market indices; scrolls sideways when narrow */}
      <div className={`border-t border-slate-800/80 ${indices.length === 0 ? 'xl:hidden' : ''}`}>
        <div className="no-scrollbar max-w-[1600px] mx-auto flex items-center gap-4 overflow-x-auto px-4 sm:px-6 lg:px-8 h-9 text-xs whitespace-nowrap tabular-nums [mask-image:linear-gradient(to_right,black_88%,transparent)] xl:[mask-image:none]">
          <span className="xl:hidden text-slate-500">USD <span className="text-slate-200 font-semibold">₺{rates.USD_TRY.toFixed(2)}</span></span>
          <span className="xl:hidden text-slate-500">EUR <span className="text-slate-200 font-semibold">₺{rates.EUR_TRY.toFixed(2)}</span></span>
          <span className="xl:hidden text-slate-500">Gram <span className="text-amber-400 font-semibold">{formatCurrency(rates.GRAM_GOLD_TRY, 'TRY', 0)}</span></span>
          <span className="xl:hidden text-slate-500">Çeyrek <span className="text-amber-300 font-semibold">{formatCurrency(ceyrekPrice, 'TRY', 0)}</span></span>
          {indices.length > 0 && <span className="xl:hidden shrink-0 w-px h-4 bg-slate-700" />}
          {indices.map((index) => (
            <IndexItem key={index.key} index={index} />
          ))}
        </div>
      </div>
    </header>
  );
};
