import type { AdminUserAccount } from '@/types/admin';

/** User Accounts: role tabs, sort orders and filtering, plus how each role is described. */

export type UserRole = AdminUserAccount['role'];
export type UserTab = 'all' | UserRole;

export const USER_TABS: Array<{ key: UserTab; label: string; heading: string; empty: string; hint: string }> = [
  { key: 'all', label: 'All Accounts', heading: 'All Accounts', empty: 'No accounts yet', hint: 'Accounts appear here as soon as people sign up.' },
  { key: 'client', label: 'Clients', heading: 'Clients', empty: 'No client accounts', hint: 'People who sign up to book consultations are listed here.' },
  { key: 'lawyer', label: 'Lawyers', heading: 'Lawyers', empty: 'No lawyer accounts', hint: 'Lawyers are listed here once they create a lawyer account.' },
  { key: 'admin', label: 'Administrators', heading: 'Administrators', empty: 'No administrator accounts', hint: 'Accounts with access to this admin portal are listed here.' },
];

export type UserSort = 'newest' | 'oldest' | 'name';

export const USER_SORTS: Array<{ key: UserSort; label: string }> = [
  { key: 'newest', label: 'Joined: newest' },
  { key: 'oldest', label: 'Joined: oldest' },
  { key: 'name', label: 'Name: A–Z' },
];

export const ROLE_META: Record<UserRole, { label: string; pill: string; summary: string }> = {
  client: { label: 'Client', pill: 'admin-pill-neutral', summary: 'Books consultations, messages lawyers and keeps case documents.' },
  lawyer: { label: 'Lawyer', pill: 'admin-pill-pending', summary: 'Uses the lawyer portal once their credentials are verified.' },
  admin: { label: 'Administrator', pill: 'admin-pill-espresso', summary: 'Full access to this admin portal: verification, accounts, reports and the audit log.' },
};

const bareName = (name: string) => name.replace(/^atty\.?\s+/i, '').trim().toLowerCase();

export function visibleUsers(all: readonly AdminUserAccount[], tab: UserTab, query: string, sort: UserSort): AdminUserAccount[] {
  const q = query.trim().toLowerCase();
  const list = all.filter((u) => (tab === 'all' || u.role === tab) && (!q || [u.fullName, u.email, u.id].some((v) => (v ?? '').toLowerCase().includes(q))));
  const at = (u: AdminUserAccount) => Date.parse(u.createdAt) || 0;
  const sorted = [...list];
  if (sort === 'name') sorted.sort((a, b) => bareName(a.fullName || '').localeCompare(bareName(b.fullName || '')));
  else if (sort === 'oldest') sorted.sort((a, b) => at(a) - at(b));
  else sorted.sort((a, b) => at(b) - at(a));
  return sorted;
}

/** First block of the account id, enough to tell accounts apart at a glance. */
export const shortId = (id: string) => id.split('-')[0] ?? id.slice(0, 8);
