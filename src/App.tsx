import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  PortfolioAsset, 
  AssetTransaction,
  ExchangeRates, 
  Currency, 
  TimeRange,
  PortfolioSnapshot
} from './types/portfolio';
import { Navbar } from './components/Navbar';
import { ExecutiveSummary } from './components/ExecutiveSummary';
import { PortfolioTrendChart } from './components/PortfolioTrendChart';
import { DistributionCharts } from './components/DistributionCharts';
import { AssetTable } from './components/AssetTable';
import { AssetModal } from './components/AssetModal';
import { QuickPriceModal } from './components/QuickPriceModal';
import { ExportModal } from './components/ExportModal';
import { EmptyState } from './components/EmptyState';
import { DEMO_PORTFOLIO_ASSETS } from './data/demoPortfolio';
import { 
  fetchLiveExchangeRates, 
  batchUpdatePortfolioPrices, 
  fetchFundFxExposure,
  needsFxExposure,
  DEFAULT_EXCHANGE_RATES 
} from './services/marketDataService';
import { 
  calculatePortfolioTotals, 
  calculateCategorySummaries, 
  calculateCurrencySummaries 
} from './utils/portfolioCalculations';
import {
  buildTrendSeries,
  calculateDailyChange,
  sanitizeSnapshots,
  upsertTodaySnapshot,
} from './utils/snapshots';
import { getCashUnitPrice } from './utils/currency';
import { applyTransactions, ensureTransactions, TransactionError } from './utils/transactions';
import { TransactionModal } from './components/TransactionModal';

const STORAGE_KEY = 'my_personal_portfolio_assets';
const RATES_STORAGE_KEY = 'my_personal_portfolio_rates';
const SNAPSHOTS_STORAGE_KEY = 'my_personal_portfolio_snapshots';

export default function App() {
  // 1. Assets State (Local-first)
  const [assets, setAssets] = useState<PortfolioAsset[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Older data has no transaction history; give each asset an opening BUY
        if (Array.isArray(parsed)) return parsed.map(ensureTransactions);
      }
    } catch (e) {
      console.error('Failed to load portfolio from localStorage', e);
    }
    // Starts empty as per user preference (Turn 1 clarification)
    return [];
  });

  // 2. Exchange Rates State
  const [rates, setRates] = useState<ExchangeRates>(() => {
    try {
      const stored = localStorage.getItem(RATES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.GRAM_GOLD_TRY === 'number' && parsed.GRAM_GOLD_TRY > 5000) {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_EXCHANGE_RATES;
  });

  // 2b. Daily value history (one snapshot per day)
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>(() => {
    try {
      return sanitizeSnapshots(JSON.parse(localStorage.getItem(SNAPSHOTS_STORAGE_KEY) || '[]'));
    } catch {
      return [];
    }
  });

  // 3. UI Configuration States
  const [baseCurrency, setBaseCurrency] = useState<Currency>('TRY');
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1M');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 4. Modals State
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<PortfolioAsset | null>(null);
  const [quickPriceAsset, setQuickPriceAsset] = useState<PortfolioAsset | null>(null);
  const [transactionAssetId, setTransactionAssetId] = useState<string | null>(null);
  const transactionAsset = assets.find((a) => a.id === transactionAssetId) ?? null;
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Toast Helper
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Save to LocalStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
    } catch (e) {
      console.error('Failed to save portfolio to localStorage', e);
    }
  }, [assets]);

  useEffect(() => {
    try {
      localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(rates));
    } catch {}
  }, [rates]);

  useEffect(() => {
    try {
      localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots));
    } catch {}
  }, [snapshots]);

  // Initial Market Rates Fetch on Mount
  useEffect(() => {
    let mounted = true;
    const initRates = async () => {
      try {
        const liveRates = await fetchLiveExchangeRates();
        if (mounted) {
          setRates(liveRates);
          // Immediately sync cash holdings with live rates
          setAssets((prevAssets) =>
            prevAssets.map((asset) => {
              if (asset.category !== 'CASH') return asset;
              const price = getCashUnitPrice(asset, liveRates);
              if (price === null || price <= 0) return asset;
              return { ...asset, currentPrice: price, lastUpdated: new Date().toISOString() };
            })
          );
        }
      } catch (err) {
        console.warn('Initial rates fetch failed, using cached/defaults', err);
      }
    };
    initRates();
    return () => {
      mounted = false;
    };
  }, []);

  // Load missing or week-old fund foreign-currency shares on startup, so the
  // currency risk card doesn't wait for a manual price refresh
  useEffect(() => {
    let mounted = true;
    const funds = assets.filter((a) => needsFxExposure(a));
    if (funds.length === 0) return;
    Promise.all(
      funds.map(async (a) => [a.id, await fetchFundFxExposure(a.symbol, a.category === 'BEFAS' ? 'EMK' : 'YAT')] as const)
    ).then((results) => {
      const byId = new Map(results.filter(([, pct]) => pct !== null) as [string, number][]);
      if (!mounted || byId.size === 0) return;
      const fetchedAt = new Date().toISOString();
      setAssets((prev) =>
        prev.map((a) =>
          byId.has(a.id) ? { ...a, fxExposurePct: byId.get(a.id), fxExposureUpdatedAt: fetchedAt } : a
        )
      );
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Live Prices Batch Refresh
  const handleRefreshPrices = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    showToast('Canlı piyasa verileri taranıyor...');

    try {
      // 1. Refresh exchange rates
      const newRates = await fetchLiveExchangeRates();
      setRates(newRates);

      // 2. Refresh assets if any
      if (assets.length > 0) {
        const result = await batchUpdatePortfolioPrices(assets, newRates);
        setAssets(result.updatedAssets);
        showToast(
          result.failedCount > 0
            ? `${result.updatedCount} varlık güncellendi, ${result.failedCount} varlığın fiyatı alınamadı (son fiyat korunuyor).`
            : `Piyasalar güncellendi! (${result.updatedCount} varlık güncellendi)`
        );
      } else {
        showToast('Döviz kurları ve altın fiyatları güncellendi!');
      }
    } catch (err) {
      console.error('Error refreshing prices', err);
      showToast('Piyasa kurları güncellenirken hata oluştu, son fiyatlar korunuyor.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Add / Edit Asset Save Handler
  const handleSaveAsset = (assetData: Omit<PortfolioAsset, 'id'>, existingId?: string) => {
    if (existingId) {
      setAssets((prev) =>
        prev.map((a) => {
          if (a.id !== existingId) return a;
          const updated: PortfolioAsset = { ...a, ...assetData, id: existingId, priceStale: false };
          // A different fund code means the stored foreign-currency share no longer applies
          if (updated.symbol !== a.symbol || updated.category !== a.category) {
            delete updated.fxExposurePct;
            delete updated.fxExposureUpdatedAt;
            delete updated.priceFetchedAt;
          }
          const txs = a.transactions ?? [];
          if (txs.length > 1) {
            // Quantity and cost are managed by transactions; keep them authoritative
            return applyTransactions(updated, txs);
          }
          // Only the opening entry: editing quantity/cost rewrites it (keeping its date)
          const opening = txs[0] ?? ensureTransactions({ ...updated, transactions: [] }).transactions![0];
          return applyTransactions(updated, [
            { ...opening, type: 'BUY', quantity: assetData.quantity, price: assetData.costPrice },
          ]);
        })
      );
      showToast(`${assetData.symbol} başarıyla güncellendi.`);
    } else {
      const newAsset: PortfolioAsset = ensureTransactions({
        ...assetData,
        id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      });
      setAssets((prev) => [newAsset, ...prev]);
      showToast(`${assetData.symbol} portföye eklendi.`);
    }
    setEditingAsset(null);
  };

  // Delete Asset
  const handleDeleteAsset = (id: string) => {
    const asset = assets.find((a) => a.id === id);
    if (!asset) return;

    if (window.confirm(`"${asset.symbol} - ${asset.name}" varlığını portföyden silmek istediğinize emin misiniz?`)) {
      setAssets((prev) => prev.filter((a) => a.id !== id));
      showToast(`${asset.symbol} portföyden kaldırıldı.`);
    }
  };

  // Buy / sell transactions. Returns an error message instead of saving if
  // the history would become invalid (e.g. selling more than held).
  const updateTransactions = (
    assetId: string,
    change: (txs: AssetTransaction[]) => AssetTransaction[],
    successMessage: string
  ): string | null => {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return 'Varlık bulunamadı.';
    let updated: PortfolioAsset;
    try {
      updated = applyTransactions(asset, change(asset.transactions ?? []));
    } catch (err) {
      if (err instanceof TransactionError) return err.message;
      throw err;
    }
    setAssets((prev) => prev.map((a) => (a.id === assetId ? updated : a)));
    showToast(successMessage);
    return null;
  };

  const handleAddTransaction = (assetId: string, tx: AssetTransaction) =>
    updateTransactions(
      assetId,
      (txs) => [...txs, tx],
      tx.type === 'BUY' ? 'Alış işlemi eklendi.' : 'Satış işlemi eklendi.'
    );

  const handleDeleteTransaction = (assetId: string, txId: string) =>
    updateTransactions(assetId, (txs) => txs.filter((t) => t.id !== txId), 'İşlem silindi.');

  // Quick Price Override
  const handleSaveQuickPrice = (assetId: string, newPrice: number) => {
    setAssets((prev) =>
      prev.map((a) =>
        a.id === assetId
          ? { ...a, currentPrice: newPrice, lastUpdated: new Date().toISOString(), priceStale: false }
          : a
      )
    );
    showToast('Fiyat güncellendi.');
  };

  // Load Demo Portfolio (Helper)
  const handleLoadDemoPortfolio = () => {
    const synced = DEMO_PORTFOLIO_ASSETS.map((asset) => {
      if (asset.id === 'demo_12') {
        return {
          ...asset,
          currentPrice: rates.USD_TRY || 49.75,
          lastUpdated: new Date().toISOString(),
        };
      }
      return asset;
    }).map(ensureTransactions);
    setAssets(synced);
    // Demo values shouldn't mix into a real value history
    setSnapshots([]);
    showToast('Örnek yatırım varlıkları güncel kurlarla yüklendi!');
  };

  // JSON Import
  const handleImportAssets = (imported: PortfolioAsset[], importedSnapshots: PortfolioSnapshot[]) => {
    setAssets(imported);
    setSnapshots(importedSnapshots);
    showToast(`${imported.length} adet varlık içe aktarıldı!`);
  };

  // Calculations
  const totals = useMemo(() => {
    return calculatePortfolioTotals(assets, rates);
  }, [assets, rates]);

  const categorySummaries = useMemo(() => {
    return calculateCategorySummaries(assets, rates);
  }, [assets, rates]);

  const currencySummaries = useMemo(() => {
    return calculateCurrencySummaries(assets, rates);
  }, [assets, rates]);

  // Record today's value whenever it changes
  useEffect(() => {
    if (assets.length === 0) return;
    setSnapshots((prev) => upsertTodaySnapshot(prev, totals));
  }, [assets.length, totals]);

  const dailyChange = useMemo(() => calculateDailyChange(snapshots, totals), [snapshots, totals]);

  const trendData = useMemo(
    () => buildTrendSeries(snapshots, totals, selectedRange),
    [snapshots, totals, selectedRange]
  );

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:bottom-6 sm:right-6 z-50 mb-[env(safe-area-inset-bottom)] bg-slate-900 border border-indigo-500/50 text-white px-4 py-2.5 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <Navbar
        rates={rates}
        isRefreshing={isRefreshing}
        onRefresh={handleRefreshPrices}
        onOpenAddModal={() => {
          setEditingAsset(null);
          setIsAssetModalOpen(true);
        }}
        onOpenExportModal={() => setIsExportModalOpen(true)}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8">
        {assets.length === 0 ? (
          // Empty State view when portfolio has 0 assets
          <div className="pt-6">
            <EmptyState
              onAddFirstAsset={() => {
                setEditingAsset(null);
                setIsAssetModalOpen(true);
              }}
              onLoadDemoPortfolio={handleLoadDemoPortfolio}
            />
          </div>
        ) : (
          // Full Dashboard view when assets exist
          <>
            {/* 1. Executive Summary Cards */}
            <ExecutiveSummary
              totals={totals}
              dailyChange={dailyChange}
              baseCurrency={baseCurrency}
              onToggleCurrency={setBaseCurrency}
              isRefreshing={isRefreshing}
              onRefresh={handleRefreshPrices}
              lastUpdated={rates.lastUpdated}
            />

            {/* 2. Historical Portfolio Trend Performance Chart */}
            <PortfolioTrendChart
              data={trendData}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
              baseCurrency={baseCurrency}
              hasAssets={assets.length > 0}
            />

            {/* 3. Distribution Analytics Charts */}
            <DistributionCharts
              categorySummaries={categorySummaries}
              currencySummaries={currencySummaries}
              baseCurrency={baseCurrency}
              totalValueTRY={totals.totalValueTRY}
            />

            {/* 4. Asset Table with Tabs & Search */}
            <AssetTable
              assets={assets}
              rates={rates}
              baseCurrency={baseCurrency}
              onEditAsset={(asset) => {
                setEditingAsset(asset);
                setIsAssetModalOpen(true);
              }}
              onQuickPriceEdit={(asset) => setQuickPriceAsset(asset)}
              onOpenTransactions={(asset) => setTransactionAssetId(asset.id)}
              onDeleteAsset={handleDeleteAsset}
            />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#090d16] py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center justify-center gap-2 text-center">
            <span className="font-bold text-slate-400">PORTFÖYÜM</span>
            <span>·</span>
            <span>Kişisel Yatırım ve Portföy Takip Platformu</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              JSON Yedek
            </button>
            <span>·</span>
            <span>Veriler yerel tarayıcınızda (localStorage) saklanır</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AssetModal
        isOpen={isAssetModalOpen}
        onClose={() => {
          setIsAssetModalOpen(false);
          setEditingAsset(null);
        }}
        onSave={handleSaveAsset}
        editingAsset={editingAsset}
        rates={rates}
      />

      <TransactionModal
        asset={transactionAsset}
        rates={rates}
        onClose={() => setTransactionAssetId(null)}
        onAddTransaction={handleAddTransaction}
        onDeleteTransaction={handleDeleteTransaction}
      />

      <QuickPriceModal
        isOpen={quickPriceAsset !== null}
        asset={quickPriceAsset}
        onClose={() => setQuickPriceAsset(null)}
        onSavePrice={handleSaveQuickPrice}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        assets={assets}
        rates={rates}
        snapshots={snapshots}
        onImportAssets={handleImportAssets}
      />
    </div>
  );
}
