import { ExternalLink } from 'lucide-react';
import { ShortcutLinksComponent } from '../../types/a2ui';

interface ShortcutLinksCardProps {
  component: ShortcutLinksComponent;
  className?: string;
}

export function ShortcutLinksCard({ component, className = '' }: ShortcutLinksCardProps) {
  const { shortcuts, layout = 'default' } = component.props;

  // Determine grid columns based on layout
  const gridCols = layout === 'compact'
    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
    : layout === 'wide'
    ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6';

  return (
    <div className={`bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 shadow-sm p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">Quick Links</h3>
        <span className="text-sm text-text-muted">{shortcuts.length} tools</span>
      </div>

      <div className={`grid ${gridCols} gap-3`}>
        {shortcuts.map((shortcut) => (
          <a
            key={shortcut.id}
            href={shortcut.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex flex-col p-4 rounded-lg transition-all duration-200 hover:shadow-lg overflow-hidden"
            style={{
              backgroundColor: shortcut.color || '#6366f1',
              backgroundImage: shortcut.color
                ? `linear-gradient(135deg, ${shortcut.color} 0%, ${shortcut.color}dd 100%)`
                : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            }}
          >
            {/* Hover overlay effect */}
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-200" />

            {/* Content */}
            <div className="relative flex flex-col h-full">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="text-white font-semibold text-base mb-0.5 group-hover:translate-x-0.5 transition-transform">
                    {shortcut.title}
                  </h4>
                  <p className="text-white/80 text-xs font-medium">
                    {shortcut.subtitle}
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-white/60 group-hover:text-white/90 transition-colors flex-shrink-0 ml-2" />
              </div>
            </div>

            {/* Border glow on hover */}
            <div className="absolute inset-0 rounded-lg border border-white/0 group-hover:border-white/30 transition-colors duration-200 pointer-events-none" />
          </a>
        ))}
      </div>
    </div>
  );
}
