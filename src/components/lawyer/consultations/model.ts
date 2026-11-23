import type { LawyerConsultation } from '@/app/actions/consultationActions';
import { startMsOf, toIsoDate } from '@/lib/lawyer/dashboardSchedule';

/** Status tabs of the Consultations screen. */
export type ConsultationTab = 'all' | 'pending' | 'upcoming' | 'completed' | 'cancelled';

export const TABS: Array<{ key: ConsultationTab; label: string; heading: string; empty: string }> = [
  { key: 'all', label: 'All Inquiries', heading: 'All Inquiries', empty: 'No consultation requests yet' },
  { key: 'pending', label: 'Pending Approval', heading: 'Pending Approval', empty: 'No requests waiting for you' },
  { key: 'upcoming', label: 'Upcoming', heading: 'Upcoming Consultations', empty: 'No upcoming consultations' },
  { key: 'completed', label: 'Completed', heading: 'Completed Consultations', empty: 'No completed consultations' },
  { key: 'cancelled', label: 'Cancelled', heading: 'Cancelled & Declined', empty: 'Nothing cancelled or declined' },
];

export function matchesTab(c: LawyerConsultation, tab: ConsultationTab): boolean {
  switch (tab) {
    case 'pending':
      return c.status === 'pending';
    case 'upcoming':
      return c.status === 'pending_payment' || c.status === 'payment_review' || c.status === 'confirmed';
    case 'completed':
      return c.status === 'completed';
    case 'cancelled':
      return c.status === 'cancelled' || c.status === 'declined';
    default:
      return true;
  }
}

/**
 * Sort orders. "action" matches the server's own order: requests and payments to review first
 * (soonest first), then upcoming sessions (soonest first), then past or closed ones (latest first).
 */
export type SortKey = 'action' | 'soonest' | 'latest' | 'client';

function actionRank(c: LawyerConsultation, today: string): number {
  if (c.status === 'pending' || c.status === 'payment_review') return 0;
  if ((c.status === 'pending_payment' || c.status === 'confirmed') && isoOfConsultation(c) >= today) return 1;
  return 2;
}

export const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'action', label: 'Needs action first' },
  { key: 'soonest', label: 'Session date: soonest' },
  { key: 'latest', label: 'Session date: latest' },
  { key: 'client', label: 'Client name: A–Z' },
];

/** Consultations shown for a tab, client-name search and sort order (`today`: Manila ISO date). */
export function visibleConsultations(
  all: readonly LawyerConsultation[],
  tab: ConsultationTab,
  query: string,
  sort: SortKey,
  today: string
): LawyerConsultation[] {
  const q = query.trim().toLowerCase();
  const list = all.filter((c) => matchesTab(c, tab) && (!q || c.client.name.toLowerCase().includes(q)));
  const keyed = list.map((c) => ({ c, start: startMsOf(c), rank: actionRank(c, today) }));
  if (sort === 'action') keyed.sort((a, b) => a.rank - b.rank || (a.rank === 2 ? b.start - a.start : a.start - b.start));
  else if (sort === 'soonest') keyed.sort((a, b) => a.start - b.start);
  else if (sort === 'latest') keyed.sort((a, b) => b.start - a.start);
  else keyed.sort((a, b) => a.c.client.name.localeCompare(b.c.client.name) || a.start - b.start);
  return keyed.map(({ c }) => c);
}

export const isoOfConsultation = (c: Pick<LawyerConsultation, 'year' | 'month' | 'day'>) => toIsoDate(c.year, c.month, c.day);
