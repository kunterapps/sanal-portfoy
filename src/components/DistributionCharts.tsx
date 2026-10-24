import React, { useState } from 'react';
import { CategorySummary, CurrencySummary, Currency } from '../types/portfolio';
import { formatCurrency } from '../utils/portfolioCalculations';

interface DistributionChartsProps {
  categorySummaries: CategorySummary[];
  currencySummaries: CurrencySummary[];
  baseCurrency: Currency;
  totalValueTRY: number;
}

export const DistributionCharts: React.FC<DistributionChartsProps> = ({
  categorySummaries,
  currencySummaries,
  baseCurrency,
  totalValueTRY,
}) => {
  const [activeSlice, setActiveSlice] = useState<number | null>(null);

  // SVG Doughnut Calculation for Asset Allocation
  const size = 180;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;
  const totalCatValue = categorySummaries.reduce((sum, c) => sum + c.valueTRY, 0);

  const slices = categorySummaries.map((cat, index) => {
    const percent = totalCatValue > 0 ? cat.valueTRY / totalCatValue : 0;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativePercent * circumference;
    cumulativePercent += percent;

    return {
      ...cat,
      index,
      percent: Math.round(percent * 1000) / 10,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Varlık Sınıfı Dağılımı */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold text-white">Varlık Sınıfı Dağılımı</h3>
            <span className="text-xs text-slate-500">Kategori Bazlı</span>
          </div>
          <p className="text-sm text-slate-400 mb-6">
            Hisse senedi, fon, altın ve nakit varlıklarınızın portföy ağırlığı
          </p>

          {categorySummaries.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Henüz dağılım hesaplanacak varlık bulunmuyor.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              {/* SVG Doughnut */}
              <div className="relative shrink-0 flex items-center justify-center">
                <svg width={size} height={size} className="transform -rotate-90">
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke="#1e293b"
                    strokeWidth={strokeWidth}
                  />
                  {slices.map((slice) => (
                    <circle
                      key={slice.category}
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="transparent"
                      stroke={slice.color}
                      strokeWidth={activeSlice === slice.index ? strokeWidth + 4 : strokeWidth}
                      strokeDasharray={slice.strokeDasharray}
                      strokeDashoffset={slice.strokeDashoffset}
                      strokeLinecap="round"
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setActiveSlice(slice.index)}
                      onMouseLeave={() => setActiveSlice(null)}
                    />
                  ))}
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-xs text-slate-400">Toplam</span>
                  <span className="text-sm font-bold text-white tabular-nums">
                    {categorySummaries.length} Tür
                  </span>
                </div>
              </div>

              {/* Legend List */}
              <div className="flex-1 w-full space-y-1">
                {slices.map((slice) => (
                  <div
                    key={slice.category}
                    onMouseEnter={() => setActiveSlice(slice.index)}
                    onMouseLeave={() => setActiveSlice(null)}
                    className={`flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer ${
                      activeSlice === slice.index ? 'bg-slate-800/80' : 'hover:bg-slate-850'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="text-sm text-slate-200 truncate">
                        {slice.label}
                      </span>
                    </div>
                    <div className="flex items-baseline shrink-0 tabular-nums text-sm">
                      <span className="w-14 text-right font-semibold text-white">%{slice.percent.toFixed(1)}</span>
                      <span className="w-24 text-right text-slate-400">
                        {formatCurrency(baseCurrency === 'TRY' ? slice.valueTRY : slice.valueUSD, baseCurrency, 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="text-sm text-slate-500 pt-3 border-t border-slate-800/80 mt-4 flex items-center justify-between tabular-nums">
          <span>Çeşitlendirme Skoru</span>
          <span className="text-indigo-400 font-semibold">
            {categorySummaries.length >= 4 ? 'Mükemmel Dağılım' : categorySummaries.length >= 2 ? 'Orta Dağılım' : 'Konsantre Portföy'}
          </span>
        </div>
      </div>

      {/* 2. Döviz Riski Dağılımı */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold text-white">Döviz Riski Dağılımı</h3>
            <span className="text-xs text-slate-500">Kur Maruziyeti</span>
          </div>
          <p className="text-sm text-slate-400 mb-6">
            Portföyünüzün TRY, USD, EUR ve GBP para birimlerindeki pozisyon dengesi
          </p>

          {currencySummaries.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Henüz para birimi dağılımı için varlık bulunmuyor.
            </div>
          ) : (
            <div className="space-y-5">
              {currencySummaries.map((curr) => (
                <div key={curr.currency} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ backgroundColor: curr.color }}
                      />
                      <span className="text-slate-200">{curr.label}</span>
                      <span className="text-slate-500 text-xs">{curr.currency}</span>
                    </div>
                    <div className="flex items-baseline tabular-nums">
                      <span className="w-14 text-right font-semibold text-white">%{curr.percentage.toFixed(1)}</span>
                      <span className="w-24 text-right text-slate-400">
                        {formatCurrency(curr.valueTRY, 'TRY', 0)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.min(100, Math.max(2, curr.percentage))}%`,
                        backgroundColor: curr.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-sm text-slate-500 pt-3 border-t border-slate-800/80 mt-4 flex items-center justify-between tabular-nums">
          <span>Yabancı Para Oranı</span>
          <span className="text-amber-400 font-semibold tabular-nums">
            %{
              currencySummaries
                .filter((c) => c.currency !== 'TRY')
                .reduce((acc, c) => acc + c.percentage, 0)
                .toFixed(1)
            }
          </span>
        </div>
      </div>
    </section>
  );
};
