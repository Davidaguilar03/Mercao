import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HorizonComparison } from '../../api/types';
import { formatPercent } from '../../lib/format';

interface ErrorByHorizonChartProps {
  byHorizon: HorizonComparison[];
  modelLabel: string;
}

// The model wears the brand green; the naive forecast is the reference, in neutral gray.
const MODEL_COLOR = '#1f6b4a';
const NAIVE_COLOR = '#8a8f80';
const INK = '#1e2b24';
const MUTED = '#55635b';
const GRID = '#e3dccb';

const formatLabel = (value: unknown) => (typeof value === 'number' ? formatPercent(value) : '');

/** Average error (MAPE) of the model and of the naive forecast for each horizon. */
export default function ErrorByHorizonChart({ byHorizon, modelLabel }: ErrorByHorizonChartProps) {
  const data = byHorizon.map((row) => ({
    horizon: row.horizon === 1 ? '1 semana' : `${row.horizon} semanas`,
    model: row.model.mape_pct,
    naive: row.naive.mape_pct,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 16, right: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis
          dataKey="horizon"
          tickLine={false}
          axisLine={{ stroke: GRID }}
          tick={{ fill: MUTED, fontSize: 12 }}
        />
        <YAxis
          width={48}
          tickLine={false}
          axisLine={false}
          tick={{ fill: MUTED, fontSize: 12 }}
          tickFormatter={(value: number) => `${value} %`}
        />
        <Tooltip
          cursor={{ fill: 'rgb(30 43 36 / 6%)' }}
          formatter={(value) => formatLabel(value)}
          contentStyle={{ borderRadius: 10, borderColor: GRID, color: INK }}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend
          iconType="square"
          formatter={(value) => <span style={{ color: INK, fontSize: 14 }}>{value}</span>}
        />
        <Bar
          dataKey="model"
          name={modelLabel}
          fill={MODEL_COLOR}
          radius={[4, 4, 0, 0]}
          maxBarSize={36}
          isAnimationActive={false}
        >
          <LabelList position="top" formatter={formatLabel} fill={INK} fontSize={11} />
        </Bar>
        <Bar
          dataKey="naive"
          name="Pronóstico ingenuo"
          fill={NAIVE_COLOR}
          radius={[4, 4, 0, 0]}
          maxBarSize={36}
          isAnimationActive={false}
        >
          <LabelList position="top" formatter={formatLabel} fill={INK} fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
