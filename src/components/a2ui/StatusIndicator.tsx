import { StatusIndicatorComponent, MetricStatus } from '../../types/a2ui';
import { CheckCircle, AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';

interface StatusIndicatorProps {
  component: StatusIndicatorComponent;
}

const STATUS_CONFIG: Record<MetricStatus, {
  icon: typeof CheckCircle;
  color: string;
  bgColor: string;
  label: string;
}> = {
  healthy: {
    icon: CheckCircle,
    color: 'text-accent-success',
    bgColor: 'bg-accent-success/10',
    label: 'Healthy',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-accent-warning',
    bgColor: 'bg-accent-warning/10',
    label: 'Warning',
  },
  critical: {
    icon: AlertCircle,
    color: 'text-accent-danger',
    bgColor: 'bg-accent-danger/10',
    label: 'Critical',
  },
  unknown: {
    icon: HelpCircle,
    color: 'text-text-muted',
    bgColor: 'bg-surface-3',
    label: 'Unknown',
  },
};

export function StatusIndicator({ component }: StatusIndicatorProps) {
  const { props } = component;
  const { title, status, message } = props;

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className={`
      bg-surface-2 rounded-xl p-5 border border-surface-3
      ${status === 'critical' ? 'animate-pulse-critical' : ''}
    `}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${config.bgColor}`}>
          <Icon className={`w-5 h-5 ${config.color}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-text-primary">{title}</h3>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${config.bgColor} ${config.color}`}>
              {config.label}
            </span>
          </div>
          <p className="text-sm text-text-secondary mt-1">{message}</p>
        </div>
      </div>
    </div>
  );
}
