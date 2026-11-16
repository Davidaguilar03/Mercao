import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, TOOLTIP_STYLE } from '../../lib/chartTheme';
import { formatMonthYear, formatPesos, formatPricePerKg, formatWeek } from '../../lib/format';
import { buildTimeTicks, type ChartPoint, type HistoryRange } from './priceSeries';

interface PriceHistoryChartProps {
  points: ChartPoint[];
  range: HistoryRange;
}

interface PriceTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: ChartPoint }>;
}

function PriceTooltip({ active, payload }: PriceTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <strong>Semana del {formatWeek(point.weekStart)}</strong>
      {point.mean !== undefined && <div>Precio promedio: {formatPricePerKg(point.mean)}</div>}
      {point.band && (
        <div style={{ color: CHART_COLORS.muted }}>
          Entre {formatPesos(point.band[0])} y {formatPesos(point.band[1])}
        </div>
      )}
      {point.isForecast && point.forecast !== undefined && (
        <>
          <div>Pronóstico: {formatPricePerKg(point.forecast)}</div>
          {point.forecastBand && (
            <div style={{ color: CHART_COLORS.muted }}>
              Rango probable: {formatPesos(point.forecastBand[0])} a{' '}
              {formatPesos(point.forecastBand[1])}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Weekly price with its min-max band, followed by the forecast (dashed) with its 80 % interval. */
export default function PriceHistoryChart({ points, range }: PriceHistoryChartProps) {
  const min = points[0]?.t ?? 0;
  const max = points[points.length - 1]?.t ?? 0;
  const ticks = buildTimeTicks(min, max, range);
  const formatTick = (value: number) =>
    range === 'all' ? String(new Date(value).getUTCFullYear()) : formatMonthYear(value);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={[min, max]}
          ticks={ticks}
          tickFormatter={formatTick}
          tickLine={false}
          axisLine={{ stroke: CHART_COLORS.grid }}
          tick={{ fill: CHART_COLORS.muted, fontSize: 12 }}
        />
        <YAxis
          width={62}
          tickLine={false}
          axisLine={false}
          tick={{ fill: CHART_COLORS.muted, fontSize: 12 }}
          tickFormatter={(value: number) => formatPesos(value)}
        />
        <Tooltip content={<PriceTooltip />} />
        <Area
          dataKey="band"
          stroke="none"
          fill={CHART_COLORS.primary}
          fillOpacity={0.16}
          isAnimationActive={false}
          activeDot={false}
        />
        <Area
          dataKey="forecastBand"
          stroke="none"
          fill={CHART_COLORS.terracotta}
          fillOpacity={0.18}
          isAnimationActive={false}
          activeDot={false}
        />
        <Line
          dataKey="mean"
          stroke={CHART_COLORS.primary}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          dataKey="forecast"
          stroke={CHART_COLORS.terracotta}
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={{ r: 3, fill: CHART_COLORS.terracotta, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
