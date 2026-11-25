/**
 * Plain-language wording for audit log entries on the admin Overview, plus the relative times
 * used by its lists. Unknown actions fall back to the action name with its dots and
 * underscores turned into spaces.
 */

export type ActivityTone = 'success' | 'danger' | 'pending' | 'neutral';
export type ActivityIcon = 'check' | 'cross' | 'file' | 'flag' | 'user' | 'redo' | 'pulse';

export interface ActivityEntry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown>;
  actorName: string | null;
  timestamp: string;
}

export type ActivityCategory = 'Verification' | 'Report' | 'Account' | 'System';

export interface ActivityLine {
  title: string;
  category: ActivityCategory;
  tone: ActivityTone;
  icon: ActivityIcon;
  href: string | null;
}

export const TONE_COLOR: Record<ActivityTone, string> = {
  success: '#1F7A3A',
  danger: '#9A3B2E',
  pending: '#A8742E',
  neutral: '#6B5444',
};

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const words = (value: string) => value.replaceAll('_', ' ').replaceAll('.', ' ');
const sentence = (value: string) => {
  const s = words(value).trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function describeActivity(entry: ActivityEntry): ActivityLine {
  const name = text(entry.details.lawyer_name) ?? text(entry.details.full_name);
  const lawyerHref = entry.targetType === 'lawyer_profile' && entry.targetId ? `/admin/lawyers/${entry.targetId}?from=overview` : null;
  const decision = entry.action.startsWith('lawyer.verification.') ? entry.action.slice('lawyer.verification.'.length) : null;

  if (entry.action === 'lawyer.submitted') {
    return { title: name ? `${name} applied as a lawyer` : 'New lawyer application', category: 'Verification', tone: 'pending', icon: 'file', href: lawyerHref };
  }
  if (entry.action === 'lawyer.approved' || decision === 'approved') {
    return { title: name ? `Approved ${name}` : 'Approved a lawyer', category: 'Verification', tone: 'success', icon: 'check', href: lawyerHref };
  }
  if (entry.action === 'lawyer.rejected' || decision === 'rejected') {
    return { title: name ? `Rejected ${name}` : 'Rejected a lawyer application', category: 'Verification', tone: 'danger', icon: 'cross', href: lawyerHref };
  }
  if (entry.action === 'lawyer.needs_resubmission' || decision) {
    return { title: name ? `Asked ${name} to resubmit` : 'Asked a lawyer to resubmit', category: 'Verification', tone: 'pending', icon: 'redo', href: lawyerHref };
  }
  if (entry.action === 'report.submitted') {
    const category = text(entry.details.category);
    return { title: category ? `New ${words(category)} report` : 'New report filed', category: 'Report', tone: 'danger', icon: 'flag', href: '/admin/reports' };
  }
  if (entry.action === 'report.resolved') {
    const outcome = text(entry.details.action);
    return { title: outcome ? `Resolved a report with a ${words(outcome)}` : 'Resolved a report', category: 'Report', tone: 'success', icon: 'flag', href: '/admin/reports' };
  }
  if (entry.action === 'report.dismissed') {
    return { title: 'Dismissed a report', category: 'Report', tone: 'neutral', icon: 'flag', href: '/admin/reports' };
  }
  if (entry.action === 'user.role_change') {
    const role = text(entry.details.new_role);
    return { title: role ? `Changed an account to ${role}` : 'Changed an account role', category: 'Account', tone: 'neutral', icon: 'user', href: '/admin/users' };
  }
  if (entry.action === 'user.suspended') return { title: 'Suspended an account', category: 'Account', tone: 'danger', icon: 'user', href: '/admin/users' };
  if (entry.action === 'user.reinstated') return { title: 'Reinstated an account', category: 'Account', tone: 'success', icon: 'user', href: '/admin/users' };
  return { title: sentence(entry.action), category: 'System', tone: 'neutral', icon: 'pulse', href: null };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "just now", "12 minutes ago", "yesterday", "4 days ago", then "Nov 4". */
export function timeAgo(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = now - t;
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return relative.format(-Math.floor(diff / MINUTE), 'minute');
  if (diff < DAY) return relative.format(-Math.floor(diff / HOUR), 'hour');
  if (diff < 7 * DAY) return relative.format(-Math.floor(diff / DAY), 'day');
  return new Date(t).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
}

/** Exact stamp for the activity table: "Nov 23" + "2:05 PM" (the year too when it isn't this year). */
export function stamp(iso: string, now: number): { date: string; time: string; full: string } {
  const d = new Date(iso);
  const zone = 'Asia/Manila';
  const sameYear = d.toLocaleDateString('en-PH', { year: 'numeric', timeZone: zone }) === new Date(now).toLocaleDateString('en-PH', { year: 'numeric', timeZone: zone });
  return {
    date: d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }), timeZone: zone }),
    time: d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: zone }),
    full: d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: zone }),
  };
}

/** How long something has been waiting: "under an hour", "5 hours", "3 days". */
export function waitedFor(iso: string, now: number): string {
  const diff = Math.max(0, now - Date.parse(iso));
  if (diff < HOUR) return 'under an hour';
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h} hour${h === 1 ? '' : 's'}`;
  }
  const d = Math.floor(diff / DAY);
  return `${d} day${d === 1 ? '' : 's'}`;
}

/** Applications waiting at least this long are marked in the list. */
export const LONG_WAIT_MS = 3 * DAY;

export function initials(name: string): string {
  const parts = name.replace(/^atty\.?\s+/i, '').split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}
