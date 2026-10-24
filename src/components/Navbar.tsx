import React from 'react';
import { Plus, TrendingUp, RefreshCw, Download, FileCode } from 'lucide-react';
import { ExchangeRates } from '../types/portfolio';
import { calculateGoldUnitPrice } from '../utils/goldCalculations';
import { formatCurrency } from '../utils/portfolioCalculations';

interface NavbarProps {
  rates: ExchangeRates;
  isRefreshing: boolean;
  onRefresh: () => void;
  onOpenAddModal: () => void;
  onOpenExportModal: () => void;
  onDownloadHtml: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  rates,
  isRefreshing,
  onRefresh,
  onOpenAddModal,
  onOpenExportModal,
  onDownloadHtml,
}) => {
  const ceyrekPrice = calculateGoldUnitPrice('CEYREK', rates.GRAM_GOLD_TRY, rates.SILVER_GRAM_TRY, rates);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-[#090d16]/90 backdrop-blur-md transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 px-4 sm:px-6 lg:px-8 h-16">
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
        <div className="hidden lg:flex items-center gap-5 text-xs font-mono text-slate-400 bg-slate-900/90 px-4 py-2 rounded-xl border border-slate-800/80 shadow-inner">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">USD/TRY:</span>
            <span className="text-slate-200 font-semibold tabular-nums">₺{rates.USD_TRY.toFixed(2)}</span>
          </div>
          <div className="w-px h-3 bg-slate-800" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">EUR/TRY:</span>
            <span className="text-slate-200 font-semibold tabular-nums">₺{rates.EUR_TRY.toFixed(2)}</span>
          </div>
          <div className="w-px h-3 bg-slate-800" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Gram Altın:</span>
            <span className="text-amber-400 font-semibold tabular-nums">{formatCurrency(rates.GRAM_GOLD_TRY, 'TRY', 0)}</span>
          </div>
          <div className="w-px h-3 bg-slate-800" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Çeyrek:</span>
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
            onClick={onDownloadHtml}
            title="GitHub Pages uyumlu tek parça bağımsız HTML olarak indir"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors whitespace-nowrap"
          >
            <FileCode className="w-3.5 h-3.5 text-indigo-400" />
            <span>HTML İndir</span>
          </button>

          <button
            onClick={onOpenExportModal}
            title="JSON Yedekleme ve İçe/Dışa Aktarma"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">Yedekle / Yükle</span>
          </button>

          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-600/30 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Varlık Ekle</span>
          </button>
        </div>
      </div>
    </header>
  );
};
