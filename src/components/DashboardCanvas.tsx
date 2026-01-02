import { DashboardState, A2UIComponent } from '../types/a2ui';
import { MetricCard } from './a2ui/MetricCard';
import { TimeSeriesChart } from './a2ui/TimeSeriesChart';
import { DataTable } from './a2ui/DataTable';
import { AlertList } from './a2ui/AlertList';
import { StatusIndicator } from './a2ui/StatusIndicator';
import { ProgressBar } from './a2ui/ProgressBar';
import { LayoutGrid, Sparkles } from 'lucide-react';

interface DashboardCanvasProps {
  state: DashboardState;
}

// Component registry - maps A2UI component types to React components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COMPONENT_REGISTRY: Record<string, React.ComponentType<any>> = {
  metric_card: MetricCard,
  time_series_chart: TimeSeriesChart,
  data_table: DataTable,
  alert_list: AlertList,
  status_indicator: StatusIndicator,
  progress_bar: ProgressBar,
};

function renderComponent(component: A2UIComponent, index: number) {
  const Component = COMPONENT_REGISTRY[component.component];
  
  if (!Component) {
    console.warn(`Unknown component type: ${component.component}`);
    return null;
  }

  return (
    <div
      key={component.id || index}
      className="animate-slide-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <Component component={component} />
    </div>
  );
}

export function DashboardCanvas({ state }: DashboardCanvasProps) {
  const { components, lastUpdated, agentMessage } = state;

  if (components.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-2xl bg-surface-2 flex items-center justify-center mb-6">
          <LayoutGrid className="w-10 h-10 text-text-muted" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          No components yet
        </h2>
        <p className="text-text-secondary max-w-md mb-6">
          Start a conversation with the agent to fetch metrics and build your dashboard dynamically.
        </p>
        <div className="flex items-center gap-2 px-4 py-2 bg-surface-2 rounded-full">
          <Sparkles className="w-4 h-4 text-accent-primary" />
          <span className="text-sm text-text-secondary">
            Try: "Show me a system overview"
          </span>
        </div>
      </div>
    );
  }

  // Group components by size for layout
  // metric_card and status_indicator are small (fit in grid)
  // time_series_chart, data_table, alert_list are large (full width or half)
  const smallComponents = components.filter(c => 
    ['metric_card', 'status_indicator', 'progress_bar'].includes(c.component)
  );
  const largeComponents = components.filter(c => 
    ['time_series_chart', 'data_table', 'alert_list'].includes(c.component)
  );

  return (
    <div className="space-y-6">
      {/* Agent message */}
      {agentMessage && (
        <div className="p-4 bg-surface-2 rounded-xl border border-surface-3">
          <p className="text-sm text-text-secondary">{agentMessage}</p>
        </div>
      )}

      {/* Small components grid */}
      {smallComponents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {smallComponents.map((component, index) => renderComponent(component, index))}
        </div>
      )}

      {/* Large components */}
      {largeComponents.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {largeComponents.map((component, index) => 
            renderComponent(component, smallComponents.length + index)
          )}
        </div>
      )}

      {/* Footer with last update time */}
      <div className="text-xs text-text-muted text-right pt-4 border-t border-surface-3">
        Last updated: {new Date(lastUpdated).toLocaleTimeString()}
      </div>
    </div>
  );
}
