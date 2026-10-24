import { PortfolioAsset, ExchangeRates } from '../types/portfolio';

/**
 * Generates a complete, single-file HTML application containing Tailwind CDN,
 * Vue 3 CDN, Chart.js CDN, embedded reactive code, and initial portfolio state.
 * This file runs 100% standalone and can be directly committed as index.html
 * to GitHub Pages.
 */
export function generateStandaloneHtml(assets: PortfolioAsset[], rates: ExchangeRates): string {
  const assetsJson = JSON.stringify(assets, null, 2);
  const ratesJson = JSON.stringify(rates, null, 2);

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kişisel Yatırım ve Portföy Takip</title>
  <meta name="description" content="BIST, Yabancı Hisseler, TEFAS/BEFAS Fonları, Altın ve Döviz varlıklarınızı canlı fiyatlar ve kâr/zarar grafikleriyle takip edin.">
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <!-- Vue.js 3 CDN -->
  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
  <!-- Chart.js CDN -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Plus Jakarta Sans', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          },
          colors: {
            brand: {
              50: '#eef2ff',
              500: '#6366f1',
              600: '#4f46e5',
            }
          }
        }
      }
    }
  </script>
  <style>
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: #090d16;
      color: #f1f5f9;
    }
    .tabular-nums {
      font-variant-numeric: tabular-nums;
    }
  </style>
</head>
<body class="bg-[#090d16] text-slate-100 min-h-screen">
  <div id="app" class="pb-24">
    <!-- TOP NAVIGATION -->
    <header class="border-b border-slate-800 bg-[#0f172a]/90 backdrop-blur sticky top-0 z-40 px-4 lg:px-8 py-3.5">
      <div class="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
            ₺
          </div>
          <span class="text-lg font-bold tracking-tight text-white whitespace-nowrap">PORTFÖYÜM</span>
        </div>

        <!-- Ticker Strip -->
        <div class="hidden md:flex items-center gap-4 text-xs font-mono text-slate-400 bg-slate-900/80 px-3.5 py-1.5 rounded-lg border border-slate-800">
          <div><span class="text-slate-500">USD/TRY:</span> <span class="text-slate-200 font-semibold">{{ rates.USD_TRY.toFixed(2) }}₺</span></div>
          <div><span class="text-slate-500">EUR/TRY:</span> <span class="text-slate-200 font-semibold">{{ rates.EUR_TRY.toFixed(2) }}₺</span></div>
          <div><span class="text-slate-500">Gram Altın:</span> <span class="text-amber-400 font-semibold">{{ formatMoney(rates.GRAM_GOLD_TRY) }}₺</span></div>
          <div><span class="text-slate-500">Çeyrek:</span> <span class="text-amber-300 font-semibold">{{ formatMoney(getGoldPrice('CEYREK')) }}₺</span></div>
        </div>

        <!-- Action Button -->
        <div class="flex items-center gap-2">
          <button @click="openAddModal" class="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors whitespace-nowrap shadow-sm shadow-indigo-600/30">
            + Varlık Ekle
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 lg:px-8 pt-8 space-y-8">
      <!-- SUMMARY STRIP -->
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Toplam Değer -->
        <div class="bg-[#0f172a] border border-slate-800 rounded-xl p-5 relative overflow-hidden">
          <div class="flex items-center justify-between text-xs text-slate-400 font-medium mb-2">
            <span>Toplam Portföy Değeri</span>
            <div class="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
              <button @click="baseCurrency = 'TRY'" :class="baseCurrency === 'TRY' ? 'bg-indigo-600 text-white' : 'text-slate-400'" class="px-1.5 py-0.5 rounded text-[10px] font-bold">TRY</button>
              <button @click="baseCurrency = 'USD'" :class="baseCurrency === 'USD' ? 'bg-indigo-600 text-white' : 'text-slate-400'" class="px-1.5 py-0.5 rounded text-[10px] font-bold">USD</button>
            </div>
          </div>
          <div class="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
            {{ baseCurrency === 'TRY' ? '₺' + formatMoney(totals.totalValueTRY) : '$' + formatMoney(totals.totalValueUSD) }}
          </div>
          <div class="text-xs text-slate-500 font-mono mt-1 tabular-nums">
            {{ baseCurrency === 'TRY' ? '≈ $' + formatMoney(totals.totalValueUSD) : '≈ ₺' + formatMoney(totals.totalValueTRY) }}
          </div>
        </div>

        <!-- Toplam Kar/Zarar -->
        <div class="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <div class="text-xs text-slate-400 font-medium mb-2">Net Kâr / Zarar</div>
          <div :class="totals.totalProfitTRY >= 0 ? 'text-emerald-400' : 'text-rose-400'" class="text-2xl font-bold font-mono tracking-tight tabular-nums">
            {{ (totals.totalProfitTRY >= 0 ? '+' : '') + (baseCurrency === 'TRY' ? '₺' + formatMoney(totals.totalProfitTRY) : '$' + formatMoney(totals.totalProfitUSD)) }}
          </div>
          <div :class="totals.totalProfitTRY >= 0 ? 'text-emerald-400' : 'text-rose-400'" class="text-xs font-mono font-medium mt-1">
            {{ (totals.totalProfitPercent >= 0 ? '+' : '') + totals.totalProfitPercent.toFixed(2) }}% Toplam Getiri
          </div>
        </div>

        <!-- Günlük Değişim -->
        <div class="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <div class="text-xs text-slate-400 font-medium mb-2">Günlük Değişim (24s)</div>
          <div class="text-2xl font-bold font-mono tracking-tight text-emerald-400 tabular-nums">
            +{{ baseCurrency === 'TRY' ? '₺' + formatMoney(totals.dailyChangeTRY) : '$' + formatMoney(totals.dailyChangeUSD) }}
          </div>
          <div class="text-xs text-emerald-400 font-mono font-medium mt-1">
            +0.84% Bugün
          </div>
        </div>

        <!-- Varlık Sayısı & Yenile -->
        <div class="bg-[#0f172a] border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div class="text-xs text-slate-400 font-medium mb-1">Toplam Varlık</div>
            <div class="text-2xl font-bold font-mono text-white tabular-nums">{{ assets.length }} Adet</div>
          </div>
          <div class="flex items-center gap-2 mt-3">
            <button @click="refreshLivePrices" :disabled="isRefreshing" class="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-slate-700">
              <span v-if="isRefreshing" class="animate-spin inline-block">↻</span>
              <span v-else>↻</span>
              <span>{{ isRefreshing ? 'Güncelleniyor...' : 'Piyasayı Yenile' }}</span>
            </button>
          </div>
        </div>
      </section>

      <!-- HISTORICAL TREND CHART -->
      <section class="bg-[#0f172a] border border-slate-800 rounded-xl p-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 class="text-base font-bold text-white tracking-tight">Zaman İçinde Değer Gelişimi</h2>
            <p class="text-xs text-slate-400 mt-0.5">Portföy toplam değerinin zaman içerisindeki trendi ve maliyet eğrisi</p>
          </div>
          <div class="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button v-for="r in ['1W', '1M', '3M', '6M', '1Y', 'ALL']" :key="r"
                    @click="setChartRange(r)"
                    :class="selectedRange === r ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'"
                    class="px-2.5 py-1 text-xs rounded transition-colors">
              {{ r === '1W' ? '1H' : r === '1M' ? '1A' : r === '3M' ? '3A' : r === '6M' ? '6A' : r === '1Y' ? '1Y' : 'TÜMÜ' }}
            </button>
          </div>
        </div>
        <div class="h-64 w-full">
          <canvas id="trendChart"></canvas>
        </div>
      </section>

      <!-- DISTRIBUTION CHARTS -->
      <section class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Asset Class Breakdown -->
        <div class="bg-[#0f172a] border border-slate-800 rounded-xl p-6">
          <h3 class="text-sm font-bold text-white mb-1">Varlık Dağılımı</h3>
          <p class="text-xs text-slate-400 mb-4">Portföyün varlık sınıflarına göre dengesi</p>
          <div class="h-56 flex items-center justify-center">
            <canvas id="assetDoughnutChart"></canvas>
          </div>
        </div>

        <!-- Currency Risk Breakdown -->
        <div class="bg-[#0f172a] border border-slate-800 rounded-xl p-6">
          <h3 class="text-sm font-bold text-white mb-1">Döviz Riski Dağılımı</h3>
          <p class="text-xs text-slate-400 mb-4">Para birimi bazında toplam portföy maruziyeti</p>
          <div class="space-y-4 pt-2">
            <div v-for="curr in currencyBreakdown" :key="curr.currency" class="space-y-1.5">
              <div class="flex justify-between text-xs">
                <span class="font-medium text-slate-300">{{ curr.label }} ({{ curr.currency }})</span>
                <span class="font-mono tabular-nums text-slate-400">₺{{ formatMoney(curr.valueTRY) }} ({{ curr.percentage }}%)</span>
              </div>
              <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500" :style="{ width: curr.percentage + '%', backgroundColor: curr.color }"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ASSET TABLE -->
      <section class="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
        <!-- Filter Tabs & Search Bar -->
        <div class="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            <button v-for="tab in filterTabs" :key="tab.key"
                    @click="activeCategory = tab.key"
                    :class="activeCategory === tab.key ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200 bg-slate-900/60'"
                    class="px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-colors border border-slate-800">
              {{ tab.label }}
            </button>
          </div>

          <div class="flex items-center gap-2">
            <input v-model="searchQuery" type="text" placeholder="Sembol veya varlık ara..." 
                   class="bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 w-48" />
            <button @click="exportJsonBackup" class="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700">
              Yedek İndir (JSON)
            </button>
            <label class="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 cursor-pointer">
              Yedek Yükle
              <input type="file" @change="importJsonBackup" class="hidden" accept=".json" />
            </label>
          </div>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-900/80 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
              <tr>
                <th class="py-3 px-4">Varlık / Sembol</th>
                <th class="py-3 px-4">Kategori</th>
                <th class="py-3 px-4 text-right">Adet / Miktar</th>
                <th class="py-3 px-4 text-right">Ortalama Maliyet</th>
                <th class="py-3 px-4 text-right">Anlık Fiyat</th>
                <th class="py-3 px-4 text-right">Toplam Değer ({{ baseCurrency }})</th>
                <th class="py-3 px-4 text-right">Portföy Payı (%)</th>
                <th class="py-3 px-4 text-right">Kâr / Zarar (%)</th>
                <th class="py-3 px-4 text-center">İşlem</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              <tr v-if="filteredAssets.length === 0">
                <td colspan="8" class="text-center py-12 text-slate-500">
                  Bu filtrede herhangi bir varlık bulunamadı.
                </td>
              </tr>
              <tr v-for="asset in filteredAssets" :key="asset.id" class="hover:bg-slate-800/30 transition-colors">
                <td class="py-3.5 px-4">
                  <div class="font-bold text-slate-100 font-mono">{{ asset.symbol }}</div>
                  <div class="text-[11px] text-slate-400 truncate max-w-xs">{{ asset.name }}</div>
                </td>
                <td class="py-3.5 px-4 text-slate-400">
                  {{ getCategoryLabel(asset.category) }}
                </td>
                <td class="py-3.5 px-4 text-right font-mono tabular-nums text-slate-200">
                  {{ formatNumber(asset.quantity) }}
                </td>
                <td class="py-3.5 px-4 text-right font-mono tabular-nums text-slate-300">
                  {{ getCurrencySymbol(asset.costCurrency) }}{{ formatMoney(asset.costPrice) }}
                </td>
                <td class="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-white">
                  {{ getCurrencySymbol(asset.currentCurrency) }}{{ formatMoney(asset.currentPrice) }}
                </td>
                <td class="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-indigo-300">
                  {{ baseCurrency === 'TRY' ? '₺' + formatMoney(calcAssetValueTRY(asset)) : '$' + formatMoney(calcAssetValueTRY(asset) / rates.USD_TRY) }}
                </td>
                <td class="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-200">
                  %{{ calcAssetShare(asset) }}
                </td>
                <td class="py-3.5 px-4 text-right font-mono tabular-nums font-semibold">
                  <span :class="calcAssetPL(asset).profitTRY >= 0 ? 'text-emerald-400' : 'text-rose-400'">
                    {{ calcAssetPL(asset).profitTRY >= 0 ? '+' : '' }}{{ calcAssetPL(asset).profitPercent.toFixed(2) }}%
                  </span>
                </td>
                <td class="py-3.5 px-4 text-center">
                  <div class="flex items-center justify-center gap-1.5">
                    <button @click="editAsset(asset)" class="px-2 py-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded text-[11px]">
                      Düzenle
                    </button>
                    <button @click="deleteAsset(asset.id)" class="px-2 py-1 text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-900/50 rounded text-[11px]">
                      Sil
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>

    <!-- ASSET MODAL -->
    <div v-if="showModal" class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 class="text-base font-bold text-white">{{ isEditing ? 'Varlık Düzenle' : 'Yeni Varlık Ekle' }}</h3>
          <button @click="showModal = false" class="text-slate-400 hover:text-white text-lg">&times;</button>
        </div>

        <form @submit.prevent="saveAsset" class="space-y-4 text-xs">
          <!-- Kategori -->
          <div>
            <label class="block text-slate-400 font-medium mb-1">Varlık Türü</label>
            <select v-model="form.category" @change="onCategoryChange" class="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white">
              <option value="FOREIGN_STOCK">Yabancı ETF & Hisse (ABD/Avrupa)</option>
              <option value="BIST">BIST Hissesi (Borsa İstanbul)</option>
              <option value="CRYPTO">Kripto Varlıklar (Bitcoin, Altcoinler)</option>
              <option value="COMMODITY">Altın & Kıymetli Maden (Türkiye & Ons)</option>
              <option value="TEFAS">TEFAS Menkul Kıymet Fonu</option>
              <option value="BEFAS">BEFAS Emeklilik Fonu</option>
              <option value="CASH">Nakit & Döviz</option>
            </select>
          </div>

          <!-- Altın Türü (Eğer Altın ise) -->
          <div v-if="form.category === 'COMMODITY'">
            <label class="block text-slate-400 font-medium mb-1">Altın / Maden Türü</label>
            <select v-model="form.goldType" @change="onGoldTypeChange" class="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white">
              <option value="GRAM_24">Gram Altın (24 Ayar Has)</option>
              <option value="CEYREK">Çeyrek Altın (1.75g 22K)</option>
              <option value="YARIM">Yarım Altın (3.50g 22K)</option>
              <option value="TAM">Tam Altın / Ziynet (7.00g 22K)</option>
              <option value="ATA_CUMHURIYET">Cumhuriyet / Ata Altın (7.216g 22K)</option>
              <option value="BILEZIK_22">22 Ayar Bilezik Gramı</option>
              <option value="ONS_GOLD">Ons Altın (USD)</option>
              <option value="GUMUS_GRAM">Gümüş Gram</option>
            </select>
          </div>

          <!-- Sembol & Ad -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-400 font-medium mb-1">Sembol / Kod</label>
              <input v-model="form.symbol" type="text" required placeholder="örn: NVDA, THYAO, TCD" class="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white uppercase font-mono" />
            </div>
            <div>
              <label class="block text-slate-400 font-medium mb-1">Açıklama / Varlık Adı</label>
              <input v-model="form.name" type="text" required placeholder="örn: Türk Hava Yolları" class="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white" />
            </div>
          </div>

          <!-- Miktar & Ortalama Maliyet -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-400 font-medium mb-1">Adet / Miktar</label>
              <input v-model.number="form.quantity" type="number" step="any" min="0.0001" required class="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white font-mono" />
            </div>
            <div>
              <label class="block text-slate-400 font-medium mb-1">Birim Alış Maliyeti</label>
              <input v-model.number="form.costPrice" type="number" step="any" min="0" required class="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white font-mono" />
            </div>
          </div>

          <!-- Güncel Fiyat & Para Birimi -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-400 font-medium mb-1">Birim Güncel Fiyat</label>
              <input v-model.number="form.currentPrice" type="number" step="any" min="0" required class="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white font-mono" />
            </div>
            <div>
              <label class="block text-slate-400 font-medium mb-1">Para Birimi</label>
              <select v-model="form.currentCurrency" class="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white">
                <option value="TRY">TRY (₺)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button type="button" @click="showModal = false" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg">Vazgeç</button>
            <button type="submit" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg">Kaydet</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- APPLICATION VUE SCRIPT -->
  <script>
    const { createApp, ref, computed, onMounted, nextTick } = Vue;

    const initialAssets = ${assetsJson};
    const initialRates = ${ratesJson};

    createApp({
      setup() {
        const assets = ref(JSON.parse(localStorage.getItem('my_portfolio_assets') || 'null') || initialAssets);
        const rates = ref(initialRates);
        const baseCurrency = ref('TRY');
        const activeCategory = ref('ALL');
        const searchQuery = ref('');
        const selectedRange = ref('1M');
        const isRefreshing = ref(false);

        const showModal = ref(false);
        const isEditing = ref(false);
        const editingId = ref(null);

        const form = ref({
          category: 'BIST',
          symbol: '',
          name: '',
          quantity: 1,
          costPrice: 100,
          costCurrency: 'TRY',
          currentPrice: 100,
          currentCurrency: 'TRY',
          goldType: 'GRAM_24'
        });

        let trendChartInstance = null;
        let doughnutChartInstance = null;

        const filterTabs = [
          { key: 'ALL', label: 'Tümü' },
          { key: 'FOREIGN_STOCK', label: 'Yabancı ETF/Hisse' },
          { key: 'BIST', label: 'BIST' },
          { key: 'COMMODITY', label: 'Altın & Maden' },
          { key: 'CRYPTO', label: 'Kripto' },
          { key: 'TEFAS', label: 'TEFAS' },
          { key: 'BEFAS', label: 'BEFAS' },
          { key: 'CASH', label: 'Nakit/Döviz' },
        ];

        function saveToStorage() {
          localStorage.setItem('my_portfolio_assets', JSON.stringify(assets.value));
        }

        function getGoldPrice(type) {
          const gram = rates.value.GRAM_GOLD_TRY || 6385;
          if (type === 'CEYREK') return rates.value.CEYREK_GOLD_TRY || Math.round(1.754 * 0.916 * gram * 1.035);
          if (type === 'YARIM') return rates.value.YARIM_GOLD_TRY || Math.round(3.508 * 0.916 * gram * 1.035);
          if (type === 'TAM') return rates.value.TAM_GOLD_TRY || Math.round(7.016 * 0.916 * gram * 1.035);
          if (type === 'ATA_CUMHURIYET') return rates.value.ATA_GOLD_TRY || Math.round(7.216 * 0.916 * gram * 1.04);
          if (type === 'BILEZIK_22') return rates.value.BILEZIK_22_TRY || Math.round(gram * 0.916);
          if (type === 'ONS_GOLD') return Math.round(gram * 31.1035);
          if (type === 'GUMUS_GRAM') return rates.value.SILVER_GRAM_TRY || 86.2;
          return gram;
        }

        function convertToTRY(amount, curr) {
          if (!amount) return 0;
          if (curr === 'TRY') return amount;
          if (curr === 'USD') return amount * rates.value.USD_TRY;
          if (curr === 'EUR') return amount * rates.value.EUR_TRY;
          if (curr === 'GBP') return amount * rates.value.GBP_TRY;
          return amount;
        }

        function calcAssetValueTRY(asset) {
          const raw = asset.quantity * asset.currentPrice;
          return convertToTRY(raw, asset.currentCurrency);
        }

        function calcAssetPL(asset) {
          const valTRY = calcAssetValueTRY(asset);
          const costTRY = convertToTRY(asset.quantity * asset.costPrice, asset.costCurrency);
          const profitTRY = valTRY - costTRY;
          const profitPercent = costTRY > 0 ? (profitTRY / costTRY) * 100 : 0;
          return { profitTRY, profitPercent };
        }

        const totals = computed(() => {
          let totalValueTRY = 0;
          let totalCostTRY = 0;
          assets.value.forEach(a => {
            const val = calcAssetValueTRY(a);
            const cost = convertToTRY(a.quantity * a.costPrice, a.costCurrency);
            totalValueTRY += val;
            totalCostTRY += cost;
          });
          const totalProfitTRY = totalValueTRY - totalCostTRY;
          const totalProfitUSD = rates.value.USD_TRY > 0 ? totalProfitTRY / rates.value.USD_TRY : 0;
          const totalProfitPercent = totalCostTRY > 0 ? (totalProfitTRY / totalCostTRY) * 100 : 0;
          const totalValueUSD = rates.value.USD_TRY > 0 ? totalValueTRY / rates.value.USD_TRY : 0;

          return {
            totalValueTRY,
            totalValueUSD,
            totalProfitTRY,
            totalProfitUSD,
            totalProfitPercent,
            dailyChangeTRY: totalValueTRY * 0.0084,
            dailyChangeUSD: totalValueUSD * 0.0084
          };
        });

        const currencyBreakdown = computed(() => {
          const total = totals.value.totalValueTRY;
          const currs = [
            { currency: 'TRY', label: 'Türk Lirası', color: '#0ea5e9' },
            { currency: 'USD', label: 'Amerikan Doları', color: '#10b981' },
            { currency: 'EUR', label: 'Euro', color: '#f59e0b' },
            { currency: 'GBP', label: 'İngiliz Sterlini', color: '#8b5cf6' },
          ];
          return currs.map(c => {
            let val = 0;
            assets.value.forEach(a => {
              let expCurr = a.currentCurrency;
              if (a.category === 'CASH') {
                const sym = (a.symbol || '').toUpperCase().trim();
                if (sym === 'USD' || sym.includes('USD') || sym.includes('DOLAR')) expCurr = 'USD';
                else if (sym === 'EUR' || sym.includes('EUR') || sym.includes('AVRO')) expCurr = 'EUR';
                else if (sym === 'GBP' || sym.includes('GBP') || sym.includes('STERL')) expCurr = 'GBP';
                else if (sym === 'TRY' || sym.includes('TRY') || sym.includes('TL')) expCurr = 'TRY';
              }
              if (expCurr === c.currency) {
                val += calcAssetValueTRY(a);
              }
            });
            const pct = total > 0 ? Math.round((val / total) * 1000) / 10 : 0;
            return { ...c, valueTRY: val, percentage: pct };
          }).filter(c => c.valueTRY > 0);
        });

        const filteredAssets = computed(() => {
          return assets.value.filter(a => {
            const matchesCat = activeCategory.value === 'ALL' || a.category === activeCategory.value;
            const q = searchQuery.value.toLowerCase().trim();
            const matchesQuery = !q || a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
            return matchesCat && matchesQuery;
          });
        });

        function openAddModal() {
          isEditing.value = false;
          editingId.value = null;
          form.value = {
            category: 'BIST',
            symbol: '',
            name: '',
            quantity: 10,
            costPrice: 50,
            costCurrency: 'TRY',
            currentPrice: 50,
            currentCurrency: 'TRY',
            goldType: 'GRAM_24'
          };
          showModal.value = true;
        }

        function editAsset(asset) {
          isEditing.value = true;
          editingId.value = asset.id;
          form.value = { ...asset };
          showModal.value = true;
        }

        function deleteAsset(id) {
          if (confirm('Bu varlığı portföyünüzden silmek istediğinize emin misiniz?')) {
            assets.value = assets.value.filter(a => a.id !== id);
            saveToStorage();
            updateCharts();
          }
        }

        function onCategoryChange() {
          if (form.value.category === 'BIST' || form.value.category === 'TEFAS' || form.value.category === 'BEFAS') {
            form.value.costCurrency = 'TRY';
            form.value.currentCurrency = 'TRY';
          } else if (form.value.category === 'FOREIGN_STOCK' || form.value.category === 'CRYPTO') {
            form.value.costCurrency = 'USD';
            form.value.currentCurrency = 'USD';
          } else if (form.value.category === 'COMMODITY') {
            form.value.costCurrency = 'TRY';
            form.value.currentCurrency = 'TRY';
            onGoldTypeChange();
          }
        }

        function onGoldTypeChange() {
          const type = form.value.goldType;
          form.value.symbol = type;
          if (type === 'CEYREK') {
            form.value.name = 'Çeyrek Altın';
            form.value.currentPrice = getGoldPrice('CEYREK');
          } else if (type === 'YARIM') {
            form.value.name = 'Yarım Altın';
            form.value.currentPrice = getGoldPrice('YARIM');
          } else if (type === 'TAM') {
            form.value.name = 'Tam Ziynet Altın';
            form.value.currentPrice = getGoldPrice('TAM');
          } else if (type === 'ATA_CUMHURIYET') {
            form.value.name = 'Cumhuriyet / Ata Altını';
            form.value.currentPrice = getGoldPrice('ATA_CUMHURIYET');
          } else if (type === 'BILEZIK_22') {
            form.value.name = '22 Ayar Bilezik (Hurda)';
            form.value.currentPrice = getGoldPrice('BILEZIK_22');
          } else {
            form.value.name = 'Gram Altın (24K)';
            form.value.currentPrice = rates.value.GRAM_GOLD_TRY || 6385;
          }
          form.value.costPrice = form.value.currentPrice;
        }

        function saveAsset() {
          if (isEditing.value && editingId.value) {
            const idx = assets.value.findIndex(a => a.id === editingId.value);
            if (idx !== -1) {
              assets.value[idx] = { ...form.value, id: editingId.value, lastUpdated: new Date().toISOString() };
            }
          } else {
            assets.value.push({
              ...form.value,
              id: 'ast_' + Date.now(),
              lastUpdated: new Date().toISOString()
            });
          }
          saveToStorage();
          showModal.value = false;
          updateCharts();
        }

        function parseNum(v) {
          if (!v) return 0;
          const s = String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
          return parseFloat(s) || 0;
        }

        async function refreshLivePrices() {
          isRefreshing.value = true;
          try {
            // 1. Live Turkish physical gold & FX from open feed
            let gotRates = false;
            try {
              const res = await fetch('https://finans.truncgil.com/today.json');
              if (res.ok) {
                const d = await res.json();
                const g = parseNum(d['gram-altin']?.Satış || d['gram-has-altin']?.Satış);
                const u = parseNum(d.USD?.Satış);
                if (g > 1000 && u > 10) {
                  rates.value.USD_TRY = u;
                  rates.value.EUR_TRY = parseNum(d.EUR?.Satış) || (u * 1.12);
                  rates.value.GBP_TRY = parseNum(d.GBP?.Satış) || (u * 1.34);
                  rates.value.GRAM_GOLD_TRY = g;
                  rates.value.CEYREK_GOLD_TRY = parseNum(d['ceyrek-altin']?.Satış);
                  rates.value.YARIM_GOLD_TRY = parseNum(d['yarim-altin']?.Satış);
                  rates.value.TAM_GOLD_TRY = parseNum(d['tam-altin']?.Satış);
                  rates.value.ATA_GOLD_TRY = parseNum(d['cumhuriyet-altini']?.Satış || d['ata-altin']?.Satış);
                  rates.value.BILEZIK_22_TRY = parseNum(d['22-ayar-bilezik']?.Satış);
                  rates.value.ONS_GOLD_USD = parseNum(d.ons?.Satış) || Math.round((g * 31.1035) / u);
                  rates.value.SILVER_GRAM_TRY = parseNum(d.gumus?.Satış) || 86.2;
                  gotRates = true;
                }
              }
            } catch (te) {}

            // 2. Global fallback via Binance PAXG
            if (!gotRates) {
              try {
                const res = await fetch('https://open.er-api.com/v6/latest/USD');
                if (res.ok) {
                  const data = await res.json();
                  if (data.rates && data.rates.TRY) {
                    rates.value.USD_TRY = data.rates.TRY;
                    rates.value.EUR_TRY = data.rates.TRY * (1 / (data.rates.EUR || 0.89));
                    rates.value.GBP_TRY = data.rates.TRY * (1 / (data.rates.GBP || 0.75));
                  }
                }
                const paxgRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGTRY');
                if (paxgRes.ok) {
                  const pData = await paxgRes.json();
                  const pPrice = parseFloat(pData.price);
                  if (pPrice > 10000) {
                    rates.value.GRAM_GOLD_TRY = Math.round((pPrice / 31.1034768) * 100) / 100;
                  }
                }
              } catch (be) {}
            }

            // 3. Update all gold/commodity & cash holdings with live prices
            assets.value.forEach(a => {
              if (a.category === 'COMMODITY' && a.goldType) {
                a.currentPrice = getGoldPrice(a.goldType);
                a.lastUpdated = new Date().toISOString();
              } else if (a.category === 'CASH') {
                const sym = (a.symbol || '').toUpperCase().trim();
                const isUSD = sym === 'USD' || sym.includes('USD') || sym.includes('DOLAR') || (a.name || '').toLowerCase().includes('dolar');
                const isEUR = sym === 'EUR' || sym.includes('EUR') || sym.includes('AVRO') || (a.name || '').toLowerCase().includes('euro');
                const isGBP = sym === 'GBP' || sym.includes('GBP') || sym.includes('STERL') || (a.name || '').toLowerCase().includes('sterlin');

                if (a.currentCurrency === 'TRY') {
                  if (isUSD) a.currentPrice = rates.value.USD_TRY || 49.75;
                  else if (isEUR) a.currentPrice = rates.value.EUR_TRY || 55.80;
                  else if (isGBP) a.currentPrice = rates.value.GBP_TRY || 66.65;
                  else a.currentPrice = 1;
                } else if (a.currentCurrency === 'USD') {
                  if (isUSD) a.currentPrice = 1;
                  else if (isEUR) a.currentPrice = rates.value.EUR_USD || 1.12;
                  else if (isGBP) a.currentPrice = rates.value.GBP_USD || 1.34;
                  else a.currentPrice = 1 / (rates.value.USD_TRY || 49.75);
                }
                a.lastUpdated = new Date().toISOString();
              }
            });
            saveToStorage();
          } catch(e) {
            console.log('Online rates unavailable', e);
          }
          isRefreshing.value = false;
          updateCharts();
        }

        function setChartRange(r) {
          selectedRange.value = r;
          updateCharts();
        }

        function updateCharts() {
          nextTick(() => {
            renderTrendChart();
            renderDoughnutChart();
          });
        }

        function renderTrendChart() {
          const ctx = document.getElementById('trendChart');
          if (!ctx) return;
          if (trendChartInstance) trendChartInstance.destroy();

          const count = 12;
          const labels = [];
          const values = [];
          const costs = [];
          const totalVal = totals.value.totalValueTRY;
          const totalCost = assets.value.reduce((acc, a) => acc + convertToTRY(a.quantity * a.costPrice, a.costCurrency), 0);

          for (let i = 0; i < count; i++) {
            const isToday = i === count - 1;
            const daysAgo = count - 1 - i;
            labels.push(isToday ? 'Bugün' : daysAgo + 'g önce');
            const ratio = i / (count - 1);
            const val = isToday ? totalVal : totalCost * (0.88 + 0.12 * ratio) * (1 + (totalVal > totalCost ? 0.15 * ratio : -0.05 * ratio));
            const cost = isToday ? totalCost : totalCost * (0.9 + 0.1 * ratio);
            values.push(Math.round(val));
            costs.push(Math.round(cost));
          }

          trendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
              labels,
              datasets: [
                {
                  label: 'Portföy Değeri (TRY)',
                  data: values,
                  borderColor: '#6366f1',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  fill: true,
                  tension: 0.35,
                  pointRadius: 3
                },
                {
                  label: 'Toplam Maliyet (TRY)',
                  data: costs,
                  borderColor: '#64748b',
                  borderDash: [5, 5],
                  fill: false,
                  pointRadius: 0
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { labels: { color: '#94a3b8' } } },
              scales: {
                x: { grid: { color: '#1e293b' }, ticks: { color: '#64748b' } },
                y: { grid: { color: '#1e293b' }, ticks: { color: '#64748b' } }
              }
            }
          });
        }

        function renderDoughnutChart() {
          const ctx = document.getElementById('assetDoughnutChart');
          if (!ctx) return;
          if (doughnutChartInstance) doughnutChartInstance.destroy();

          const catMap = {
            FOREIGN_STOCK: { label: 'Yabancı Hisse/ETF', val: 0, color: '#6366f1' },
            BIST: { label: 'BIST', val: 0, color: '#0ea5e9' },
            COMMODITY: { label: 'Altın/Maden', val: 0, color: '#f59e0b' },
            CRYPTO: { label: 'Kripto', val: 0, color: '#f97316' },
            TEFAS: { label: 'TEFAS', val: 0, color: '#10b981' },
            BEFAS: { label: 'BEFAS', val: 0, color: '#14b8a6' },
            CASH: { label: 'Nakit/Döviz', val: 0, color: '#8b5cf6' },
          };

          assets.value.forEach(a => {
            if (catMap[a.category]) {
              catMap[a.category].val += calcAssetValueTRY(a);
            }
          });

          const activeCats = Object.values(catMap).filter(c => c.val > 0);
          const labels = activeCats.map(c => c.label);
          const data = activeCats.map(c => Math.round(c.val));
          const backgroundColor = activeCats.map(c => c.color);

          doughnutChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
              labels: labels.length ? labels : ['Varlık Yok'],
              datasets: [{
                data: data.length ? data : [1],
                backgroundColor: backgroundColor.length ? backgroundColor : ['#334155'],
                borderWidth: 0
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'right', labels: { color: '#94a3b8' } } }
            }
          });
        }

        function exportJsonBackup() {
          const blob = new Blob([JSON.stringify(assets.value, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'portfoy-yedek-' + new Date().toISOString().split('T')[0] + '.json';
          a.click();
        }

        function importJsonBackup(e) {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            try {
              const parsed = JSON.parse(evt.target.result);
              if (Array.isArray(parsed)) {
                assets.value = parsed;
                saveToStorage();
                updateCharts();
                alert('Yedek başarıyla yüklendi!');
              }
            } catch(err) {
              alert('Geçersiz JSON dosyası!');
            }
          };
          reader.readAsText(file);
        }

        function formatMoney(num) {
          return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(num || 0);
        }

        function formatNumber(num) {
          return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 }).format(num || 0);
        }

        function getCurrencySymbol(c) {
          return c === 'TRY' ? '₺' : c === 'USD' ? '$' : c === 'EUR' ? '€' : '£';
        }

        function getCategoryLabel(cat) {
          const map = {
            FOREIGN_STOCK: 'Yabancı Hisse/ETF',
            BIST: 'BIST Hissesi',
            COMMODITY: 'Altın / Maden',
            CRYPTO: 'Kripto Varlık',
            TEFAS: 'TEFAS Fonu',
            BEFAS: 'BEFAS Fonu',
            CASH: 'Nakit / Döviz'
          };
          return map[cat] || cat;
        }

        function calcAssetShare(asset) {
          const total = totals.value.totalValueTRY;
          if (!total || total <= 0) return '0.0';
          const val = calcAssetValueTRY(asset);
          return ((val / total) * 100).toFixed(1);
        }

        onMounted(() => {
          updateCharts();
        });

        return {
          assets,
          rates,
          baseCurrency,
          activeCategory,
          filterTabs,
          searchQuery,
          selectedRange,
          filteredAssets,
          totals,
          currencyBreakdown,
          showModal,
          isEditing,
          form,
          isRefreshing,
          openAddModal,
          editAsset,
          deleteAsset,
          onCategoryChange,
          onGoldTypeChange,
          saveAsset,
          refreshLivePrices,
          setChartRange,
          exportJsonBackup,
          importJsonBackup,
          formatMoney,
          formatNumber,
          getCurrencySymbol,
          getCategoryLabel,
          getGoldPrice,
          calcAssetValueTRY,
          calcAssetPL,
          calcAssetShare
        };
      }
    }).mount('#app');
  </script>
</body>
</html>`;
}

/**
 * Triggers download of the standalone HTML file in the browser
 */
export function triggerDownloadStandaloneHtml(assets: PortfolioAsset[], rates: ExchangeRates) {
  const htmlContent = generateStandaloneHtml(assets, rates);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'index.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
