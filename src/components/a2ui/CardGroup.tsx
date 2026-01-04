import { CardGroupComponent, MetricStatus } from '../../types/a2ui';
import { Box, CheckCircle, AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';

interface CardGroupProps {
  component: CardGroupComponent;
  className?: string;
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

export function CardGroup({ component, className }: CardGroupProps) {
  const { props } = component;
  const { title, metrics, status = 'healthy', description } = props;

  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;

  // Determine overall status from metrics if not provided
  const overallStatus = status || metrics.reduce((worst, m) => {
    if (m.status === 'critical') return 'critical';
    if (m.status === 'warning' && worst !== 'critical') return 'warning';
    return worst;
  }, 'healthy' as MetricStatus);

  const finalStatusConfig = STATUS_CONFIG[overallStatus];

  return (
    <div
      className={`
        bg-white/40 backdrop-blur-sm rounded-xl p-4 border border-white/30
        transition-all duration-300 shadow-sm card-hover flex flex-col
        ${className || ''}
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
        <div className={`p-2 rounded-lg ${finalStatusConfig.bgColor}`}>
          <Box className={`w-5 h-5 ${finalStatusConfig.color}`} />
        </div>
        <h3 className="font-semibold text-text-primary flex-1 truncate">{title}</h3>
        <StatusIcon className={`w-4 h-4 ${finalStatusConfig.color}`} />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 flex-1">
        {metrics.map((metric, index) => {
          const metricStatusConfig = metric.status ? STATUS_CONFIG[metric.status] : STATUS_CONFIG.healthy;
          return (
            <div
              key={index}
              className="bg-white/30 rounded-lg p-3 flex flex-col"
            >
              <span className="text-xs text-text-muted uppercase tracking-wide mb-1">
                {metric.label}
              </span>
              <div className="flex items-baseline gap-1">
                <span className={`text-xl font-bold ${metricStatusConfig.color}`}>
                  {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
                </span>
                {metric.unit && (
                  <span className="text-sm text-text-muted">{metric.unit}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Description/Insight */}
      {description && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-sm text-text-secondary">{description}</p>
        </div>
      )}
    </div>
  );
}
