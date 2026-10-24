import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  PortfolioAsset, 
  ExchangeRates, 
  Currency, 
  TimeRange 
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
  DEFAULT_EXCHANGE_RATES 
} from './services/marketDataService';
import { 
  calculatePortfolioTotals, 
  calculateCategorySummaries, 
  calculateCurrencySummaries, 
  generateHistoricalTrend 
} from './utils/portfolioCalculations';
import { triggerDownloadStandaloneHtml } from './utils/standaloneHtmlGenerator';
import { getCashUnitPrice } from './utils/currency';

const STORAGE_KEY = 'my_personal_portfolio_assets';
const RATES_STORAGE_KEY = 'my_personal_portfolio_rates';

export default function App() {
  // 1. Assets State (Local-first)
  const [assets, setAssets] = useState<PortfolioAsset[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
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

  // 3. UI Configuration States
  const [baseCurrency, setBaseCurrency] = useState<Currency>('TRY');
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1M');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 4. Modals State
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<PortfolioAsset | null>(null);
  const [quickPriceAsset, setQuickPriceAsset] = useState<PortfolioAsset | null>(null);
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
        showToast(`Piyasalar güncellendi! (${result.updatedCount} varlık güncellendi)`);
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
        prev.map((a) => (a.id === existingId ? { ...assetData, id: existingId } : a))
      );
      showToast(`${assetData.symbol} başarıyla güncellendi.`);
    } else {
      const newAsset: PortfolioAsset = {
        ...assetData,
        id: `asset_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      };
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

  // Quick Price Override
  const handleSaveQuickPrice = (assetId: string, newPrice: number) => {
    setAssets((prev) =>
      prev.map((a) =>
        a.id === assetId
          ? { ...a, currentPrice: newPrice, lastUpdated: new Date().toISOString() }
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
    });
    setAssets(synced);
    showToast('Örnek yatırım varlıkları güncel kurlarla yüklendi!');
  };

  // JSON Import
  const handleImportAssets = (imported: PortfolioAsset[]) => {
    setAssets(imported);
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

  const trendData = useMemo(() => {
    return generateHistoricalTrend(assets, rates, selectedRange);
  }, [assets, rates, selectedRange]);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-indigo-500/50 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-medium flex items-center gap-2 animate-bounce">
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
        onDownloadHtml={() => triggerDownloadStandaloneHtml(assets, rates)}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
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
              onDeleteAsset={handleDeleteAsset}
            />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#090d16] py-6 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">PORTFÖYÜM</span>
            <span>·</span>
            <span>Kişisel Yatırım ve Portföy Takip Platformu</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <button
              onClick={() => triggerDownloadStandaloneHtml(assets, rates)}
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              GitHub Pages HTML İndir
            </button>
            <span>·</span>
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
        onImportAssets={handleImportAssets}
      />
    </div>
  );
}
