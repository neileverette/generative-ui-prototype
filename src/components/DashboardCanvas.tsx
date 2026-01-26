import { DashboardState, A2UIComponent } from '../types/a2ui';
import { MetricCard } from './a2ui/MetricCard';
import { CardGroup } from './a2ui/CardGroup';
import { DataTable } from './a2ui/DataTable';
import { AlertList } from './a2ui/AlertList';
import { StatusIndicator } from './a2ui/StatusIndicator';
import { ProgressBar } from './a2ui/ProgressBar';
import { ECRSummaryCard } from './a2ui/ECRSummaryCard';
import { ClaudeUsageCard } from './a2ui/ClaudeUsageCard';
import { AnthropicUsageCard } from './a2ui/AnthropicUsageCard';
import { ShortcutLinksCard } from './a2ui/ShortcutLinksCard';
import { LandingPage } from './LandingPage';


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
  currentView?: 'home' | 'commands' | 'loading' | 'landing';
  onBack?: () => void;
  commands?: CommandAction[];
  onCommandClick?: (query: string) => void;
  statusSummary?: string | null;
  statusSummaryLoading?: boolean;
  onNavigate?: (destination: string) => void;
  onSendMessage?: (message: string) => void;
  timeWindow?: string;
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
  ecr_summary: ECRSummaryCard,
  claude_usage: ClaudeUsageCard,
  anthropic_usage: AnthropicUsageCard,
  shortcut_links: ShortcutLinksCard,
};

function renderComponent(component: A2UIComponent, index: number) {
  const Component = COMPONENT_REGISTRY[component.component];

  if (!Component) {
    console.warn(`Unknown component type: ${component.component}`);
    return null;
  }

  const colSpanClass = component.columnSpan ? `col-span-${component.columnSpan}` : '';

  return (
    <div
      key={component.id || index}
      className={`animate-slide-up h-full ${colSpanClass}`}
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
  { id: 'show-deployments', label: 'Show deployments' },
  { id: 'deployment-count', label: 'How many deployments do I have?' },
  { id: 'last-deployment', label: 'When was my last deployment?' },
];

export function DashboardCanvas({ state, currentView = 'home', onBack, commands = DEFAULT_COMMANDS, onCommandClick, onNavigate, onSendMessage, timeWindow }: DashboardCanvasProps) {
  const { components, lastUpdated, agentMessage } = state;

  // Landing page view - new mockup design
  if (currentView === 'landing') {
    return (
      <LandingPage
        onNavigate={onNavigate || (() => {})}
        onSendMessage={onSendMessage || (() => {})}
        timeWindow={timeWindow}
      />
    );
  }

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

  // If no components and currentView is 'home', redirect to landing
  if (components.length === 0 && currentView === 'home') {
    // This should never happen with proper routing, but as a safeguard,
    // render the landing page instead of the old shortcut cards view
    return (
      <LandingPage
        onNavigate={onNavigate || (() => {})}
        onSendMessage={onSendMessage || (() => {})}
        timeWindow={timeWindow}
      />
    );
  }

  // Group components by layout
  // ECR summary components render after featured (full width)
  const ecrComponents = components.filter(c => c.component === 'ecr_summary');

  // Featured components go at the top in a 2-column layout (card on left, table on right)
  const featuredIds = [
    'running-containers-count', 'containers-list-table',
    'deployment-count', 'deployment-stats', 'deployments-table',
    'pipeline-success-rate', 'pipeline-avg-build-time', 'pipeline-builds-per-day', 'pipeline-health'
  ];
  const featuredComponents = components
    .filter(c => featuredIds.includes(c.id))
    .sort((a, b) => featuredIds.indexOf(a.id) - featuredIds.indexOf(b.id));

  // Cost components use columnSpan for custom grid layout
  const costIds = ['aws-total-cost', 'aws-forecast', 'aws-cost-breakdown'];
  const costComponents = components.filter(c => costIds.includes(c.id));

  // Small components (metric_card, status_indicator, progress_bar) - excluding featured and cost
  const smallComponents = components.filter(c =>
    ['metric_card', 'status_indicator', 'progress_bar'].includes(c.component) &&
    !featuredIds.includes(c.id) &&
    !costIds.includes(c.id)
  );

  // Card groups get their own 2-column layout (automations, container groups)
  const cardGroupComponents = components.filter(c =>
    c.component === 'card_group' && !featuredIds.includes(c.id)
  );

  // Large components (data_table, alert_list) - excluding featured and cost
  const largeComponents = components.filter(c =>
    ['data_table', 'alert_list'].includes(c.component) &&
    !featuredIds.includes(c.id) &&
    !costIds.includes(c.id)
  );

  // Widget components (claude_usage, anthropic_usage, ecr_summary) - standalone full-width widgets
  const widgetComponents = components.filter(c =>
    ['claude_usage', 'anthropic_usage', 'ecr_summary'].includes(c.component)
  );

  return (
    <div className="space-y-6">
      {/* Agent message */}
      {agentMessage && (
        <div className="p-4 bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 shadow-sm">
          <p className="text-sm text-text-secondary">{agentMessage}</p>
        </div>
      )}

      {/* Cost components - 4 column grid with custom spans */}
      {costComponents.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {costComponents.map((component, index) => {
            const Component = COMPONENT_REGISTRY[component.component];
            // Use columnSpan from component or default based on type
            const span = component.columnSpan || (component.component === 'data_table' ? 4 : 2);
            return (
              <div
                key={component.id || index}
                className={`animate-slide-up h-full ${span === 4 ? 'col-span-4' : 'col-span-2'}`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {Component ? <Component component={component} className="h-full" /> : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Featured components - layout depends on content */}
      {featuredComponents.length > 0 && (
        (() => {
          // Check if this is a deployment view (stats card + table)
          const isDeploymentView = featuredComponents.some(c => c.id === 'deployment-count' || c.id === 'deployment-stats');

          if (isDeploymentView) {
            // Deployment view: left column with stacked cards, right column with table
            const deploymentCount = featuredComponents.find(c => c.id === 'deployment-count');
            const pipelineCards = featuredComponents.filter(c => c.id.startsWith('pipeline-'));
            const deploymentsTable = featuredComponents.find(c => c.component === 'data_table');

            return (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-stretch">
                {/* Left column: deployment count + pipeline stats stacked */}
                <div className="animate-slide-up flex flex-col gap-4">
                  {deploymentCount && (() => {
                    const Component = COMPONENT_REGISTRY[deploymentCount.component];
                    return Component ? <Component component={deploymentCount} /> : null;
                  })()}
                  {pipelineCards.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {pipelineCards.map((card, idx) => {
                        const Component = COMPONENT_REGISTRY[card.component];
                        return Component ? (
                          <div key={card.id} style={{ animationDelay: `${(idx + 1) * 50}ms` }}>
                            <Component component={card} />
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
                {/* Right column: deployments table */}
                {deploymentsTable && (
                  <div className="md:col-span-3 animate-slide-up" style={{ animationDelay: '100ms' }}>
                    {(() => {
                      const Component = COMPONENT_REGISTRY[deploymentsTable.component];
                      return Component ? <Component component={deploymentsTable} className="h-full" /> : null;
                    })()}
                  </div>
                )}
              </div>
            );
          }

          // Default: 2-column layout
          return (
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
          );
        })()
      )}

      {/* ECR Summary components - full width after featured */}
      {ecrComponents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {ecrComponents.map((component, index) => (
            <div
              key={component.id || index}
              className="animate-slide-up md:col-span-4"
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

      {/* Widget components (claude_usage, anthropic_usage, ecr_summary) - 2-column layout to fill width */}
      {widgetComponents.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {widgetComponents.map((component, index) =>
            renderComponent(component, featuredComponents.length + cardGroupComponents.length + smallComponents.length + largeComponents.length + index)
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
