import type { AdminReportItem } from '@/types/admin';

/** Reports: status tabs, sort orders and filtering, plus the wording and tone of each status. */

export type ReportTab = 'open' | 'resolved' | 'dismissed' | 'all';

export const REPORT_TABS: Array<{ key: ReportTab; label: string; heading: string; empty: string; hint: string }> = [
  { key: 'open', label: 'Needs Review', heading: 'Needs Review', empty: 'No reports need review', hint: 'Reports filed from Messages wait here until you decide on them.' },
  { key: 'resolved', label: 'Action Taken', heading: 'Action Taken', empty: 'No reports with action taken', hint: 'Reports that led to a suspension or termination are kept here.' },
  { key: 'dismissed', label: 'Dismissed', heading: 'Dismissed', empty: 'No dismissed reports', hint: 'Reports you found no violation in are kept here.' },
  { key: 'all', label: 'All Reports', heading: 'All Reports', empty: 'No accounts have been reported', hint: 'Clients and lawyers can report each other from Messages.' },
];

export type ReportSort = 'newest' | 'oldest' | 'offenses';

export const REPORT_SORTS: Array<{ key: ReportSort; label: string }> = [
  { key: 'newest', label: 'Submitted: newest' },
  { key: 'oldest', label: 'Submitted: oldest' },
  { key: 'offenses', label: 'Most offenses' },
];

export const isOpenReport = (r: AdminReportItem) => r.status === 'open' || r.status === 'under_review';

export const matchesReportTab = (r: AdminReportItem, tab: ReportTab) =>
  tab === 'all' || (tab === 'open' ? isOpenReport(r) : r.status === tab);

export function visibleReports(all: readonly AdminReportItem[], tab: ReportTab, query: string, sort: ReportSort): AdminReportItem[] {
  const q = query.trim().toLowerCase();
  const list = all.filter(
    (r) =>
      matchesReportTab(r, tab) &&
      (!q || [r.target.name, r.target.email, r.reporter.name, r.reporter.email, r.reasonLabel, r.details].some((v) => (v ?? '').toLowerCase().includes(q)))
  );
  const at = (r: AdminReportItem) => Date.parse(r.createdAt) || 0;
  const sorted = [...list];
  if (sort === 'oldest') sorted.sort((a, b) => at(a) - at(b));
  else if (sort === 'offenses') sorted.sort((a, b) => b.target.suspensionCount - a.target.suspensionCount || b.target.openReportCount - a.target.openReportCount || at(b) - at(a));
  else sorted.sort((a, b) => at(b) - at(a));
  return sorted;
}

export const REPORT_STATUS: Record<AdminReportItem['status'], { label: string; pill: string }> = {
  open: { label: 'Open', pill: 'admin-pill-pending' },
  under_review: { label: 'In review', pill: 'admin-pill-pending' },
  resolved: { label: 'Action taken', pill: 'admin-pill-success' },
  dismissed: { label: 'Dismissed', pill: 'admin-pill-neutral' },
  appealed: { label: 'Appealed', pill: 'admin-pill-info' },
};

export const ACCOUNT_STATUS: Record<AdminReportItem['target']['accountStatus'], { label: string; pill: string; text: string }> = {
  active: { label: 'Active', pill: 'admin-pill-success', text: 'text-[#2F5A2A]' },
  suspended: { label: 'Suspended', pill: 'admin-pill-pending', text: 'text-[#7A5418]' },
  terminated: { label: 'Terminated', pill: 'admin-pill-danger', text: 'text-[#863B30]' },
  pending_deletion: { label: 'Pending deletion', pill: 'admin-pill-neutral', text: 'text-[#5C4535]' },
};

export const ACTION_LABEL: Record<string, string> = {
  suspension: 'Account suspended',
  termination: 'Account terminated',
  no_action: 'Dismissed: no violation found',
  warning: 'Warning issued',
  content_removed: 'Content removed',
};

export const ordinal = (n: number) => ['1st', '2nd', '3rd', '4th', '5th', '6th'][n - 1] ?? `${n}th`;
