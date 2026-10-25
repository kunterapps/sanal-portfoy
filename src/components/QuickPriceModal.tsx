import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { PortfolioAsset } from '../types/portfolio';
import { formatCurrency } from '../utils/portfolioCalculations';

interface QuickPriceModalProps {
  asset: PortfolioAsset | null;
  isOpen: boolean;
  onClose: () => void;
  onSavePrice: (assetId: string, newPrice: number) => void;
}

export const QuickPriceModal: React.FC<QuickPriceModalProps> = ({
  asset,
  isOpen,
  onClose,
  onSavePrice,
}) => {
  const [price, setPrice] = useState<number>(0);

  useEffect(() => {
    if (asset) {
      setPrice(asset.currentPrice);
    }
  }, [asset]);

  if (!isOpen || !asset) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (price > 0) {
      onSavePrice(asset.id, Number(price));
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4 my-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Fiyatı Elle Güncelle</h3>
            <span className="text-xs text-indigo-400 tabular-nums font-semibold">{asset.symbol}</span>
            <span className="text-xs text-slate-400 ml-1">· {asset.name}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 font-medium mb-1">
              Birim Anlık Fiyat ({asset.currentCurrency})
            </label>
            <input
              type="number"
              step="any"
              min="0.000001"
              required
              autoFocus
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white tabular-nums text-base font-bold focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="text-xs text-slate-500 tabular-nums">
            Mevcut kayıtlı fiyat: {formatCurrency(asset.currentPrice, asset.currentCurrency, 2)}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-sm shadow-indigo-600/30 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Fiyatı Kaydet</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
