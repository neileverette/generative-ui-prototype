import { MetricCardComponent, MetricStatus } from '../../types/a2ui';
import { TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';

interface MetricCardProps {
  component: MetricCardComponent;
}

const STATUS_CONFIG: Record<MetricStatus, { color: string; bgColor: string; icon: typeof CheckCircle }> = {
  healthy: { 
    color: 'text-accent-success', 
    bgColor: 'bg-accent-success/10',
    icon: CheckCircle 
  },
  warning: { 
    color: 'text-accent-warning', 
    bgColor: 'bg-accent-warning/10',
    icon: AlertTriangle 
  },
  critical: { 
    color: 'text-accent-danger', 
    bgColor: 'bg-accent-danger/10',
    icon: AlertCircle 
  },
  unknown: { 
    color: 'text-text-muted', 
    bgColor: 'bg-surface-3',
    icon: HelpCircle 
  },
};

export function MetricCard({ component }: MetricCardProps) {
  const { props, priority } = component;
  const { title, value, unit, change, status, description } = props;

  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;

  const isCritical = status === 'critical';

  return (
    <div 
      className={`
        bg-surface-2 rounded-xl p-5 border transition-all duration-300
        ${isCritical ? 'border-accent-danger/50 animate-pulse-critical' : 'border-surface-3'}
        card-hover
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${statusConfig.bgColor}`}>
            <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
          </div>
          <span className="text-sm font-medium text-text-secondary">{title}</span>
        </div>
        {priority === 'critical' && (
          <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-accent-danger/20 text-accent-danger rounded-full">
            Critical
          </span>
        )}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-3xl font-bold text-text-primary">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && (
          <span className="text-lg text-text-muted">{unit}</span>
        )}
      </div>

      {/* Change indicator */}
      {change && (
        <div className="flex items-center gap-2">
          {change.direction === 'up' && (
            <TrendingUp className={`w-4 h-4 ${change.value > 0 ? 'text-accent-danger' : 'text-accent-success'}`} />
          )}
          {change.direction === 'down' && (
            <TrendingDown className={`w-4 h-4 ${change.value < 0 ? 'text-accent-success' : 'text-accent-danger'}`} />
          )}
          {change.direction === 'flat' && (
            <Minus className="w-4 h-4 text-text-muted" />
          )}
          <span className={`text-sm ${
            change.direction === 'up' ? 'text-accent-danger' :
            change.direction === 'down' ? 'text-accent-success' :
            'text-text-muted'
          }`}>
            {Math.abs(change.value)}%
          </span>
          <span className="text-xs text-text-muted">{change.period}</span>
        </div>
      )}

      {/* Description */}
      {description && (
        <p className="mt-3 text-xs text-text-muted">{description}</p>
      )}
    </div>
  );
}
