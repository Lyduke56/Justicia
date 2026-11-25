/**
 * Lawyer directory: status tabs, sort orders and filtering behind the toolbar, plus how a
 * lawyer's public listing is described.
 */

export interface LawyerDirectoryItem {
  user_id: string;
  email: string;
  full_name: string;
  roll_number?: string | null;
  ibp_chapter?: string | null;
  bar_passer_year?: number | null;
  practice_areas?: string[] | null;
  languages?: string[] | null;
  experience_years?: number | null;
  fee_standard_60min?: number | null;
  verification_status: string;
  is_visible?: boolean | null;
  is_available?: boolean | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export type DirectoryTab = 'all' | 'approved' | 'pending' | 'needs_resubmission' | 'rejected';

export const DIRECTORY_TABS: Array<{ key: DirectoryTab; label: string; heading: string; empty: string; hint: string }> = [
  { key: 'all', label: 'All Lawyers', heading: 'All Lawyers', empty: 'No lawyers registered yet', hint: 'Lawyers appear here as soon as they create a lawyer profile.' },
  { key: 'approved', label: 'Verified', heading: 'Verified Lawyers', empty: 'No verified lawyers yet', hint: 'Lawyers you approve are listed here and in Find a Lawyer.' },
  { key: 'pending', label: 'Pending', heading: 'Pending Verification', empty: 'No lawyers waiting for verification', hint: 'Submitted applications wait here until you review them in the verification queue.' },
  { key: 'needs_resubmission', label: 'Needs Info', heading: 'Awaiting Resubmission', empty: 'No lawyers asked for more information', hint: 'Lawyers you asked for more information stay here until they resubmit.' },
  { key: 'rejected', label: 'Rejected', heading: 'Rejected Lawyers', empty: 'No rejected lawyers', hint: 'Lawyers whose credentials could not be verified are kept here.' },
];

export type DirectorySort = 'newest' | 'oldest' | 'name' | 'experience';

export const DIRECTORY_SORTS: Array<{ key: DirectorySort; label: string }> = [
  { key: 'newest', label: 'Registered: newest' },
  { key: 'oldest', label: 'Registered: oldest' },
  { key: 'name', label: 'Name: A–Z' },
  { key: 'experience', label: 'Most experienced' },
];

export const matchesTab = (l: LawyerDirectoryItem, tab: DirectoryTab) => tab === 'all' || (l.verification_status || 'draft') === tab;

const bareName = (name: string) => name.replace(/^atty\.?\s+/i, '').trim().toLowerCase();
const registeredMs = (l: LawyerDirectoryItem) => Date.parse(l.submitted_at || l.created_at) || 0;

export function visibleLawyers(all: readonly LawyerDirectoryItem[], tab: DirectoryTab, query: string, sort: DirectorySort): LawyerDirectoryItem[] {
  const q = query.trim().toLowerCase();
  const list = all.filter((l) => {
    if (!matchesTab(l, tab)) return false;
    if (!q) return true;
    return [l.full_name, l.email, l.roll_number ?? '', l.ibp_chapter ?? '', (l.practice_areas ?? []).join(' ')].some((v) => (v ?? '').toLowerCase().includes(q));
  });
  const sorted = [...list];
  if (sort === 'name') sorted.sort((a, b) => bareName(a.full_name || '').localeCompare(bareName(b.full_name || '')));
  else if (sort === 'experience') sorted.sort((a, b) => (b.experience_years ?? -1) - (a.experience_years ?? -1));
  else if (sort === 'oldest') sorted.sort((a, b) => registeredMs(a) - registeredMs(b));
  else sorted.sort((a, b) => registeredMs(b) - registeredMs(a));
  return sorted;
}

/** Public listing: only approved, visible lawyers appear in Find a Lawyer. */
export function listingOf(l: LawyerDirectoryItem): { listed: boolean; label: string; detail: string } {
  if (l.verification_status !== 'approved') return { listed: false, label: 'Hidden', detail: 'Not verified' };
  if (!l.is_visible) return { listed: false, label: 'Hidden', detail: 'Turned off' };
  return { listed: true, label: 'Listed', detail: l.is_available === false ? 'Not accepting' : 'Accepting clients' };
}
