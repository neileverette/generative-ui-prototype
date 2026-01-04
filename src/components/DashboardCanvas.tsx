import { DashboardState, A2UIComponent } from '../types/a2ui';
import { MetricCard } from './a2ui/MetricCard';
import { CardGroup } from './a2ui/CardGroup';
import { DataTable } from './a2ui/DataTable';
import { AlertList } from './a2ui/AlertList';
import { StatusIndicator } from './a2ui/StatusIndicator';
import { ProgressBar } from './a2ui/ProgressBar';

// IBM Venn Diagram icon with optional gradient
const VennDiagramIcon = ({ className, gradient = false }: { className?: string; gradient?: boolean }) => (
  <svg
    className={className}
    viewBox="0 0 32 32"
    fill={gradient ? "url(#venn-gradient)" : "currentColor"}
    xmlns="http://www.w3.org/2000/svg"
  >
    {gradient && (
      <defs>
        <linearGradient id="venn-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#d946ef" />
        </linearGradient>
      </defs>
    )}
    <path d="M20,6a9.92,9.92,0,0,0-4,.84A9.92,9.92,0,0,0,12,6a10,10,0,0,0,0,20,9.92,9.92,0,0,0,4-.84A9.92,9.92,0,0,0,20,26,10,10,0,0,0,20,6ZM12,24A8,8,0,0,1,12,8a7.91,7.91,0,0,1,1.76.2,10,10,0,0,0,0,15.6A7.91,7.91,0,0,1,12,24Zm8-8a8,8,0,0,1-4,6.92A8,8,0,0,1,16,9.08,8,8,0,0,1,20,16Zm0,8a7.91,7.91,0,0,1-1.76-.2,10,10,0,0,0,0-15.6A7.91,7.91,0,0,1,20,8a8,8,0,0,1,0,16Z" />
  </svg>
);

interface ShortcutAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface CommandAction {
  id: string;
  label: string;
}

interface DashboardCanvasProps {
  state: DashboardState;
  shortcuts?: ShortcutAction[];
  currentView?: 'home' | 'commands' | 'loading';
  onBack?: () => void;
  commands?: CommandAction[];
  onCommandClick?: (query: string) => void;
}

// Component registry - maps A2UI component types to React components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COMPONENT_REGISTRY: Record<string, React.ComponentType<any>> = {
  metric_card: MetricCard,
  card_group: CardGroup,
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
      className="animate-slide-up h-full"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <Component component={component} className="h-full" />
    </div>
  );
}

// Default commands for the commands screen
// These are example queries that users can click to send to the chat
const DEFAULT_COMMANDS: CommandAction[] = [
  { id: 'show-all-metrics', label: 'Show all system metrics' },
  { id: 'container-status', label: 'Which containers are using the most memory?' },
  { id: 'workflow-health', label: 'Are my n8n workflows healthy?' },
  { id: 'disk-space', label: 'How much disk space is left?' },
  { id: 'cpu-spike', label: 'What is causing high CPU usage?' },
  { id: 'restart-n8n', label: 'How do I restart the n8n container?' },
  { id: 'failed-workflows', label: 'Show me failed workflow executions' },
];

export function DashboardCanvas({ state, shortcuts, currentView = 'home', onBack, commands = DEFAULT_COMMANDS, onCommandClick }: DashboardCanvasProps) {
  const { components, lastUpdated, agentMessage } = state;

  // Loading screen view
  if (currentView === 'loading') {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <div className="flex items-center gap-3 text-text-secondary">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-lg">Loading...</span>
        </div>
      </div>
    );
  }

  // Commands screen view
  if (currentView === 'commands') {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          Choose any of the following
        </h2>
        <p className="text-text-secondary max-w-md mb-8">
          Or, use chat to find what you want
        </p>

        {/* Command Pills */}
        <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
          {commands.map((command) => (
            <button
              key={command.id}
              onClick={() => onCommandClick?.(command.label)}
              className="px-5 py-2.5 bg-white/70 hover:bg-white/90 backdrop-blur-sm border border-white/50 hover:border-accent-primary/50 rounded-full transition-all duration-200 text-sm font-medium text-text-primary hover:text-accent-primary shadow-sm hover:shadow-md"
            >
              {command.label}
            </button>
          ))}
        </div>

        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            className="mt-8 text-sm text-text-secondary hover:text-accent-primary transition-colors"
          >
            Back to home
          </button>
        )}
      </div>
    );
  }

  if (components.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <VennDiagramIcon className="w-24 h-24 mb-8" gradient />
        <h2 className="text-4xl font-normal text-text-primary mb-3">
          Welcome to Slash GenUI
        </h2>
        <p className="text-text-secondary max-w-md mb-8 text-lg">
          Choose an option below or use the chat
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

  // Group components by layout
  // Featured components go at the top in a 2-column layout (table first, then card)
  const featuredIds = ['containers-list-table', 'running-containers-count'];
  const featuredComponents = components
    .filter(c => featuredIds.includes(c.id))
    .sort((a, b) => featuredIds.indexOf(a.id) - featuredIds.indexOf(b.id));

  // Small components (metric_card, status_indicator, progress_bar) - excluding featured
  const smallComponents = components.filter(c =>
    ['metric_card', 'status_indicator', 'progress_bar'].includes(c.component) &&
    !featuredIds.includes(c.id)
  );

  // Card groups get their own 2-column layout (automations, container groups)
  const cardGroupComponents = components.filter(c =>
    c.component === 'card_group' && !featuredIds.includes(c.id)
  );

  // Large components (data_table, alert_list) - excluding featured
  const largeComponents = components.filter(c =>
    ['data_table', 'alert_list'].includes(c.component) &&
    !featuredIds.includes(c.id)
  );

  return (
    <div className="space-y-6">
      {/* Agent message */}
      {agentMessage && (
        <div className="p-4 bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 shadow-sm">
          <p className="text-sm text-text-secondary">{agentMessage}</p>
        </div>
      )}

      {/* Featured components - 2-column layout at top, same height */}
      {featuredComponents.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          {featuredComponents.map((component, index) => (
            <div
              key={component.id || index}
              className="animate-slide-up h-full"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {(() => {
                const Component = COMPONENT_REGISTRY[component.component];
                return Component ? <Component component={component} className="h-full" /> : null;
              })()}
            </div>
          ))}
        </div>
      )}

      {/* Card groups - 2 column layout (automations, container groups) */}
      {cardGroupComponents.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cardGroupComponents.map((component, index) => (
            <div key={component.id || index}>
              {renderComponent(component, featuredComponents.length + index)}
            </div>
          ))}
        </div>
      )}

      {/* Small components grid - equal height per row */}
      {smallComponents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch">
          {smallComponents.map((component, index) => (
            <div key={component.id || index}>
              {renderComponent(component, featuredComponents.length + cardGroupComponents.length + index)}
            </div>
          ))}
        </div>
      )}

      {/* Large components */}
      {largeComponents.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {largeComponents.map((component, index) =>
            renderComponent(component, featuredComponents.length + cardGroupComponents.length + smallComponents.length + index)
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
