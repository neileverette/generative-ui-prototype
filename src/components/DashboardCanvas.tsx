import { DashboardState, A2UIComponent } from '../types/a2ui';
import { MetricCard } from './a2ui/MetricCard';
import { DataTable } from './a2ui/DataTable';
import { AlertList } from './a2ui/AlertList';
import { StatusIndicator } from './a2ui/StatusIndicator';
import { ProgressBar } from './a2ui/ProgressBar';

// IBM Dashboard pictogram
const DashboardIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 32 32"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M31,31.36H1c-0.199,0-0.36-0.161-0.36-0.36V1c0-0.199,0.161-0.36,0.36-0.36h30
      c0.199,0,0.36,0.161,0.36,0.36v30C31.36,31.199,31.199,31.36,31,31.36z M1.36,30.64h29.28V12.36H1.36V30.64z M13.36,11.64h17.28
      V1.36H13.36V11.64z M1.36,11.64h11.28V1.36H1.36V11.64z M9,27.36c-2.956,0-5.36-2.405-5.36-5.36h0.72c0,2.559,2.082,4.64,4.64,4.64
      s4.64-2.081,4.64-4.64S11.559,17.36,9,17.36v-0.72c2.956,0,5.36,2.405,5.36,5.36S11.956,27.36,9,27.36z M27.36,27h-0.72V16h0.721
      L27.36,27L27.36,27z M23.36,27h-0.72v-8h0.721L23.36,27L23.36,27z M19.36,27h-0.72v-3h0.721L19.36,27L19.36,27z" />
  </svg>
);

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
        <div className="w-20 h-20 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/40 flex items-center justify-center mb-6">
          <DashboardIcon className="w-10 h-10 text-text-muted" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          Welcome to your Dashboard
        </h2>
        <p className="text-text-secondary max-w-md mb-8">
          Get started by selecting one of the options below, or ask the assistant for help.
        </p>

        {/* Shortcut Cards */}
        {shortcuts && shortcuts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl w-full">
            {shortcuts.map((shortcut) => (
              <button
                key={shortcut.id}
                onClick={shortcut.onClick}
                className="group p-6 bg-white/70 hover:bg-white/90 backdrop-blur-sm border border-white/50 hover:border-accent-primary/50 rounded-xl transition-all duration-200 text-left shadow-sm hover:shadow-md"
              >
                <div className="w-12 h-12 rounded-lg bg-white/60 group-hover:bg-accent-primary/20 flex items-center justify-center mb-4 transition-colors">
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
        <div className="p-4 bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 shadow-sm">
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
      <div className="text-xs text-text-muted text-right pt-4 border-t border-white/30">
        Last updated: {new Date(lastUpdated).toLocaleTimeString()}
      </div>
    </div>
  );
}
