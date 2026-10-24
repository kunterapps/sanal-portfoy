import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { AssetTransaction, ExchangeRates, PortfolioAsset, TransactionType } from '../types/portfolio';
import { formatCurrency, formatNumber } from '../utils/portfolioCalculations';
import { crossRate } from '../utils/currency';
import { localDayKey } from '../utils/snapshots';
import { computePosition, createTransaction, sortTransactions, TransactionError } from '../utils/transactions';

interface TransactionModalProps {
  asset: PortfolioAsset | null;
  rates: ExchangeRates;
  onClose: () => void;
  /** Return an error message to keep the modal open, or null on success */
  onAddTransaction: (assetId: string, tx: AssetTransaction) => string | null;
  onDeleteTransaction: (assetId: string, txId: string) => string | null;
}

const formatQty = (q: number) => formatNumber(q, q % 1 === 0 ? 0 : 4);

const formatDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const TransactionModal: React.FC<TransactionModalProps> = ({
  asset,
  rates,
  onClose,
  onAddTransaction,
  onDeleteTransaction,
}) => {
  const [type, setType] = useState<TransactionType>('BUY');
  const [date, setDate] = useState(localDayKey(new Date()));
  const [quantity, setQuantity] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);
  const [fee, setFee] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const assetId = asset?.id;
  useEffect(() => {
    if (!asset) return;
    setType('BUY');
    setDate(localDayKey(new Date()));
    setQuantity(0);
    // Transactions are recorded in the cost currency; start from today's price
    setPrice(Math.round(asset.currentPrice * crossRate(asset.currentCurrency, asset.costCurrency, rates) * 10000) / 10000);
    setFee(0);
    setError(null);
    // Reset only when a different asset is opened
  }, [assetId]);

  const transactions = asset?.transactions ?? [];

  // Preview of the position after this transaction
  const preview = useMemo(() => {
    if (!asset || quantity <= 0) return null;
    try {
      const draft = createTransaction(type, { date, quantity, price, fee });
      const before = computePosition(transactions);
      const after = computePosition([...transactions, draft]);
      return { after, realized: after.realizedProfit - before.realizedProfit };
    } catch (e) {
      if (e instanceof TransactionError) return { error: e.message };
      throw e;
    }
  }, [asset, transactions, type, date, quantity, price, fee]);

  if (!asset) return null;

  const cur = asset.costCurrency;
  const isBuy = type === 'BUY';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0 || price < 0 || fee < 0) return;
    const result = onAddTransaction(asset.id, createTransaction(type, { date, quantity, price, fee }));
    if (result) {
      setError(result);
    } else {
      setQuantity(0);
      setFee(0);
      setError(null);
    }
  };

  const handleDelete = (tx: AssetTransaction) => {
    const label = `${formatDay(tx.date)} tarihli ${tx.type === 'BUY' ? 'alış' : 'satış'} (${formatQty(tx.quantity)} adet)`;
    if (!window.confirm(`${label} silinsin mi?`)) return;
    setError(onDeleteTransaction(asset.id, tx.id));
  };

  const history = sortTransactions(transactions).reverse();

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Alış / Satış İşlemleri</h3>
            <span className="text-xs text-indigo-400 tabular-nums font-semibold">{asset.symbol}</span>
            <span className="text-xs text-slate-400 ml-1">· {asset.name}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current position */}
        <div className="grid grid-cols-3 gap-3 text-xs tabular-nums">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3">
            <div className="text-slate-500 mb-1">Eldeki Miktar</div>
            <div className="text-white font-bold">{formatQty(asset.quantity)}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3">
            <div className="text-slate-500 mb-1">Ortalama Maliyet</div>
            <div className="text-white font-bold">{formatCurrency(asset.costPrice, cur, 2)}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3">
            <div className="text-slate-500 mb-1">Gerçekleşmiş K/Z</div>
            <div className={`font-bold ${(asset.realizedProfit ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {(asset.realizedProfit ?? 0) >= 0 ? '+' : '-'}
              {formatCurrency(Math.abs(asset.realizedProfit ?? 0), cur, 2)}
            </div>
          </div>
        </div>

        {/* New transaction */}
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
            {(['BUY', 'SELL'] as TransactionType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-colors ${
                  type === t
                    ? t === 'BUY'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === 'BUY' ? 'Alış' : 'Satış'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Tarih</label>
              <input
                type="date"
                required
                value={date}
                max={localDayKey(new Date())}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2.5 text-white tabular-nums focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Miktar</label>
              <input
                type="number"
                step="any"
                min="0.000001"
                required
                value={quantity || ''}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white tabular-nums focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Birim Fiyat ({cur})</label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white tabular-nums focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Komisyon ({cur})</label>
              <input
                type="number"
                step="any"
                min="0"
                value={fee || ''}
                placeholder="0"
                onChange={(e) => setFee(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white tabular-nums focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Preview */}
          {preview && (
            <div className="text-xs tabular-nums bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 space-y-0.5">
              {'error' in preview && preview.error ? (
                <div className="text-rose-400">{preview.error}</div>
              ) : (
                'after' in preview &&
                preview.after && (
                  <>
                    <div className="text-slate-400">
                      İşlem tutarı:{' '}
                      <span className="text-white">{formatCurrency(quantity * price, cur, 2)}</span>
                    </div>
                    <div className="text-slate-400">
                      Yeni miktar: <span className="text-white">{formatQty(preview.after.quantity)}</span>
                      {isBuy && (
                        <>
                          {' · '}Yeni ortalama maliyet:{' '}
                          <span className="text-white">{formatCurrency(preview.after.averageCost, cur, 2)}</span>
                        </>
                      )}
                    </div>
                    {!isBuy && (
                      <div className="text-slate-400">
                        Bu satıştan kâr/zarar:{' '}
                        <span className={preview.realized >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {preview.realized >= 0 ? '+' : '-'}
                          {formatCurrency(Math.abs(preview.realized), cur, 2)}
                        </span>
                        {preview.after.quantity === 0 && <span className="text-amber-300"> · Pozisyon kapanacak</span>}
                      </div>
                    )}
                  </>
                )
              )}
            </div>
          )}

          {error && <div className="text-xs text-rose-400">{error}</div>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!!(preview && 'error' in preview && preview.error)}
              className={`px-4 py-2 text-xs font-bold text-white rounded-xl flex items-center gap-1.5 disabled:opacity-40 ${
                isBuy ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isBuy ? 'Alış Ekle' : 'Satış Ekle'}</span>
            </button>
          </div>
        </form>

        {/* History */}
        <div className="border-t border-slate-800 pt-4">
          <h4 className="text-xs font-bold text-slate-300 mb-2">İşlem Geçmişi</h4>
          {history.length === 0 ? (
            <p className="text-xs text-slate-500">Henüz işlem yok.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs tabular-nums">
                <thead className="text-slate-500">
                  <tr>
                    <th className="text-left font-medium pb-1.5">Tarih</th>
                    <th className="text-left font-medium pb-1.5">İşlem</th>
                    <th className="text-right font-medium pb-1.5">Miktar</th>
                    <th className="text-right font-medium pb-1.5">Fiyat</th>
                    <th className="text-right font-medium pb-1.5">Tutar</th>
                    <th className="pb-1.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {history.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-1.5 text-slate-300">{formatDay(tx.date)}</td>
                      <td className={`py-1.5 font-semibold ${tx.type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {tx.type === 'BUY' ? 'Alış' : 'Satış'}
                        {tx.notes && <span className="text-slate-500 font-normal"> · {tx.notes}</span>}
                      </td>
                      <td className="py-1.5 text-right text-slate-200">{formatQty(tx.quantity)}</td>
                      <td className="py-1.5 text-right text-slate-200">{formatCurrency(tx.price, cur, 2)}</td>
                      <td className="py-1.5 text-right text-slate-300">
                        {formatCurrency(tx.quantity * tx.price, cur, 2)}
                        {tx.fee ? <div className="text-slate-500">+{formatCurrency(tx.fee, cur, 2)} kom.</div> : null}
                      </td>
                      <td className="py-1.5 text-right">
                        <button
                          onClick={() => handleDelete(tx)}
                          title="İşlemi sil"
                          className="p-1 text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
