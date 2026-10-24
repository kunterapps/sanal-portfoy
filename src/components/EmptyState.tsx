import React from 'react';
import { Plus, Sparkles, ShieldCheck, TrendingUp, Coins, Building2, Globe } from 'lucide-react';

interface EmptyStateProps {
  onAddFirstAsset: () => void;
  onLoadDemoPortfolio: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onAddFirstAsset,
  onLoadDemoPortfolio,
}) => {
  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-8 sm:p-12 text-center max-w-4xl mx-auto shadow-2xl relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-indigo-600/10 blur-3xl pointer-events-none" />

      {/* Main Content */}
      <div className="relative z-10 max-w-xl mx-auto space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 mx-auto flex items-center justify-center text-white shadow-xl shadow-indigo-600/30">
          <TrendingUp className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Kişisel Portföyünüzü Oluşturun
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
            BIST, ABD/Avrupa hisseleri, TEFAS ve BEFAS fonları, fiziki altın ve döviz birikimlerinizi tek bir güvenli ekranda toplayın. Tüm verileriniz yalnızca tarayıcınızda kalır.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onAddFirstAsset}
            className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>+ İlk Varlığınızı Ekleyin</span>
          </button>

          <button
            type="button"
            onClick={onLoadDemoPortfolio}
            className="w-full sm:w-auto px-5 py-3 bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs rounded-xl border border-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Örnek Portföyü Yükle (Demo)</span>
          </button>
        </div>

        {/* Supported Features Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-6 border-t border-slate-800/80 text-left">
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/60">
            <Globe className="w-4 h-4 text-indigo-400 mb-1.5" />
            <div className="text-[11px] font-bold text-white">Yabancı Hisse</div>
            <div className="text-[10px] text-slate-500">NVDA, VWCE</div>
          </div>

          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/60">
            <Building2 className="w-4 h-4 text-sky-400 mb-1.5" />
            <div className="text-[11px] font-bold text-white">BIST</div>
            <div className="text-[10px] text-slate-500">THYAO, EREGL</div>
          </div>

          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/60">
            <Sparkles className="w-4 h-4 text-orange-400 mb-1.5" />
            <div className="text-[11px] font-bold text-white">Kripto</div>
            <div className="text-[10px] text-slate-500">BTC, ETH, SOL</div>
          </div>

          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/60">
            <Coins className="w-4 h-4 text-amber-400 mb-1.5" />
            <div className="text-[11px] font-bold text-white">Türk Altını</div>
            <div className="text-[10px] text-slate-500">Çeyrek, Ata, Gram</div>
          </div>

          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/60 col-span-2 sm:col-span-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400 mb-1.5" />
            <div className="text-[11px] font-bold text-white">Local-First</div>
            <div className="text-[10px] text-slate-500">%100 Tarayıcıda</div>
          </div>
        </div>
      </div>
    </div>
  );
};
