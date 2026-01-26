/**
 * Today's Update Card
 *
 * Displays a summary banner at the top of the dashboard with key metrics
 * and insights in a readable sentence format.
 */

import { Clock } from 'lucide-react';

interface TodaysUpdateCardProps {
  summary: string;
  timestamp?: string;
  isLoading?: boolean;
  className?: string;
}

export function TodaysUpdateCard({
  summary,
  timestamp,
  isLoading = false,
  className = '',
}: TodaysUpdateCardProps) {
  // Format timestamp or use "just now"
  const displayTime = timestamp
    ? formatRelativeTime(timestamp)
    : 'just now';

  // Format current date
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Highlight numbers and key terms in the summary
  const formattedSummary = highlightSummary(summary);

  return (
    <div
      className={`
        bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 shadow-sm
        p-6 ${className}
      `}
    >
      <div className="flex items-center gap-8">
        {/* Left side - Title and timestamp stacked */}
        <div className="flex-shrink-0 min-w-[140px]">
          <h2 className="widget-title">Today's Update</h2>
          <div className="text-sm text-text-muted mt-1">{currentDate}</div>
          <div className="flex items-center gap-1.5 text-xs text-text-muted mt-1">
            <Clock className="w-3 h-3" />
            <span>{displayTime}</span>
          </div>
        </div>

        {/* Right side - Summary text */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-5 bg-gray-200 rounded w-3/4"></div>
            </div>
          ) : (
            <p className="text-xl text-text-primary leading-tight">
              {formattedSummary}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Format a timestamp as relative time (e.g., "3 min ago")
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1 min ago';
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  return `${diffDays} days ago`;
}

/**
 * Highlight numbers and key metrics in the summary text
 * Wraps bracketed values like [X] in styled spans
 */
function highlightSummary(summary: string): React.ReactNode {
  // Match patterns like [X], [100]%, [$92]
  const parts = summary.split(/(\[[^\]]+\])/g);

  return parts.map((part, index) => {
    if (part.startsWith('[') && part.endsWith(']')) {
      // Extract the value and style it
      const value = part.slice(1, -1);
      return (
        <span key={index} className="font-semibold text-accent-primary">
          {value}
        </span>
      );
    }
    return part;
  });
}

export default TodaysUpdateCard;
