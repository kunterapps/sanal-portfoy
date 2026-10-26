import React, { useEffect, useState } from 'react';
import { TimeRange, Currency } from '../types/portfolio';
import { formatCurrency, formatPercent } from '../utils/portfolioCalculations';
import { TrendPoint } from '../utils/snapshots';

// Draws in real pixels at the container's width, so the chart fills it and
// labels keep their size instead of scaling with a fixed viewBox
const useElementWidth = () => {
  // A callback ref, since the canvas mounts only once there is enough data
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return [setEl, width] as const;
};

/** About `count` round tick values covering min..max. */
function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((m) => m >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(v);
  return ticks;
}

/** Short axis label: 1.250.000 → 1,25 Mn, 48.000 → 48 B */
function compactAmount(value: number, currency: Currency): string {
  const sym = currency === 'TRY' ? '₺' : '$';
  const abs = Math.abs(value);
  const fmt = (n: number, d: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: d });
  if (abs >= 1e6) return `${sym}${fmt(value / 1e6, 2)} Mn`;
  if (abs >= 1e3) return `${sym}${fmt(value / 1e3, 1)} B`;
  return `${sym}${fmt(value, 0)}`;
}

interface PortfolioTrendChartProps {
  data: TrendPoint[];
  selectedRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  baseCurrency: Currency;
  hasAssets: boolean;
}

export const PortfolioTrendChart: React.FC<PortfolioTrendChartProps> = ({
  data,
  selectedRange,
  onRangeChange,
  baseCurrency,
  hasAssets,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [canvasRef, measuredWidth] = useElementWidth();

  const ranges: { key: TimeRange; label: string }[] = [
    { key: '1W', label: '1H' },
    { key: '1M', label: '1A' },
    { key: '3M', label: '3A' },
    { key: '6M', label: '6A' },
    { key: '1Y', label: '1Y' },
    { key: 'ALL', label: 'TÜMÜ' },
  ];

  const rangeButtons = (
    <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
      {ranges.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onRangeChange(r.key)}
          className={`h-7 px-3 text-xs font-semibold rounded-lg transition-colors ${
            selectedRange === r.key
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  if (hasAssets && data.length < 2) {
    return (
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-base font-semibold text-white">Zaman İçinde Değer Değişimi</h2>
          {rangeButtons}
        </div>
        <div className="text-center py-10">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-3">
            📈
          </div>
          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Grafik, portföyünüzün her gün otomatik kaydedilen gerçek değeriyle oluşur. Bu aralıkta henüz önceki
            günlere ait kayıt yok; uygulamayı farklı günlerde açtıkça eğri burada belirecek.
          </p>
        </div>
      </div>
    );
  }

  if (!hasAssets || data.length === 0) {
    return (
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 sm:p-6 text-center py-14">
        <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-3">
          📈
        </div>
        <h3 className="text-sm font-bold text-white mb-1">Zaman İçinde Değer Gelişim Grafiği</h3>
        <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
          Portföyünüze varlık eklediğinizde, portföyünüzün zaman içindeki gelişim eğrisi, kümülatif kâr/zararı ve maliyet çizgisi burada görüntülenecektir.
        </p>
      </div>
    );
  }

  // Coordinates and scale (pixels)
  const width = Math.max(measuredWidth, 280);
  const isNarrow = width < 480;
  const height = isNarrow ? 220 : 260;
  const paddingLeft = isNarrow ? 52 : 64;
  const paddingRight = 12;
  const paddingTop = 12;
  const paddingBottom = 28;

  const values = data.map((d) => (baseCurrency === 'TRY' ? d.valueTRY : d.valueUSD));
  const costs = data.map((d) => (baseCurrency === 'TRY' ? d.costTRY : d.costUSD));

  const allNumbers = [...values, ...costs];
  const dataMin = Math.min(...allNumbers);
  const dataMax = Math.max(...allNumbers);
  const pad = (dataMax - dataMin) * 0.08 || dataMax * 0.02 || 1;
  const yTicks = niceTicks(dataMin - pad, dataMax + pad, 4);
  const minVal = Math.min(yTicks[0], dataMin - pad);
  const maxVal = Math.max(yTicks[yTicks.length - 1], dataMax + pad);
  const rangeVal = maxVal - minVal || 1;

  const getX = (index: number) => {
    return paddingLeft + (index / (data.length - 1)) * (width - paddingLeft - paddingRight);
  };

  const getY = (val: number) => {
    return height - paddingBottom - ((val - minVal) / rangeVal) * (height - paddingTop - paddingBottom);
  };

  // Generate smooth cubic bezier SVG path
  const points = data.map((d, i) => ({
    x: getX(i),
    y: getY(baseCurrency === 'TRY' ? d.valueTRY : d.valueUSD),
  }));

  const costPoints = data.map((d, i) => ({
    x: getX(i),
    y: getY(baseCurrency === 'TRY' ? d.costTRY : d.costUSD),
  }));

  const buildPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  };

  const linePath = buildPath(points);
  const costPath = buildPath(costPoints);

  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`
    : '';

  const activePoint = hoverIndex !== null ? data[hoverIndex] : data[data.length - 1];
  const activeVal = baseCurrency === 'TRY' ? activePoint.valueTRY : activePoint.valueUSD;
  const activeCost = baseCurrency === 'TRY' ? activePoint.costTRY : activePoint.costUSD;
  const activeProfit = activeVal - activeCost;
  const activeProfitPercent = activeCost > 0 ? (activeProfit / activeCost) * 100 : 0;

  // Pointer events cover mouse hover as well as tapping/dragging on touch screens
  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    let closestIdx = 0;
    let minDist = Infinity;
    data.forEach((_, i) => {
      const dist = Math.abs(getX(i) - relX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    });
    setHoverIndex(closestIdx);
  };

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 sm:p-6 relative">
      {/* Header and Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">Zaman İçinde Değer Değişimi</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 tabular-nums whitespace-nowrap">
              {baseCurrency} Bazında
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            Her gün kaydedilen portföy değeri ve yatırım maliyeti
          </p>
        </div>

        {rangeButtons}
      </div>

      {/* Active Hover / Current Stats Callout */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mb-2 text-sm tabular-nums">
        <div>
          <span className="text-slate-500 mr-1.5">Tarih:</span>
          <span className="text-slate-300 font-semibold">{activePoint.date}</span>
        </div>
        <div>
          <span className="text-slate-500 mr-1.5">Piyasa Değeri:</span>
          <span className="text-white font-bold">{formatCurrency(activeVal, baseCurrency, 0)}</span>
        </div>
        <div className="hidden sm:inline-block">
          <span className="text-slate-500 mr-1.5">Maliyet:</span>
          <span className="text-slate-400">{formatCurrency(activeCost, baseCurrency, 0)}</span>
        </div>
        <div>
          <span className="text-slate-500 mr-1.5">Getiri:</span>
          <span className={`font-semibold ${activeProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {activeProfit >= 0 ? '+' : ''}{formatCurrency(activeProfit, baseCurrency, 0)} ({formatPercent(activeProfitPercent)})
          </span>
        </div>
      </div>

      {/* SVG Interactive Canvas */}
      <div ref={canvasRef} className="relative w-full overflow-hidden">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block cursor-crosshair select-none touch-pan-y"
          onMouseLeave={() => setHoverIndex(null)}
          onPointerDown={handlePointer}
          onPointerMove={handlePointer}
        >
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal grid with value labels */}
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={paddingLeft} y1={getY(tick)} x2={width - paddingRight} y2={getY(tick)} stroke="#1e293b" />
              <text
                x={paddingLeft - 8}
                y={getY(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fill="#64748b"
                fontSize="11"
                fontFamily="Inter, system-ui, sans-serif"
              >
                {compactAmount(tick, baseCurrency)}
              </text>
            </g>
          ))}

          {/* Area Fill */}
          <path d={areaPath} fill="url(#trendGradient)" />

          {/* Cost Line (Dashed) */}
          <path
            d={costPath}
            fill="none"
            stroke="#64748b"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.75"
          />

          {/* Value Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#6366f1"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Interactive Crosshair & Scrubbing Point */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={paddingTop}
                x2={getX(hoverIndex)}
                y2={height - paddingBottom}
                stroke="#818cf8"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(baseCurrency === 'TRY' ? data[hoverIndex].valueTRY : data[hoverIndex].valueUSD)}
                r="5"
                fill="#6366f1"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}

          {/* X Axis Labels */}
          {data.map((d, i) => {
            const step = Math.ceil(data.length / Math.max(3, Math.floor(width / 110)));
            const last = data.length - 1;
            // Skip a regular label that would collide with the final "today" label
            if (i === last || (i % step === 0 && last - i >= step / 2)) {
              return (
                <text
                  key={i}
                  x={getX(i)}
                  y={height - 8}
                  textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
                  fill={i === data.length - 1 ? '#818cf8' : '#64748b'}
                  fontWeight={i === data.length - 1 ? '600' : '400'}
                  fontSize="11"
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {d.date}
                </text>
              );
            }
            return null;
          })}
        </svg>
      </div>

      {/* Legend Footer */}
      <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-indigo-500 rounded-full inline-block" />
            <span>Portföy Değeri</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-slate-500 border-dashed border-t border-slate-500 inline-block" />
            <span>Yatırım Maliyeti</span>
          </div>
        </div>
        <div className="hidden sm:block text-slate-500 tabular-nums">
          Grafik üzerinde imleç ile gezinebilirsiniz
        </div>
      </div>
    </div>
  );
};
