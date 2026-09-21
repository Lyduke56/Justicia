/**
 * StatTile — Admin-facing component
 * Displays a single KPI metric with label, value, and optional change indicator.
 * TODO: Add loading skeleton state
 * TODO: Add sparkline chart mini-visualization
 * TODO: Add click-to-drilldown behavior
 */
interface StatTileProps {
  label: string;
  value: string | number;
  change?: number; // percentage change, positive = up
  icon?: string;
  href?: string;
}

export function StatTile({ label, value, change, icon, href }: StatTileProps) {
  const isPositive = change !== undefined && change >= 0;
  const Tag = href ? 'a' : 'div';

  return (
    <Tag
      href={href}
      className={`rounded-2xl border bg-card p-5 space-y-2 ${href ? 'hover:shadow-md transition-shadow' : ''}`}
      aria-label={`${label}: ${value}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        {icon && <span className="text-xl" aria-hidden="true">{icon}</span>}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {change !== undefined && (
        <p className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? '▲' : '▼'} {Math.abs(change)}% vs last month
        </p>
      )}
    </Tag>
  );
}
