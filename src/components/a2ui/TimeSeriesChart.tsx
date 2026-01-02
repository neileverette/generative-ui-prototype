import { TimeSeriesChartComponent } from '../../types/a2ui';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { TrendingUp, Clock } from 'lucide-react';

interface TimeSeriesChartProps {
  component: TimeSeriesChartComponent;
}

const DEFAULT_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#22c55e', // Green
];

export function TimeSeriesChart({ component }: TimeSeriesChartProps) {
  const { props } = component;
  const { title, series, yAxisLabel, timeRange, status } = props;

  // Transform data for Recharts
  const chartData = series[0]?.data.map((point, idx) => {
    const dataPoint: Record<string, number | string> = {
      time: new Date(point.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }),
      timestamp: point.timestamp,
    };

    series.forEach((s) => {
      dataPoint[s.name] = s.data[idx]?.value ?? 0;
    });

    return dataPoint;
  }) || [];

  const isCritical = status === 'critical';

  return (
    <div 
      className={`
        bg-surface-2 rounded-xl p-5 border
        ${isCritical ? 'border-accent-danger/50' : 'border-surface-3'}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent-primary" />
          <h3 className="font-semibold text-text-primary">{title}</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Clock className="w-3 h-3" />
          <span>{timeRange}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <defs>
              {series.map((s, idx) => (
                <linearGradient key={s.name} id={`gradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                  <stop 
                    offset="5%" 
                    stopColor={s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]} 
                    stopOpacity={0.3}
                  />
                  <stop 
                    offset="95%" 
                    stopColor={s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]} 
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#2a2a38" 
              vertical={false}
            />
            <XAxis 
              dataKey="time" 
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              label={yAxisLabel ? { 
                value: yAxisLabel, 
                angle: -90, 
                position: 'insideLeft',
                style: { fontSize: 10, fill: '#64748b' }
              } : undefined}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1a24',
                border: '1px solid #2a2a38',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color: '#f1f5f9' }}
            />
            {series.map((s, idx) => (
              <Area
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                strokeWidth={2}
                fill={`url(#gradient-${idx})`}
                dot={false}
                activeDot={{ r: 4, fill: s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length] }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      {series.length > 1 && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-surface-3">
          {series.map((s, idx) => (
            <div key={s.name} className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length] }}
              />
              <span className="text-xs text-text-secondary">{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
