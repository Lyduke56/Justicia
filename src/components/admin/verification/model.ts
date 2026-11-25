/**
 * Verification queue: status tabs, sort orders and the filtering behind the toolbar, plus the
 * wording and tone of each verification status.
 */

export interface LawyerQueueItem {
  user_id: string;
  email: string;
  full_name: string;
  roll_number: string;
  ibp_chapter: string | null;
  bar_passer_year: number | null;
  about: string | null;
  practice_areas: string[] | null;
  languages: string[] | null;
  experience_years: number | null;
  fee_initial_30min: number | null;
  fee_standard_60min: number | null;
  fee_extended_120min: number | null;
  verification_status: string;
  admin_notes: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export type QueueTab = 'pending' | 'needs_resubmission' | 'approved' | 'rejected' | 'all';

export const QUEUE_TABS: Array<{ key: QueueTab; label: string; heading: string; empty: string; hint: string }> = [
  {
    key: 'pending',
    label: 'Pending Review',
    heading: 'Pending Review',
    empty: 'No applications waiting for review',
    hint: 'New lawyer applications appear here as soon as they are submitted.',
  },
  {
    key: 'needs_resubmission',
    label: 'Needs Info',
    heading: 'Awaiting Resubmission',
    empty: 'No applications returned for information',
    hint: 'Applications sent back for more information stay here until the lawyer resubmits.',
  },
  {
    key: 'approved',
    label: 'Approved',
    heading: 'Approved Lawyers',
    empty: 'No approved lawyers yet',
    hint: 'Approved lawyers are listed in Find a Lawyer and can accept consultations.',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    heading: 'Rejected Applications',
    empty: 'No rejected applications',
    hint: 'Applications that could not be verified are kept here with their reason.',
  },
  {
    key: 'all',
    label: 'All Applications',
    heading: 'All Applications',
    empty: 'No lawyer applications yet',
    hint: 'Every lawyer application, whatever its status, is listed here.',
  },
];

export type QueueSort = 'action' | 'newest' | 'oldest' | 'name';

export const QUEUE_SORTS: Array<{ key: QueueSort; label: string }> = [
  { key: 'action', label: 'Needs action first' },
  { key: 'oldest', label: 'Submitted: oldest' },
  { key: 'newest', label: 'Submitted: newest' },
  { key: 'name', label: 'Name: A–Z' },
];

export type StatusTone = 'pending' | 'info' | 'success' | 'danger' | 'neutral';

export const STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: 'Pending Review', tone: 'pending' },
  needs_resubmission: { label: 'Needs Info', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};
export const statusMeta = (status: string) => STATUS_META[status] ?? { label: 'Draft', tone: 'neutral' as StatusTone };

export const matchesTab = (l: LawyerQueueItem, tab: QueueTab) => tab === 'all' || l.verification_status === tab;

const bareName = (name: string) => name.replace(/^atty\.?\s+/i, '').trim().toLowerCase();
const submittedMs = (l: LawyerQueueItem) => Date.parse(l.submitted_at ?? l.created_at) || 0;
const actionRank = (l: LawyerQueueItem) => (l.verification_status === 'pending' ? 0 : l.verification_status === 'needs_resubmission' ? 1 : 2);

/** Applications shown for a tab, search text and sort order. */
export function visibleApplications(all: readonly LawyerQueueItem[], tab: QueueTab, query: string, sort: QueueSort): LawyerQueueItem[] {
  const q = query.trim().toLowerCase();
  const list = all.filter((l) => {
    if (!matchesTab(l, tab)) return false;
    if (!q) return true;
    return [l.full_name, l.email, l.roll_number, l.ibp_chapter ?? '', (l.practice_areas ?? []).join(' ')].some((v) => (v ?? '').toLowerCase().includes(q));
  });
  const sorted = [...list];
  if (sort === 'action') {
    // Waiting applications first, the longest-waiting at the top; reviewed ones newest first.
    sorted.sort((a, b) => actionRank(a) - actionRank(b) || (actionRank(a) < 2 ? submittedMs(a) - submittedMs(b) : submittedMs(b) - submittedMs(a)));
  } else if (sort === 'oldest') sorted.sort((a, b) => submittedMs(a) - submittedMs(b));
  else if (sort === 'newest') sorted.sort((a, b) => submittedMs(b) - submittedMs(a));
  else sorted.sort((a, b) => bareName(a.full_name).localeCompare(bareName(b.full_name)));
  return sorted;
}

export const peso = (amount: number | null) => (amount == null ? '—' : `₱${Number(amount).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`);
