import { AlertListComponent } from '../../types/a2ui';
import { AlertCircle, AlertTriangle, Info, Bell } from 'lucide-react';

interface AlertListProps {
  component: AlertListComponent;
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    bgColor: 'bg-accent-danger/10',
    borderColor: 'border-accent-danger/30',
    textColor: 'text-accent-danger',
    badgeColor: 'bg-accent-danger',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-accent-warning/10',
    borderColor: 'border-accent-warning/30',
    textColor: 'text-accent-warning',
    badgeColor: 'bg-accent-warning',
  },
  info: {
    icon: Info,
    bgColor: 'bg-accent-info/10',
    borderColor: 'border-accent-info/30',
    textColor: 'text-accent-info',
    badgeColor: 'bg-accent-info',
  },
};

export function AlertList({ component }: AlertListProps) {
  const { props } = component;
  const { title, alerts } = props;

  const sortedAlerts = [...alerts].sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  return (
    <div className="bg-surface-2 rounded-xl border border-surface-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-surface-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-accent-primary" />
          <h3 className="widget-title">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-accent-danger/20 text-accent-danger rounded-full">
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-accent-warning/20 text-accent-warning rounded-full">
              {warningCount} warning
            </span>
          )}
        </div>
      </div>

      {/* Alert List */}
      <div className="divide-y divide-surface-3 max-h-96 overflow-y-auto">
        {sortedAlerts.map((alert) => {
          const config = SEVERITY_CONFIG[alert.severity];
          const Icon = config.icon;

          return (
            <div
              key={alert.id}
              className={`p-4 ${config.bgColor} border-l-2 ${config.borderColor}`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
                  <Icon className={`w-4 h-4 ${config.textColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium text-text-primary truncate">
                      {alert.title}
                    </h4>
                    <span className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase ${config.badgeColor} text-white rounded`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary mb-2">
                    {alert.message}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span>{new Date(alert.timestamp).toLocaleString()}</span>
                    {alert.source && (
                      <span className="font-mono">{alert.source}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {alerts.length === 0 && (
        <div className="p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-accent-success/10 flex items-center justify-center mx-auto mb-3">
            <Bell className="w-6 h-6 text-accent-success" />
          </div>
          <p className="text-text-secondary">No active alerts</p>
        </div>
      )}
    </div>
  );
}
