/**
 * Navigation Card
 *
 * A clickable card for navigating to different sections of the dashboard.
 * Shows icon, title, description, and status indicator.
 */

import { LucideIcon } from 'lucide-react';

export type NavigationCardStatus = 'good' | 'warning' | 'error' | 'loading';

interface NavigationCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  status?: {
    current: number;
    total: number;
    label: string;
  };
  statusType?: NavigationCardStatus;
  onClick?: () => void;
  className?: string;
}

const STATUS_COLORS: Record<NavigationCardStatus, string> = {
  good: 'text-green-600',
  warning: 'text-amber-600',
  error: 'text-red-600',
  loading: 'text-text-muted',
};

export function NavigationCard({
  title,
  description,
  icon: Icon,
  status,
  statusType = 'good',
  onClick,
  className = '',
}: NavigationCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        group w-full text-left p-5
        bg-white/70 hover:bg-white/90 backdrop-blur-sm
        border border-white/50 hover:border-accent-primary/30
        rounded-xl transition-all duration-200
        shadow-sm hover:shadow-md
        ${className}
      `}
    >
      {/* Icon - Gray placeholder to match mockup */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-gray-200"
      >
        <Icon className="w-5 h-5 text-gray-400" />
      </div>

      {/* Title */}
      <h3 className="font-semibold text-text-primary mb-1 group-hover:text-accent-primary transition-colors">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-text-secondary mb-3 line-clamp-2">
        {description}
      </p>

      {/* Status and Arrow */}
      <div className="flex items-center justify-between">
        {status ? (
          <div className={`text-sm font-medium ${STATUS_COLORS[statusType]}`}>
            {status.current}/{status.total} {status.label}
          </div>
        ) : (
          <div className="text-sm text-text-muted">View details</div>
        )}
        <span className="text-text-muted group-hover:text-accent-primary transition-colors">
          &rarr;
        </span>
      </div>
    </button>
  );
}

export default NavigationCard;
