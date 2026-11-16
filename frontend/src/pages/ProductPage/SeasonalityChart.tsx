import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Seasonality } from '../../api/types';
import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen';
import { CHART_COLORS, LEVEL_COLORS, TOOLTIP_STYLE } from '../../lib/chartTheme';
import { formatChange } from '../../lib/format';

interface SeasonalityChartProps {
  seasonality: Seasonality;
}

interface MonthBar {
  short: string;
  name: string;
  index: number;
  /** Distance to the annual average (100), which is the baseline of the bars. */
  deviation: number;
  highlight: 'cheapest' | 'expensive' | null;
}

interface MonthTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: MonthBar }>;
}

function MonthTooltip({ active, payload }: MonthTooltipProps) {
  const month = payload?.[0]?.payload;
  if (!active || !month) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <strong style={{ textTransform: 'capitalize' }}>{month.name}</strong>
      <div>
        {month.deviation === 0
          ? 'Igual al promedio del año'
          : `${formatChange(month.deviation)} frente al promedio del año`}
      </div>
      <div style={{ color: CHART_COLORS.muted }}>Índice: {Math.round(month.index)}</div>
    </div>
  );
}

// The same level colors as the map: corn yellow for the cheapest month, ink for the most expensive.
const BAR_COLORS = {
  cheapest: LEVEL_COLORS.cheaper,
  expensive: LEVEL_COLORS.expensive,
  normal: '#c9c6b8',
};

/** Monthly price index. Bars grow up or down from 100, the average of the year. */
export default function SeasonalityChart({ seasonality }: SeasonalityChartProps) {
  // Twelve three-letter labels do not fit on a phone; initials do.
  const isNarrow = useIsNarrowScreen();
  const data: MonthBar[] = seasonality.months.map((month) => ({
    short: isNarrow ? month.month_name.charAt(0).toUpperCase() : month.month_name.slice(0, 3),
    name: month.month_name,
    index: month.index,
    deviation: Math.round((month.index - 100) * 10) / 10,
    highlight:
      month.month_name === seasonality.cheapest_month
        ? 'cheapest'
        : month.month_name === seasonality.most_expensive_month
          ? 'expensive'
          : null,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 16, right: 4, left: 0, bottom: 0 }} barCategoryGap="18%">
        <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
        <XAxis
          dataKey="short"
          interval={0}
          tickLine={false}
          axisLine={false}
          tick={{ fill: CHART_COLORS.muted, fontSize: 11 }}
        />
        <YAxis
          width={36}
          tickLine={false}
          axisLine={false}
          tick={{ fill: CHART_COLORS.muted, fontSize: 12 }}
          tickFormatter={(value: number) => String(value + 100)}
        />
        <Tooltip cursor={{ fill: 'rgb(30 43 36 / 6%)' }} content={<MonthTooltip />} />
        <ReferenceLine y={0} stroke={CHART_COLORS.ink} />
        <Bar dataKey="deviation" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
          {data.map((month) => (
            <Cell key={month.name} fill={BAR_COLORS[month.highlight ?? 'normal']} />
          ))}
          {/* Only the cheapest and the most expensive months carry their value. */}
          <LabelList
            dataKey="index"
            position="top"
            fill={CHART_COLORS.ink}
            fontSize={11}
            formatter={(value: unknown) => {
              const month = data.find((item) => item.index === value);
              return month?.highlight ? Math.round(month.index) : '';
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
