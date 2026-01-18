import { Package, Calendar, HardDrive, Lightbulb } from 'lucide-react';

export interface ECRImage {
  tags: string[];
  pushed: string;
  size: string;
}

export interface ECRRepository {
  name: string;
  uri: string;
  created: string;
  totalImages: number;
  recentImages: ECRImage[];
}

export interface ECRSummaryData {
  repositoryCount: number;
  repositories: ECRRepository[];
  observations: string[];
  suggestion?: string;
}

export interface ECRSummaryCardComponent {
  id: string;
  component: 'ecr_summary';
  source: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  columnSpan?: number;
  props: ECRSummaryData;
}

interface ECRSummaryCardProps {
  component: ECRSummaryCardComponent;
  className?: string;
}

export function ECRSummaryCard({ component, className }: ECRSummaryCardProps) {
  const { props } = component;
  const { repositoryCount, repositories, observations, suggestion } = props;

  return (
    <div className={`bg-surface-2 rounded-xl border border-surface-3 overflow-hidden flex flex-col ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-surface-3">
        <div className="p-2 rounded-lg bg-accent-primary/10">
          <Package className="w-5 h-5 text-accent-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-text-primary">ECR Summary</h3>
          <p className="text-sm text-text-muted">
            You have {repositoryCount} repositor{repositoryCount === 1 ? 'y' : 'ies'}: {repositories.map(r => r.name).join(', ')}
          </p>
        </div>
      </div>

      {/* Repository Details */}
      {repositories.map((repo, repoIdx) => (
        <div key={repoIdx} className="p-4 border-b border-surface-3">
          <h4 className="font-medium text-text-primary mb-3">Repository Details</h4>

          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-text-muted min-w-[80px]">URI:</span>
              <code className="text-accent-primary bg-surface-3/50 px-2 py-0.5 rounded text-xs break-all">
                {repo.uri}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-text-muted" />
              <span className="text-text-muted">Created:</span>
              <span className="text-text-primary">{repo.created}</span>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-text-muted" />
              <span className="text-text-muted">Total Images:</span>
              <span className="text-text-primary font-medium">{repo.totalImages}</span>
            </div>
          </div>

          {/* Recent Images Table */}
          {repo.recentImages && repo.recentImages.length > 0 && (
            <div className="mt-4">
              <h5 className="text-sm font-medium text-text-primary mb-2">Recent Images</h5>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-3 bg-surface-3/30">
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Tags</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Pushed</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Size</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-3">
                    {repo.recentImages.map((image, imgIdx) => (
                      <tr key={imgIdx} className="hover:bg-surface-3/30 transition-colors">
                        <td className="px-3 py-2 text-text-primary">
                          <div className="flex flex-wrap gap-1">
                            {image.tags.map((tag, tagIdx) => (
                              <span
                                key={tagIdx}
                                className={`inline-block px-1.5 py-0.5 rounded text-xs ${
                                  tag === 'latest'
                                    ? 'bg-accent-success/20 text-accent-success'
                                    : 'bg-surface-3 text-text-muted'
                                }`}
                              >
                                {tag.length > 10 ? `${tag.substring(0, 7)}...` : tag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-text-muted whitespace-nowrap">{image.pushed}</td>
                        <td className="px-3 py-2 text-text-muted whitespace-nowrap">{image.size}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Observations */}
      {observations && observations.length > 0 && (
        <div className="p-4 border-b border-surface-3">
          <h4 className="font-medium text-text-primary mb-2">Observations</h4>
          <ul className="space-y-1.5">
            {observations.map((obs, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-text-muted">
                <span className="text-accent-primary mt-1">•</span>
                {obs}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestion */}
      {suggestion && (
        <div className="p-4 bg-accent-warning/5 border-t border-accent-warning/20">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-accent-warning mt-0.5 flex-shrink-0" />
            <p className="text-sm text-text-primary">
              <span className="font-medium text-accent-warning">Suggestion:</span>{' '}
              {suggestion}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
