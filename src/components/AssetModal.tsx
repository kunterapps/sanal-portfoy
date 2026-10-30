import React, { useState, useEffect } from 'react';
import { X, Sparkles, Landmark } from 'lucide-react';
import { 
  PortfolioAsset, 
  AssetCategory, 
  Currency, 
  GoldType, 
  ExchangeRates,
  TimeDeposit,
} from '../types/portfolio';
import {
  DEFAULT_WITHHOLDING_PCT,
  DEPOSIT_TERM_OPTIONS,
  getDepositStatus,
  localToday,
} from '../utils/deposit';
import { detectCashCurrency } from '../utils/currency';
import { 
  TURKISH_GOLD_DEFINITIONS, 
  calculateGoldUnitPrice 
} from '../utils/goldCalculations';

interface AssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (asset: Omit<PortfolioAsset, 'id'>, existingId?: string) => void;
  editingAsset?: PortfolioAsset | null;
  rates: ExchangeRates;
}

const POPULAR_SUGGESTIONS: Record<AssetCategory, { symbol: string; name: string; currency: Currency; price?: number }[]> = {
  BIST: [
    { symbol: 'THYAO', name: 'Türk Hava Yolları', currency: 'TRY', price: 312 },
    { symbol: 'EREGL', name: 'Ereğli Demir Çelik', currency: 'TRY', price: 52.5 },
    { symbol: 'ASELS', name: 'Aselsan Elektronik', currency: 'TRY', price: 65.8 },
    { symbol: 'SISE', name: 'Türkiye Şişe ve Cam Fabrikaları', currency: 'TRY', price: 47.3 },
    { symbol: 'BIMAS', name: 'BİM Birleşik Mağazalar', currency: 'TRY', price: 540 },
    { symbol: 'TUPRS', name: 'Tüpraş Türkiye Petrol Rafinerileri', currency: 'TRY', price: 152 },
  ],
  FOREIGN_STOCK: [
    { symbol: 'NVDA', name: 'NVIDIA Corporation', currency: 'USD', price: 141.5 },
    { symbol: 'AAPL', name: 'Apple Inc.', currency: 'USD', price: 235 },
    { symbol: 'MSFT', name: 'Microsoft Corporation', currency: 'USD', price: 430 },
    { symbol: 'VWCE.DE', name: 'Vanguard FTSE All-World UCITS ETF (EUR)', currency: 'EUR', price: 134.8 },
    { symbol: 'CSPX.L', name: 'iShares Core S&P 500 UCITS ETF (USD)', currency: 'USD', price: 615 },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust (Nasdaq 100)', currency: 'USD', price: 512 },
  ],
  TEFAS: [
    { symbol: 'TCD', name: 'Tacirler Portföy Değişken Fon', currency: 'TRY', price: 14.85 },
    { symbol: 'MAC', name: 'Marmara Capital Portföy Hisse Fonu', currency: 'TRY', price: 0.892 },
    { symbol: 'TI2', name: 'İş Portföy İki Numaralı Değişken Fon', currency: 'TRY', price: 12.45 },
    { symbol: 'TFF', name: 'TEB Portföy Altın Fonu', currency: 'TRY', price: 0.162 },
    { symbol: 'KZL', name: 'Kuveyt Türk Altın Katılım Fonu', currency: 'TRY', price: 0.054 },
    { symbol: 'IIH', name: 'İstanbul Portföy Üçüncü Hisse Fonu', currency: 'TRY', price: 0.445 },
  ],
  BEFAS: [
    { symbol: 'AEA', name: 'Anadolu Hayat Altın Katılım Emeklilik Fonu', currency: 'TRY', price: 0.285 },
    { symbol: 'BGL', name: 'Anadolu Hayat Altın Emeklilik Fonu', currency: 'TRY', price: 0.278 },
    { symbol: 'CHG', name: 'Garanti Hisse Senedi Emeklilik Fonu', currency: 'TRY', price: 0.512 },
    { symbol: 'BGP', name: 'Bereket Katılım Hisse Emeklilik Fonu', currency: 'TRY', price: 0.142 },
    { symbol: 'VEB', name: 'Vakıf BIST 30 Endeks Emeklilik Fonu', currency: 'TRY', price: 0.395 },
  ],
  COMMODITY: [],
  CRYPTO: [
    { symbol: 'BTC', name: 'Bitcoin', currency: 'USD', price: 68500 },
    { symbol: 'ETH', name: 'Ethereum', currency: 'USD', price: 2540 },
    { symbol: 'SOL', name: 'Solana', currency: 'USD', price: 178 },
    { symbol: 'AVAX', name: 'Avalanche', currency: 'USD', price: 28.5 },
    { symbol: 'XRP', name: 'Ripple', currency: 'USD', price: 0.54 },
    { symbol: 'SUI', name: 'Sui Network', currency: 'USD', price: 2.15 },
  ],
  CASH: [
    { symbol: 'USD', name: 'Amerikan Doları (Nakit)', currency: 'TRY' },
    { symbol: 'EUR', name: 'Euro (Nakit)', currency: 'TRY' },
    { symbol: 'GBP', name: 'İngiliz Sterlini (Nakit)', currency: 'TRY' },
    { symbol: 'TRY', name: 'Türk Lirası Mevduat / Nakit', currency: 'TRY', price: 1 },
  ],
};

export const AssetModal: React.FC<AssetModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingAsset,
  rates,
}) => {
  const [category, setCategory] = useState<AssetCategory>('BIST');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState<number>(10);
  const [costPrice, setCostPrice] = useState<number>(100);
  const [costCurrency, setCostCurrency] = useState<Currency>('TRY');
  const [currentPrice, setCurrentPrice] = useState<number>(100);
  const [currentCurrency, setCurrentCurrency] = useState<Currency>('TRY');
  const [goldType, setGoldType] = useState<GoldType>('CEYREK');
  const [notes, setNotes] = useState('');
  const [isDeposit, setIsDeposit] = useState(false);
  const [deposit, setDeposit] = useState<TimeDeposit>(newDeposit());

  // With buy/sell history, quantity and average cost come from the transactions
  const managedByTransactions = (editingAsset?.transactions?.length ?? 0) > 1;

  useEffect(() => {
    if (editingAsset) {
      setCategory(editingAsset.category);
      setSymbol(editingAsset.symbol);
      setName(editingAsset.name);
      setQuantity(editingAsset.quantity);
      setCostPrice(editingAsset.costPrice);
      setCostCurrency(editingAsset.costCurrency);
      setCurrentPrice(editingAsset.currentPrice);
      setCurrentCurrency(editingAsset.currentCurrency);
      setGoldType(editingAsset.goldType || 'GRAM_24');
      setNotes(editingAsset.notes || '');
      setIsDeposit(!!editingAsset.deposit);
      setDeposit(editingAsset.deposit ?? newDeposit());
    } else {
      // Defaults for new asset
      setCategory('BIST');
      setSymbol('');
      setName('');
      setQuantity(10);
      setCostPrice(100);
      setCostCurrency('TRY');
      setCurrentPrice(100);
      setCurrentCurrency('TRY');
      setGoldType('CEYREK');
      setNotes('');
      setIsDeposit(false);
      setDeposit(newDeposit());
    }
  }, [editingAsset, isOpen]);

  // Only TL cash can be run as a deposit
  const canBeDeposit = category === 'CASH' && detectCashCurrency({ symbol, name }) === 'TRY';
  const depositOn = canBeDeposit && isDeposit;
  const depositStatus = depositOn ? getDepositStatus(deposit) : null;
  const patchDeposit = (patch: Partial<TimeDeposit>) => setDeposit((d) => ({ ...d, ...patch }));

  const startDeposit = () => {
    setSymbol('TRY');
    setName('Türk Lirası Mevduat');
    setCostCurrency('TRY');
    setCurrentCurrency('TRY');
    setIsDeposit(true);
    if (!editingAsset) setQuantity(100000);
  };

  // Handle Category changes
  const handleCategoryChange = (newCat: AssetCategory) => {
    setCategory(newCat);
    if (newCat === 'BIST' || newCat === 'TEFAS' || newCat === 'BEFAS') {
      setCostCurrency('TRY');
      setCurrentCurrency('TRY');
    } else if (newCat === 'FOREIGN_STOCK' || newCat === 'CRYPTO') {
      setCostCurrency('USD');
      setCurrentCurrency('USD');
    } else if (newCat === 'COMMODITY') {
      setCostCurrency('TRY');
      setCurrentCurrency('TRY');
      handleGoldTypeChange(goldType);
    } else if (newCat === 'CASH') {
      setCostCurrency('TRY');
      setCurrentCurrency('TRY');
      if (!editingAsset) {
        setSymbol('USD');
        setName('Amerikan Doları (Nakit)');
        setCurrentPrice(rates.USD_TRY || 49.75);
        setCostPrice(rates.USD_TRY || 49.75);
        setQuantity(1000);
      }
    }
  };

  // Handle Gold Type selection
  const handleGoldTypeChange = (gt: GoldType) => {
    setGoldType(gt);
    const def = TURKISH_GOLD_DEFINITIONS[gt];
    const livePrice = calculateGoldUnitPrice(gt, rates.GRAM_GOLD_TRY, rates.SILVER_GRAM_TRY, rates);
    setSymbol(gt);
    setName(def.name);
    setCurrentPrice(livePrice);
    if (!editingAsset) {
      setCostPrice(livePrice);
      setQuantity(def.isUnitPiece ? 1 : 10);
    }
    setCostCurrency(gt === 'ONS_GOLD' ? 'USD' : 'TRY');
    setCurrentCurrency(gt === 'ONS_GOLD' ? 'USD' : 'TRY');
  };

  const applySuggestion = (s: { symbol: string; name: string; currency: Currency; price?: number }) => {
    setSymbol(s.symbol);
    setName(s.name);
    setCostCurrency(s.currency);
    setCurrentCurrency(s.currency);
    
    // Resolve dynamic price for cash
    let targetPrice = s.price;
    if (category === 'CASH') {
      if (s.symbol === 'USD') targetPrice = rates.USD_TRY || 49.75;
      else if (s.symbol === 'EUR') targetPrice = rates.EUR_TRY || 55.80;
      else if (s.symbol === 'GBP') targetPrice = rates.GBP_TRY || 66.65;
      else if (s.symbol === 'TRY') targetPrice = 1;
    }

    if (targetPrice !== undefined) {
      setCurrentPrice(targetPrice);
      if (!editingAsset) setCostPrice(targetPrice);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim() || (quantity <= 0 && !managedByTransactions)) return;

    if (depositOn) {
      onSave(
        {
          category,
          symbol: symbol.trim().toUpperCase(),
          name: name.trim() || 'Türk Lirası Mevduat',
          quantity: Number(quantity),
          costPrice: 1,
          costCurrency: 'TRY',
          currentPrice: getDepositStatus(deposit).factor,
          currentCurrency: 'TRY',
          notes: notes.trim(),
          purchaseDate: deposit.startDate,
          deposit,
          lastUpdated: new Date().toISOString(),
        },
        editingAsset?.id
      );
      onClose();
      return;
    }

    onSave(
      {
        category,
        symbol: symbol.trim().toUpperCase(),
        name: name.trim() || symbol.trim().toUpperCase(),
        quantity: Number(quantity),
        costPrice: Number(costPrice),
        costCurrency,
        currentPrice: Number(currentPrice),
        currentCurrency,
        goldType: category === 'COMMODITY' ? goldType : undefined,
        notes: notes.trim(),
        deposit: undefined,
        lastUpdated: new Date().toISOString(),
      },
      editingAsset?.id
    );
    onClose();
  };

  if (!isOpen) return null;

  const suggestions = POPULAR_SUGGESTIONS[category] || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-xl p-4 sm:p-6 shadow-2xl space-y-5 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              {editingAsset ? 'Varlık Bilgilerini Düzenle' : 'Portföye Yeni Varlık Ekle'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Varlık kategorisini, alış maliyetini ve anlık piyasa fiyatını belirleyin
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Category Selector */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Varlık Kategorisi
            </label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as AssetCategory)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-indigo-500"
            >
              <option value="BIST">BIST Hisseleri (Borsa İstanbul)</option>
              <option value="FOREIGN_STOCK">Yabancı ETF & Hisseler (ABD & Avrupa Borsaları)</option>
              <option value="CRYPTO">Kripto Varlıklar (Bitcoin, Ethereum, Altcoinler)</option>
              <option value="COMMODITY">Altın & Kıymetli Madenler (Gram, Çeyrek, Ata vb.)</option>
              <option value="TEFAS">TEFAS Menkul Kıymet Fonları</option>
              <option value="BEFAS">BEFAS Emeklilik Fonları (BES)</option>
              <option value="CASH">Nakit & Döviz Varlıkları</option>
            </select>
          </div>

          {/* Commodity / Turkish Gold Specific Select */}
          {category === 'COMMODITY' && (
            <div className="p-3.5 bg-amber-950/20 border border-amber-900/40 rounded-xl space-y-2">
              <label className="block text-amber-300 font-semibold">
                Türkiye Altın / Maden Türü
              </label>
              <select
                value={goldType}
                onChange={(e) => handleGoldTypeChange(e.target.value as GoldType)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-amber-500"
              >
                {Object.values(TURKISH_GOLD_DEFINITIONS).map((def) => (
                  <option key={def.type} value={def.type}>
                    {def.name} ({def.description})
                  </option>
                ))}
              </select>
              <div className="text-xs text-amber-200/70">
                Seçtiğiniz altın türünün ağırlığı ve ayarı canlı has altın fiyatına göre otomatik hesaplanır.
              </div>
            </div>
          )}

          {/* Quick Suggestions Chips */}
          {suggestions.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>Popüler Örnekler:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s.symbol}
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors tabular-nums"
                  >
                    {s.symbol}
                  </button>
                ))}
                {category === 'CASH' && (
                  <button
                    type="button"
                    onClick={startDeposit}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/60 text-xs text-emerald-300 hover:text-white transition-colors"
                  >
                    <Landmark className="w-3 h-3" />
                    Vadeli TL Mevduat
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Symbol & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Sembol / Kod <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder={category === 'BIST' ? 'örn: THYAO' : category === 'FOREIGN_STOCK' ? 'örn: NVDA' : 'örn: TCD'}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white tabular-nums uppercase focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Varlık Adı / Açıklama
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="örn: Türk Hava Yolları A.O."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {canBeDeposit && (
            <DepositPanel
              enabled={isDeposit}
              onToggle={setIsDeposit}
              deposit={deposit}
              onChange={patchDeposit}
              principal={quantity}
              onPrincipalChange={setQuantity}
              principalLocked={managedByTransactions}
            />
          )}

          {/* Quantity & Unit Cost */}
          {!depositOn && managedByTransactions && (
            <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              Bu varlığın alış/satış geçmişi var. Miktar ve ortalama maliyet işlemlerden hesaplanır; değiştirmek için
              tablodaki ⇄ (Alış / Satış İşlemleri) butonunu kullanın.
            </p>
          )}
          {!depositOn && (<>
          <fieldset disabled={managedByTransactions} className="grid grid-cols-1 sm:grid-cols-3 gap-3 disabled:opacity-50">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                {category === 'COMMODITY' && !TURKISH_GOLD_DEFINITIONS[goldType]?.isUnitPiece
                  ? 'Gramaj / Miktar'
                  : 'Adet / Pay Miktarı'}{' '}
                <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0.000001"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white tabular-nums focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                {managedByTransactions ? 'Ortalama Maliyet' : 'Birim Alış Maliyeti'} <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={costPrice}
                onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white tabular-nums focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Maliyet Para Birimi
              </label>
              <select
                value={costCurrency}
                onChange={(e) => setCostCurrency(e.target.value as Currency)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-medium focus:outline-none focus:border-indigo-500"
              >
                <option value="TRY">TRY (₺)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </fieldset>

          {/* Current Price & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Birim Güncel Fiyat <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={currentPrice}
                onChange={(e) => setCurrentPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white tabular-nums focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Fiyat Para Birimi
              </label>
              <select
                value={currentCurrency}
                onChange={(e) => setCurrentCurrency(e.target.value as Currency)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-medium focus:outline-none focus:border-indigo-500"
              >
                <option value="TRY">TRY (₺)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          </>)}

          {/* Notes */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Yatırım Notu / Aracı Kurum (Opsiyonel)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="örn: Garanti BBVA Yatırım, Uzun vade temettü..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Total Preview Box */}
          {depositStatus ? (
            <DepositPreview deposit={deposit} principal={quantity} status={depositStatus} />
          ) : (
          <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between tabular-nums">
            <span className="text-slate-400 text-xs">Hesaplanan Toplam Değer:</span>
            <div className="text-right">
              <div className="text-white font-bold text-sm">
                {currentCurrency === 'TRY' ? '₺' : currentCurrency === 'USD' ? '$' : currentCurrency === 'EUR' ? '€' : '£'}
                {new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(quantity * currentPrice)}
              </div>
              {currentCurrency !== 'TRY' && (
                <div className="text-xs text-slate-400 font-normal">
                  ≈ ₺{new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(
                    quantity * currentPrice * (currentCurrency === 'USD' ? (rates.USD_TRY || 49.75) : currentCurrency === 'EUR' ? (rates.EUR_TRY || 55.80) : (rates.GBP_TRY || 66.65))
                  )}
                </div>
              )}
            </div>
          </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/30 transition-colors"
            >
              {editingAsset ? 'Değişiklikleri Kaydet' : 'Portföye Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

function newDeposit(): TimeDeposit {
  return {
    startDate: localToday(),
    annualRatePct: 40,
    termDays: 32,
    withholdingPct: DEFAULT_WITHHOLDING_PCT,
    autoRenew: true,
  };
}

const tl = (v: number, digits = 2) =>
  `₺${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)}`;

const longDate = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`)
  );

const inputClass =
  'w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white tabular-nums focus:outline-none focus:border-emerald-500';

const DepositPanel: React.FC<{
  enabled: boolean;
  onToggle: (on: boolean) => void;
  deposit: TimeDeposit;
  onChange: (patch: Partial<TimeDeposit>) => void;
  principal: number;
  onPrincipalChange: (v: number) => void;
  principalLocked: boolean;
}> = ({ enabled, onToggle, deposit, onChange, principal, onPrincipalChange, principalLocked }) => {
  const isPreset = DEPOSIT_TERM_OPTIONS.some((o) => o.days === deposit.termDays);
  const [customTerm, setCustomTerm] = useState(!isPreset);
  const daily = deposit.termDays <= 1;

  return (
    <div className="p-3.5 bg-emerald-950/20 border border-emerald-900/40 rounded-xl space-y-3">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="w-4 h-4 accent-emerald-500"
        />
        <span className="text-emerald-300 font-semibold">Mevduat hesabı olarak takip et</span>
        <span className="hidden sm:inline text-slate-400">· faiz her gün işlenir</span>
      </label>

      {enabled && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Anapara (₺) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                disabled={principalLocked}
                value={principal}
                onChange={(e) => onPrincipalChange(parseFloat(e.target.value) || 0)}
                className={`${inputClass} disabled:opacity-50`}
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Başlangıç Tarihi <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                max={localToday()}
                value={deposit.startDate}
                onChange={(e) => e.target.value && onChange({ startDate: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Yıllık Faiz (brüt %) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={deposit.annualRatePct}
                onChange={(e) => onChange({ annualRatePct: parseFloat(e.target.value) || 0 })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Vade</label>
            <div className="flex flex-wrap gap-1.5">
              {DEPOSIT_TERM_OPTIONS.map((o) => {
                const active = !customTerm && deposit.termDays === o.days;
                return (
                  <button
                    key={o.days}
                    type="button"
                    onClick={() => {
                      setCustomTerm(false);
                      onChange({ termDays: o.days });
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCustomTerm(true)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                  customTerm
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                Diğer
              </button>
              {customTerm && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="2"
                    step="1"
                    value={deposit.termDays}
                    onChange={(e) => onChange({ termDays: Math.max(2, Math.round(parseFloat(e.target.value) || 2)) })}
                    className="w-20 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white tabular-nums focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-slate-400">gün</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Stopaj (vergi kesintisi %)</label>
              <input
                type="number"
                step="any"
                min="0"
                max="100"
                value={deposit.withholdingPct}
                onChange={(e) => onChange({ withholdingPct: parseFloat(e.target.value) || 0 })}
                className={inputClass}
              />
            </div>
            {!daily && (
              <label className="flex items-center gap-2 cursor-pointer select-none pb-2.5">
                <input
                  type="checkbox"
                  checked={deposit.autoRenew}
                  onChange={(e) => onChange({ autoRenew: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span className="text-slate-300">Vade sonunda faiziyle yenile</span>
              </label>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const DepositPreview: React.FC<{
  deposit: TimeDeposit;
  principal: number;
  status: ReturnType<typeof getDepositStatus>;
}> = ({ deposit, principal, status }) => {
  const value = principal * status.factor;
  const earned = value - principal;
  const daily = status.maturityDate === null;
  const termNet = principal * status.termNetInterest;
  const termGross = termNet / (1 - deposit.withholdingPct / 100 || 1);

  return (
    <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl tabular-nums space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-slate-400">Bugünkü değer (net)</span>
        <div className="text-right">
          <div className="text-white font-bold text-sm">{tl(value)}</div>
          <div className="text-xs text-emerald-400">
            +{tl(earned)} faiz · {status.daysElapsed} gün
          </div>
        </div>
      </div>
      <div className="border-t border-slate-800 pt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-slate-400">
        {daily ? (
          <>
            <span>Günlük net faiz</span>
            <span className="text-right text-slate-200">{tl(value * status.termNetInterest)}</span>
            <span>Aylık net (30 gün, yaklaşık)</span>
            <span className="text-right text-slate-200">
              {tl(value * (Math.pow(1 + status.termNetInterest, 30) - 1))}
            </span>
          </>
        ) : (
          <>
            <span>{status.matured ? 'Vade bitti' : 'Vade sonu'}</span>
            <span className="text-right text-slate-200">
              {longDate(status.maturityDate!)}
              {!status.matured && <span className="text-slate-400"> · {status.daysToMaturity} gün kaldı</span>}
            </span>
            <span>Bu vadenin brüt faizi</span>
            <span className="text-right text-slate-200">{tl(termGross)}</span>
            <span>Stopaj (%{deposit.withholdingPct.toLocaleString('tr-TR')})</span>
            <span className="text-right text-rose-300">−{tl(termGross - termNet)}</span>
            <span>Vade sonu net tutar</span>
            <span className="text-right text-white font-semibold">
              {tl(principal * (status.termStartFactor + status.termNetInterest))}
            </span>
          </>
        )}
      </div>
      {!daily && !status.matured && (
        <p className="text-xs text-slate-500">
          Faiz gün gün tahakkuk ettirilerek gösterilir; banka vadeden önce bozulursa faiz ödemez.
        </p>
      )}
    </div>
  );
};
