import { ProgressBarComponent, MetricStatus } from '../../types/a2ui';

interface ProgressBarProps {
  component: ProgressBarComponent;
}

const STATUS_COLORS: Record<MetricStatus, string> = {
  healthy: 'bg-accent-success',
  warning: 'bg-accent-warning',
  critical: 'bg-accent-danger',
  unknown: 'bg-text-muted',
};

export function ProgressBar({ component }: ProgressBarProps) {
  const { props } = component;
  const { title, value, max = 100, label, status = 'healthy' } = props;

  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const barColor = STATUS_COLORS[status];

  return (
    <div className="bg-surface-2 rounded-xl p-5 border border-surface-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="widget-title">{title}</h3>
        <span className="text-lg font-bold text-text-primary">
          {value.toFixed(1)}{label ? ` ${label}` : '%'}
        </span>
      </div>
      
      {/* Progress bar */}
      <div className="h-2 bg-surface-4 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Scale markers */}
      <div className="flex justify-between mt-2 text-xs text-text-muted">
        <span>0</span>
        <span>{max / 2}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
