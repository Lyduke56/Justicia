import type { AdminAuditEntry } from '@/types/admin';
import { describeActivity, type ActivityCategory, type ActivityEntry, type ActivityLine } from '../overview/activity';

/** Audit log: category tabs, sort orders and filtering, built on the Overview's activity wording. */

export type AuditTab = 'all' | ActivityCategory;

export const AUDIT_TABS: Array<{ key: AuditTab; label: string; heading: string; empty: string; hint: string }> = [
  { key: 'all', label: 'All Events', heading: 'All Events', empty: 'No events recorded yet', hint: 'Reviews, reports and account changes are recorded here as they happen.' },
  { key: 'Verification', label: 'Verification', heading: 'Verification', empty: 'No verification events', hint: 'Lawyer applications, approvals, rejections and requests for information.' },
  { key: 'Report', label: 'Reports', heading: 'Reports', empty: 'No report events', hint: 'Reports filed from Messages and the decisions made on them.' },
  { key: 'Account', label: 'Accounts', heading: 'Accounts', empty: 'No account events', hint: 'Role changes, suspensions and reinstatements.' },
  { key: 'System', label: 'System', heading: 'System', empty: 'No other events', hint: 'Events that do not belong to the other categories.' },
];

export type AuditSort = 'newest' | 'oldest';

export const AUDIT_SORTS: Array<{ key: AuditSort; label: string }> = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
];

export interface AuditRow {
  entry: AdminAuditEntry;
  line: ActivityLine;
}

export const toActivity = (e: AdminAuditEntry): ActivityEntry => ({
  id: e.id,
  action: e.action,
  targetType: e.targetType || null,
  targetId: e.targetId || null,
  details: e.details ?? {},
  actorName: e.actor.name,
  timestamp: e.timestamp,
});

export const describeAudit = (entry: AdminAuditEntry): AuditRow => ({ entry, line: describeActivity(toActivity(entry)) });

export function visibleAudit(rows: readonly AuditRow[], tab: AuditTab, query: string, sort: AuditSort): AuditRow[] {
  const q = query.trim().toLowerCase();
  const list = rows.filter(
    ({ entry, line }) =>
      (tab === 'all' || line.category === tab) &&
      (!q || [line.title, entry.action, entry.actor.name, entry.actor.email, entry.targetType, entry.targetId].some((v) => (v ?? '').toLowerCase().includes(q)))
  );
  const at = (r: AuditRow) => Date.parse(r.entry.timestamp) || 0;
  return [...list].sort((a, b) => (sort === 'oldest' ? at(a) - at(b) : at(b) - at(a)));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where an event's target can be opened, when it is a record this portal shows. */
export function targetLink(entry: AdminAuditEntry): { href: string; label: string } | null {
  if (!UUID.test(entry.targetId ?? '')) return null;
  if (entry.targetType === 'lawyer_profile') return { href: `/admin/lawyers/${entry.targetId}?from=audit`, label: 'Open lawyer dossier' };
  if (entry.targetType === 'report') return { href: `/admin/reports/${entry.targetId}`, label: 'Open report' };
  if (entry.targetType === 'user_account') return { href: `/admin/users/${entry.targetId}`, label: 'Open account' };
  return null;
}

/** "lawyer_profile" → "Lawyer profile". */
export const humanize = (value: string) => {
  const s = value.replaceAll('_', ' ').replaceAll('.', ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** A detail value as readable text (objects fall back to compact JSON). */
export function formatDetail(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map((v) => formatDetail(v)).join(', ') : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
