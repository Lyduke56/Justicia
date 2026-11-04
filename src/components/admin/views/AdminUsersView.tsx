'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { getAdminUsersData, updateUserRoleAction, sendUserPasswordResetAction } from '@/app/actions/adminData';
import type { AdminUserAccount } from '@/types/admin';
import { UserGroupIcon } from '@/components/admin/AdminIcons';

type RoleFilter = 'all' | AdminUserAccount['role'];
const cardClass = 'rounded-3xl border border-[#E8DCCB] bg-[#EFE5D8] shadow-[6px_6px_16px_rgba(0,0,0,0.06),-6px_-6px_16px_rgba(255,255,255,0.85)]';

export function AdminUsersView({ initialUsers = [], initialRole = 'all', initialSelectedId = null }: { initialUsers?: AdminUserAccount[]; initialRole?: RoleFilter; initialSelectedId?: string | null }) {
  const [users, setUsers] = useState(initialUsers);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(initialRole);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [nextRole, setNextRole] = useState<AdminUserAccount['role'] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selected = users.find((user) => user.id === selectedId);

  const filtered = useMemo(() => users.filter((user) => {
    const term = query.trim().toLowerCase();
    return (roleFilter === 'all' || user.role === roleFilter) && (!term || [user.fullName, user.email].some((value) => value.toLowerCase().includes(term)));
  }), [users, roleFilter, query]);

  const refresh = async () => setUsers(await getAdminUsersData());

  const changeRole = async () => {
    if (!selected || !nextRole || selected.role === nextRole) return;
    if (!window.confirm(`Change ${selected.fullName}'s role from ${selected.role} to ${nextRole}?`)) return;
    setBusy(true);
    try {
      const result = await updateUserRoleAction(selected.id, nextRole);
      if (result.error) setMessage(result.error);
      else { await refresh(); setMessage('Role updated.'); setNextRole(null); }
    } catch { setMessage('The role update could not be completed. Please refresh and try again.');
    } finally { setBusy(false); }
  };

  const sendReset = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await sendUserPasswordResetAction(selected.email);
      setMessage(result.error ?? `Password reset email requested for ${selected.email}.`);
    } catch { setMessage('The password reset request could not be completed.');
    } finally { setBusy(false); }
  };

  return <div className="mx-auto max-w-7xl space-y-8 p-6 sm:p-10 lg:p-12">
    <div><Link href="/admin/dashboard" className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#946525] hover:text-[#6B4517]">Administration</Link><h1 className="mt-1 font-cormorant text-4xl font-semibold leading-tight sm:text-5xl">User accounts</h1><p className="mt-2 text-sm text-[#705C49]">Find registered accounts and manage their roles.</p></div>
    <div className="grid gap-4 sm:grid-cols-4">{(['all', 'client', 'lawyer', 'admin'] as const).map((role) => <button key={role} type="button" onClick={() => setRoleFilter(role)} aria-pressed={roleFilter === role} className={`${cardClass} p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#946525] ${roleFilter === role ? 'border-[#C58B3C]' : ''}`}><span className="text-xs font-semibold capitalize text-[#705C49]">{role === 'all' ? 'All accounts' : `${role}s`}</span><span className="mt-2 block font-cormorant text-3xl font-bold">{role === 'all' ? users.length : users.filter((user) => user.role === role).length}</span></button>)}</div>
    <div className={`${cardClass} p-5`}><label htmlFor="admin-user-search" className="block text-xs font-semibold text-[#5C4535]">Search accounts</label><input id="admin-user-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or email" className="mt-2 w-full max-w-lg rounded-xl border border-[#D8CAAD] bg-[#F5EDE2] px-4 py-3 text-sm outline-none shadow-[inset_2px_2px_4px_rgba(0,0,0,0.06)] focus-visible:outline-2 focus-visible:outline-[#946525]" /><p className="mt-2 text-xs text-[#7D6855]">Showing {filtered.length} of {users.length} loaded accounts</p></div>
    <section className={`${cardClass} overflow-hidden`} aria-label="User accounts"><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b border-[#D8CAAD] bg-[#E5D7C5] text-xs text-[#5C4535]"><tr><th className="px-5 py-4 font-semibold">Account</th><th className="px-5 py-4 font-semibold">Role</th><th className="px-5 py-4 font-semibold">Joined</th><th className="px-5 py-4 font-semibold"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-[#E8DCCB]">
      {filtered.map((user) => <tr key={user.id} className="hover:bg-[#F5EDE2]"><td className="px-5 py-4"><span className="block font-semibold">{user.fullName}</span><span className="text-xs text-[#7D6855]">{user.email}</span></td><td className="px-5 py-4 capitalize">{user.role}</td><td className="px-5 py-4 text-xs text-[#705C49]">{new Date(user.createdAt).toLocaleDateString('en-PH')}</td><td className="px-5 py-4 text-right"><button type="button" onClick={() => { setSelectedId(user.id); setNextRole(user.role); setMessage(null); }} className="rounded-lg px-2 py-1 text-xs font-semibold text-[#946525] hover:text-[#6B4517] focus-visible:outline-2 focus-visible:outline-[#946525]">Manage</button></td></tr>)}
      {!filtered.length && <tr><td colSpan={4} className="px-5 py-12 text-center text-sm text-[#7D6855]">{users.length ? 'No accounts match your search.' : 'No accounts are available.'}</td></tr>}
    </tbody></table></div></section>
    {selected && <div className="fixed inset-0 z-50 flex justify-end"><button type="button" aria-label="Close account details" onClick={() => setSelectedId(null)} className="absolute inset-0 w-full bg-black/55" /><aside role="dialog" aria-modal="true" aria-labelledby="admin-account-title" className="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-[#D8CAAD] bg-[#EFE5D8] p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-3 border-b border-[#D8CAAD] pb-5"><div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E5D7C5] text-[#946525]"><UserGroupIcon className="h-5 w-5" /></span><h2 id="admin-account-title" className="mt-3 font-cormorant text-2xl font-bold">{selected.fullName}</h2><p className="text-sm text-[#705C49]">{selected.email}</p></div><button type="button" onClick={() => setSelectedId(null)} aria-label="Close account details" className="rounded-lg p-2 hover:bg-[#E5D7C5] focus-visible:outline-2 focus-visible:outline-[#946525]">×</button></div>
      {message && <p role="status" className="mt-5 rounded-xl border border-[#D8CAAD] bg-[#F5EDE2] p-3 text-sm">{message}</p>}
      <dl className="mt-6 space-y-3 text-sm"><div><dt className="text-[#7D6855]">Account ID</dt><dd className="break-all font-medium">{selected.id}</dd></div><div><dt className="text-[#7D6855]">Current role</dt><dd className="font-medium capitalize">{selected.role}</dd></div><div><dt className="text-[#7D6855]">Joined</dt><dd className="font-medium">{new Date(selected.createdAt).toLocaleDateString('en-PH')}</dd></div></dl>
      <div className="mt-8 space-y-4 border-t border-[#D8CAAD] pt-6"><div><label htmlFor="account-role" className="block text-xs font-semibold text-[#5C4535]">Change role</label><div className="mt-2 flex gap-2"><select id="account-role" value={nextRole ?? selected.role} onChange={(event) => setNextRole(event.target.value as AdminUserAccount['role'])} className="min-w-0 flex-1 rounded-xl border border-[#D8CAAD] bg-[#F5EDE2] px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[#946525]"><option value="client">Client</option><option value="lawyer">Lawyer</option><option value="admin">Admin</option></select><button type="button" disabled={busy || !nextRole || nextRole === selected.role} onClick={changeRole} className="rounded-xl bg-[#23150F] px-4 py-2 text-sm font-semibold text-[#DED7CB] hover:bg-[#3E271D] focus-visible:outline-2 focus-visible:outline-[#946525] disabled:opacity-50">Update</button></div></div>
      <button type="button" disabled={busy} onClick={sendReset} className="w-full rounded-xl border border-[#D8CAAD] bg-[#F5EDE2] px-4 py-3 text-left text-sm font-semibold hover:bg-[#E5D7C5] focus-visible:outline-2 focus-visible:outline-[#946525] disabled:opacity-50">Send password reset email</button></div>
    </aside></div>}
  </div>;
}
