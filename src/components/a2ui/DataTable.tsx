import { DataTableComponent } from '../../types/a2ui';
import { Table, ArrowUpDown, ExternalLink } from 'lucide-react';

interface DataTableProps {
  component: DataTableComponent;
  className?: string;
}

export function DataTable({ component, className }: DataTableProps) {
  const { props } = component;
  const { title, columns, rows, sortBy } = props;

  const formatValue = (value: unknown, type?: string): string => {
    if (value === null || value === undefined) return '—';
    
    switch (type) {
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : String(value);
      case 'timestamp':
        return new Date(String(value)).toLocaleString();
      case 'status':
        return String(value);
      default:
        return String(value);
    }
  };

  const getStatusBgColor = (value: unknown): string => {
    const strValue = String(value).toLowerCase();
    if (strValue === 'healthy' || strValue === 'ok' || strValue === 'running' || strValue === 'success') {
      return 'bg-green-500';
    }
    if (strValue === 'warning' || strValue === 'degraded') {
      return 'bg-yellow-500';
    }
    if (strValue === 'critical' || strValue === 'error' || strValue === 'failed') {
      return 'bg-red-500';
    }
    return 'bg-gray-400';
  };

  const getStatusTextColor = (value: unknown): string => {
    const strValue = String(value).toLowerCase();
    if (strValue === 'healthy' || strValue === 'ok' || strValue === 'running' || strValue === 'success') {
      return 'text-green-600';
    }
    if (strValue === 'warning' || strValue === 'degraded') {
      return 'text-yellow-600';
    }
    if (strValue === 'critical' || strValue === 'error' || strValue === 'failed') {
      return 'text-red-600';
    }
    return 'text-black';
  };

  return (
    <div className={`bg-surface-2 rounded-xl border border-surface-3 overflow-hidden flex flex-col ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-surface-3">
        <Table className="w-4 h-4 text-accent-primary" />
        <h3 className="widget-title">{title}</h3>
        <span className="ml-auto text-xs text-text-muted">
          {rows.length} items
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-3 bg-surface-3/30">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted"
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortBy === col.key && (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-3">
            {rows.map((row, rowIdx) => (
              <tr 
                key={rowIdx}
                className="hover:bg-surface-3/30 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-sm ${
                      col.type === 'status'
                        ? getStatusTextColor(row[col.key])
                        : 'text-black'
                    }`}
                  >
                    {col.type === 'status' ? (
                      <span className="inline-flex items-center justify-center">
                        <span className={`w-3 h-3 rounded-full ${
                          getStatusBgColor(row[col.key])
                        }`} />
                      </span>
                    ) : (
                      formatValue(row[col.key], col.type)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="p-8 text-center text-text-muted">
          No data available
        </div>
      )}

      {/* Footer */}
      {props.footer && (
        <div className="px-4 py-3 border-t border-surface-3 bg-surface-3/20">
          {props.footer.link ? (
            <a
              href={props.footer.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-accent-primary hover:underline"
            >
              {props.footer.text}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <span className="text-sm text-text-muted">{props.footer.text}</span>
          )}
        </div>
      )}
    </div>
  );
}
