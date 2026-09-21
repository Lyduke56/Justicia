/**
 * StatusBadge — Shared component
 *
 * Renders a color-coded badge for status values used across the app
 * (consultation status, verification status, case status, etc.)
 *
 * TODO: Add icon prefix per status
 * TODO: Add animated pulse for 'pending' states
 */

type StatusVariant =
  | 'pending'
  | 'confirmed'
  | 'awaiting_client_confirmation'
  | 'declined'
  | 'completed'
  | 'cancelled'
  | 'verified'
  | 'rejected'
  | 'active'
  | 'outdated'
  | 'superseded'
  | 'open'
  | 'resolved'
  | string;

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200',
  awaiting_client_confirmation: 'bg-orange-100 text-orange-800 border-orange-200',
  declined: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200',
  completed: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400',
  verified: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200',
  active: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200',
  outdated: 'bg-amber-100 text-amber-800 border-amber-200',
  superseded: 'bg-gray-100 text-gray-600 border-gray-200',
  open: 'bg-blue-100 text-blue-800 border-blue-200',
  resolved: 'bg-green-100 text-green-800 border-green-200',
};

const DEFAULT_STYLE = 'bg-gray-100 text-gray-700 border-gray-200';

interface StatusBadgeProps {
  status: StatusVariant;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const displayLabel = label ?? status.replace(/_/g, ' ');
  const styles = STATUS_STYLES[status] ?? DEFAULT_STYLE;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${styles}`}
      aria-label={`Status: ${displayLabel}`}
    >
      {displayLabel}
    </span>
  );
}
