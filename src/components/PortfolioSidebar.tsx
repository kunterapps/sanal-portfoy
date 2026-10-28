import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { CategorySummary, Currency, CurrencySummary } from '../types/portfolio';
import { CATEGORY_METADATA, formatCurrency, formatPercent } from '../utils/portfolioCalculations';
import { DailyChange, TrendPoint } from '../utils/snapshots';

export interface PortfolioTotals {
  totalValueTRY: number;
  totalValueUSD: number;
  totalCostTRY: number;
  totalCostUSD: number;
  totalProfitTRY: number;
  totalProfitUSD: number;
  totalProfitPercent: number;
  realizedProfitTRY: number;
  realizedProfitUSD: number;
  assetCount: number;
}

const signed = (amount: number, currency: Currency, decimals = 0) =>
  `${amount >= 0 ? '+' : '-'}${formatCurrency(Math.abs(amount), currency, decimals)}`;

const toneClass = (amount: number) => (amount >= 0 ? 'text-emerald-400' : 'text-rose-400');

const SectionTitle: React.FC<{ children: React.ReactNode; aside?: React.ReactNode }> = ({ children, aside }) => (
  <div className="flex items-baseline justify-between gap-2 mb-3">
    <h3 className="text-sm font-semibold text-slate-200">{children}</h3>
    {aside && <span className="text-xs text-slate-500">{aside}</span>}
  </div>
);

// ---------------------------------------------------------------------------
// Value, today's change, P/L and a 30-day sparkline
// ---------------------------------------------------------------------------

interface SummaryPanelProps {
  totals: PortfolioTotals;
  dailyChange: DailyChange | null;
  baseCurrency: Currency;
  onToggleCurrency: (c: Currency) => void;
  sparkData: TrendPoint[];
  staleCount: number;
}

export const SummaryPanel: React.FC<SummaryPanelProps> = ({
  totals,
  dailyChange,
  baseCurrency,
  onToggleCurrency,
  sparkData,
  staleCount,
}) => {
  const isTRY = baseCurrency === 'TRY';
  const value = isTRY ? totals.totalValueTRY : totals.totalValueUSD;
  const secondary = isTRY ? totals.totalValueUSD : totals.totalValueTRY;
  const profit = isTRY ? totals.totalProfitTRY : totals.totalProfitUSD;
  const cost = isTRY ? totals.totalCostTRY : totals.totalCostUSD;
  const realized = isTRY ? totals.realizedProfitTRY : totals.realizedProfitUSD;
  const daily = dailyChange ? (isTRY ? dailyChange.changeTRY : dailyChange.changeUSD) : null;

  // "Bugün" when the comparison is yesterday, otherwise name the day it compares to
  const dailyLabel = (() => {
    if (!dailyChange) return 'Bugün';
    const [y, m, d] = dailyChange.sinceDate.split('-').map(Number);
    const since = new Date(y, m - 1, d);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (since.toDateString() === yesterday.toDateString()) return 'Bugün';
    return `${since.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}'den beri`;
  })();

  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:gap-x-8 xl:grid-cols-1">
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-slate-400 font-medium">Portföy değeri</span>
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            {(['TRY', 'USD'] as Currency[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onToggleCurrency(c)}
                className={`px-2 py-0.5 rounded-md text-xs font-semibold transition-colors ${
                  baseCurrency === c ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-1 text-[2rem] leading-10 font-bold tabular-nums tracking-tight text-white">
          {formatCurrency(value, baseCurrency, 0)}
        </div>
        <div className="text-sm text-slate-500 tabular-nums">
          {formatCurrency(secondary, isTRY ? 'USD' : 'TRY', 0)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-2.5 min-w-0">
          <div className="text-xs text-slate-400 font-medium truncate" title="Al/sat etkisi hariç, önceki günün kaydına göre değişim">
            {dailyLabel}
          </div>
          {daily !== null && dailyChange ? (
            <>
              <div className={`text-base font-bold tabular-nums truncate ${toneClass(daily)}`}>
                {signed(daily, baseCurrency)}
              </div>
              <div className={`text-xs font-medium tabular-nums ${toneClass(daily)}`}>
                {formatPercent(dailyChange.percent)}
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-500 leading-snug mt-1">Yarından itibaren görünecek</div>
          )}
        </div>
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-2.5 min-w-0">
          <div className="text-xs text-slate-400 font-medium truncate" title="Açık pozisyonların kâr / zararı">
            Açık K/Z
          </div>
          <div className={`text-base font-bold tabular-nums truncate ${toneClass(profit)}`}>
            {signed(profit, baseCurrency)}
          </div>
          <div className={`text-xs font-medium tabular-nums ${toneClass(profit)}`}>
            {formatPercent(totals.totalProfitPercent)}
          </div>
        </div>
      </div>

      <div className="text-sm space-y-1.5 tabular-nums self-center xl:self-auto">
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">Yatırılan maliyet</span>
          <span className="text-slate-300">{formatCurrency(cost, baseCurrency, 0)}</span>
        </div>
        <div className="flex justify-between gap-3" title="Satışlardan gerçekleşen kâr/zarar (bugünkü kurla)">
          <span className="text-slate-500">Gerçekleşmiş K/Z</span>
          <span className={toneClass(realized)}>{signed(realized, baseCurrency)}</span>
        </div>
      </div>

      {sparkData.length >= 2 && <Sparkline data={sparkData} baseCurrency={baseCurrency} />}

      {staleCount > 0 && (
        <div className="sm:col-span-2 xl:col-span-1 flex items-start gap-2 text-xs text-amber-300 bg-amber-950/30 border border-amber-900/40 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
          <span>{staleCount} varlığın canlı fiyatı son güncellemede alınamadı; eski fiyat gösteriliyor.</span>
        </div>
      )}
    </div>
  );
};

const Sparkline: React.FC<{ data: TrendPoint[]; baseCurrency: Currency }> = ({ data, baseCurrency }) => {
  const w = 280;
  const h = 56;
  const values = data.map((d) => (baseCurrency === 'TRY' ? d.valueTRY : d.valueUSD));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 4 - ((v - min) / span) * (h - 8)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const up = values[values.length - 1] >= values[0];
  const color = up ? '#34d399' : '#fb7185';

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-14" aria-hidden="true">
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#sparkFill)" />
        <path d={line} fill="none" stroke={color} strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-xs text-slate-500 mt-1">
        <span>Son 30 gün</span>
        <span>{data[0].date} → Bugün</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Asset classes (donut) and currency exposure
// ---------------------------------------------------------------------------

interface AllocationPanelProps {
  categorySummaries: CategorySummary[];
  currencySummaries: CurrencySummary[];
  baseCurrency: Currency;
}

export const AllocationPanel: React.FC<AllocationPanelProps> = ({
  categorySummaries,
  currencySummaries,
  baseCurrency,
}) => {
  const [active, setActive] = useState<string | null>(null);
  const total = categorySummaries.reduce((sum, c) => sum + c.valueTRY, 0);

  const size = 128;
  const stroke = 16;
  const activeGrow = 6;
  // Leave room inside the SVG for the hovered slice's thicker stroke, otherwise its outer edge gets clipped
  const radius = (size - stroke - activeGrow) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const slices = categorySummaries
    .filter((c) => c.valueTRY > 0)
    .sort((a, b) => b.valueTRY - a.valueTRY)
    .map((c) => {
      const share = total > 0 ? c.valueTRY / total : 0;
      const slice = { ...c, share, dash: share * circumference, offset };
      offset += share * circumference;
      return slice;
    });
  const activeSlice = slices.find((s) => s.category === active);

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Varlık sınıfları</SectionTitle>
        {slices.length === 0 ? (
          <p className="text-xs text-slate-500">Henüz dağılım yok.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth={stroke} />
                {slices.map((s) => (
                  <circle
                    key={s.category}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={active === s.category ? stroke + activeGrow : stroke}
                    strokeDasharray={`${Math.max(0, s.dash - 1.5)} ${circumference}`}
                    strokeDashoffset={-s.offset}
                    className="transition-all duration-200"
                    onMouseEnter={() => setActive(s.category)}
                    onMouseLeave={() => setActive(null)}
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center tabular-nums">
                {activeSlice ? (
                  <>
                    <span className="text-sm font-bold text-white">%{(activeSlice.share * 100).toFixed(1)}</span>
                    <span className="text-[11px] text-slate-400 leading-tight">
                      {formatCurrency(baseCurrency === 'TRY' ? activeSlice.valueTRY : activeSlice.valueUSD, baseCurrency, 0)}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-slate-400">{slices.length} sınıf</span>
                )}
              </div>
            </div>
            <ul className="flex-1 min-w-0 text-sm space-y-0.5">
              {slices.map((s) => (
                <li
                  key={s.category}
                  onMouseEnter={() => setActive(s.category)}
                  onMouseLeave={() => setActive(null)}
                  className={`flex items-center justify-between gap-2 px-1.5 py-0.5 rounded-md cursor-default ${
                    active === s.category ? 'bg-slate-800/80' : ''
                  }`}
                  title={s.label}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="truncate text-slate-300">{CATEGORY_METADATA[s.category].shortLabel}</span>
                  </span>
                  <span className="font-semibold text-slate-100 tabular-nums">%{(s.share * 100).toFixed(0)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <SectionTitle aside={`Döviz %${currencySummaries.filter((c) => c.currency !== 'TRY').reduce((a, c) => a + c.percentage, 0).toFixed(0)}`}>
          Döviz riski
        </SectionTitle>
        <div className="space-y-3">
          {currencySummaries.map((c) => (
            <div key={c.currency} title={`${c.label}: ${formatCurrency(c.valueTRY, 'TRY', 0)}`}>
              <div className="flex items-center justify-between text-sm mb-1 tabular-nums">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.currency}
                </span>
                <span className="font-semibold text-slate-100">%{c.percentage.toFixed(1)}</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, Math.max(1, c.percentage))}%`, backgroundColor: c.color }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-3 leading-relaxed">
          Altın ve gümüş USD sayılır; fonlar TEFAS'taki döviz paylarına göre bölünür.
        </p>
      </div>
    </div>
  );
};
