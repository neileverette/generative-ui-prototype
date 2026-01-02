import { DashboardState, A2UIComponent } from '../types/a2ui';
import { MetricCard } from './a2ui/MetricCard';
import { DataTable } from './a2ui/DataTable';
import { AlertList } from './a2ui/AlertList';
import { StatusIndicator } from './a2ui/StatusIndicator';
import { ProgressBar } from './a2ui/ProgressBar';
import { Server, Container, Clock, LayoutGrid } from 'lucide-react';

interface ShortcutAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface DashboardCanvasProps {
  state: DashboardState;
  shortcuts?: ShortcutAction[];
}

// Component registry - maps A2UI component types to React components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COMPONENT_REGISTRY: Record<string, React.ComponentType<any>> = {
  metric_card: MetricCard,
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

export function DashboardCanvas({ state, shortcuts }: DashboardCanvasProps) {
  const { components, lastUpdated, agentMessage } = state;

  if (components.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-2xl bg-surface-2 flex items-center justify-center mb-6">
          <LayoutGrid className="w-10 h-10 text-text-muted" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          Welcome to your Dashboard
        </h2>
        <p className="text-text-secondary max-w-md mb-8">
          Get started by selecting one of the options below, or ask the assistant for help.
        </p>

        {/* Shortcut Cards */}
        {shortcuts && shortcuts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full">
            {shortcuts.map((shortcut) => (
              <button
                key={shortcut.id}
                onClick={shortcut.onClick}
                className="group p-6 bg-surface-2 hover:bg-surface-3 border border-surface-3 hover:border-accent-primary/50 rounded-xl transition-all duration-200 text-left"
              >
                <div className="w-12 h-12 rounded-lg bg-surface-3 group-hover:bg-accent-primary/20 flex items-center justify-center mb-4 transition-colors">
                  <span className="text-text-muted group-hover:text-accent-primary transition-colors">
                    {shortcut.icon}
                  </span>
                </div>
                <h3 className="font-semibold text-text-primary mb-1">
                  {shortcut.title}
                </h3>
                <p className="text-sm text-text-secondary">
                  {shortcut.description}
                </p>
              </button>
            ))}
          </div>
        )}
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
    ['data_table', 'alert_list'].includes(c.component)
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
