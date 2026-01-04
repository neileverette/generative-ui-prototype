import { MetricCardComponent, MetricStatus } from '../../types/a2ui';
import { TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';

interface MetricCardProps {
  component: MetricCardComponent;
  className?: string;
}

// Skeleton shimmer component for loading state
function SkeletonLoader() {
  return (
    <div className="animate-pulse pt-3 border-t border-gray-100">
      <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-4/5 mb-3"></div>
      <div className="h-2 bg-gray-100 rounded w-16 mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
    </div>
  );
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

// Size configuration for the value display
const SIZE_CONFIG = {
  default: { value: 'text-3xl', unit: 'text-lg' },
  large: { value: 'text-5xl', unit: 'text-xl' },
  xl: { value: 'text-7xl', unit: 'text-2xl' },
};

export function MetricCard({ component, className }: MetricCardProps) {
  const { props, priority } = component;
  const { title, value, unit, change, status, description, interpretation, actionableInsights, insightsLoading, size = 'default', metadata } = props;

  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;
  const sizeConfig = SIZE_CONFIG[size];

  const isCritical = status === 'critical';

  return (
    <div
      className={`
        bg-white/70 backdrop-blur-sm rounded-xl p-5 border transition-all duration-300 shadow-sm
        ${isCritical ? 'border-accent-danger/50 animate-pulse-critical' : 'border-white/50'}
        card-hover flex flex-col ${className || ''}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-lg ${statusConfig.bgColor} flex-shrink-0`}>
            <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
          </div>
          <span className="text-sm font-medium text-text-secondary truncate">{title}</span>
        </div>
        {priority === 'critical' && (
          <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-accent-danger/20 text-accent-danger rounded-full flex-shrink-0">
            Critical
          </span>
        )}
      </div>

      {/* Value */}
      <div className={`flex items-baseline gap-1.5 ${size === 'xl' ? 'mb-4 flex-1' : 'mb-2'}`}>
        <span className={`${sizeConfig.value} font-bold text-text-primary`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && (
          <span className={`${sizeConfig.unit} text-text-muted`}>{unit}</span>
        )}
      </div>

      {/* Change indicator */}
      {change && (
        <div className="flex items-center gap-2 mb-3">
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

      {/* Content area */}
      <div className="mt-2">
        {/* Show skeleton while loading insights */}
        {insightsLoading && !interpretation && <SkeletonLoader />}

        {/* Interpretation */}
        {interpretation && (
          <div className="pt-3 border-t border-gray-100">
            <p className="text-sm text-text-secondary leading-relaxed">{interpretation}</p>
          </div>
        )}

        {/* Actionable Insight */}
        {actionableInsights && actionableInsights.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <h4 className="text-sm font-bold text-text-primary mb-1">
              Actionable
            </h4>
            {actionableInsights.map((insight, index) => (
              <p key={index} className="text-sm text-text-secondary">
                {insight}
              </p>
            ))}
          </div>
        )}

        {/* Description - always show for xl size, otherwise only as fallback */}
        {description && (size === 'xl' || (!insightsLoading && !interpretation && !actionableInsights)) && (
          <div className={size === 'xl' ? 'mt-auto pt-3 border-t border-gray-100' : 'pt-3'}>
            <p className={`${size === 'xl' ? 'text-sm text-text-secondary' : 'text-xs text-text-muted'} line-clamp-2`}>{description}</p>
          </div>
        )}
      </div>

      {/* Footer metadata - total executions, etc */}
      {metadata && (
        <div className="mt-auto pt-3 border-t border-gray-100">
          <p className="text-xs text-text-muted">
            {metadata}
          </p>
        </div>
      )}
    </div>
  );
}
