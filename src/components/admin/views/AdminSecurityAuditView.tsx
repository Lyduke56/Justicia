'use client';

import { useMemo, useState } from 'react';
import { getAdminAuditLogsData } from '@/app/actions/adminData';
import type { AdminAuditEntry } from '@/types/admin';
import { DocumentTextIcon } from '@/components/admin/AdminIcons';

const cardClass = 'admin-surface';

export function AdminSecurityAuditView({ initialLogs = [] }: { initialLogs?: AdminAuditEntry[] }) {
  const [logs, setLogs] = useState(initialLogs);
  const [previousData, setPreviousData] = useState(initialLogs);
  if (previousData !== initialLogs) {
    setPreviousData(initialLogs);
    setLogs(initialLogs);
  }
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [selected, setSelected] = useState<AdminAuditEntry | null>(null);

  const filtered = useMemo(() => logs.filter((entry) => {
    const term = query.trim().toLowerCase();
    return !term || [entry.action, entry.actor.name, entry.actor.email, entry.targetType, entry.targetId].some((value) => value.toLowerCase().includes(term));
  }), [logs, query]);

  const refresh = async () => {
    setRefreshing(true);
    setRefreshError(false);
    try { setLogs(await getAdminAuditLogsData()); }
    catch { setRefreshError(true); }
    finally { setRefreshing(false); }
  };

  const exportCsv = () => {
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = [
      ['Timestamp', 'Actor', 'Email', 'Action', 'Target type', 'Target ID'],
      ...filtered.map((entry) => [entry.timestamp, entry.actor.name, entry.actor.email, entry.action, entry.targetType, entry.targetId]),
    ];
    const csv = rows.map((row) => row.map(quote).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'justicia-admin-audit.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return <div className="admin-page">
    <h1 className="sr-only">Audit log</h1>
    <div className="admin-toolbar">
      <div className="admin-search"><label htmlFor="audit-search" className="sr-only">Search recorded events</label><input id="audit-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actor, action, or target" className="admin-field w-full px-4 py-3" /></div>
      <div className="flex gap-2"><button type="button" onClick={refresh} disabled={refreshing} className="admin-control px-4 py-2.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#946525] disabled:opacity-60">{refreshing ? 'Refreshing…' : 'Refresh'}</button><button type="button" onClick={exportCsv} disabled={!filtered.length} className="admin-control admin-primary px-4 py-2.5 text-xs font-semibold text-[#23150F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#946525] disabled:opacity-60">Export CSV</button></div>
      <p className="w-full text-xs text-[#705C49]">Showing {filtered.length} of {logs.length} loaded records</p>
    </div>
    {refreshError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Could not refresh the audit log. The records below are from the previous load.</p>}
    <section className={`${cardClass} overflow-hidden`} aria-label="Recorded events">
      <div className="admin-table-well overflow-x-auto"><table className="admin-table w-full min-w-[700px] text-left text-sm"><thead className="text-xs text-[#5C4535]"><tr><th className="px-5 py-4 font-semibold">When</th><th className="px-5 py-4 font-semibold">Actor</th><th className="px-5 py-4 font-semibold">Action</th><th className="px-5 py-4 font-semibold">Target</th><th className="px-5 py-4 font-semibold"><span className="sr-only">Details</span></th></tr></thead><tbody>
        {filtered.map((entry) => <tr key={entry.id} className="hover:bg-[#F5EDE2]"><td className="whitespace-nowrap px-5 py-4 text-xs text-[#705C49]">{new Date(entry.timestamp).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</td><td className="px-5 py-4"><span className="block font-semibold">{entry.actor.name}</span><span className="text-xs text-[#7D6855]">{entry.actor.email}</span></td><td className="px-5 py-4 font-medium">{entry.action}</td><td className="px-5 py-4 text-xs text-[#705C49]">{entry.targetType}<span className="block max-w-40 truncate">{entry.targetId}</span></td><td className="px-5 py-4 text-right"><button type="button" onClick={() => setSelected(entry)} className="admin-control px-2 py-1 text-xs font-semibold text-[#946525] hover:text-[#6B4517] focus-visible:outline-2 focus-visible:outline-[#946525]">Details</button></td></tr>)}
        {!filtered.length && <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-[#7D6855]">{logs.length ? 'No events match your search.' : 'No audit events are available.'}</td></tr>}
      </tbody></table></div>
    </section>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><button type="button" aria-label="Close details" onClick={() => setSelected(null)} className="absolute inset-0 w-full bg-black/55" /><div role="dialog" aria-modal="true" aria-labelledby="audit-details-title" className={`${cardClass} relative z-10 w-full max-w-xl p-6 sm:p-8`}><div className="flex items-start justify-between gap-4"><div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E5D7C5] text-[#946525]"><DocumentTextIcon className="h-5 w-5" /></span><h2 id="audit-details-title" className="mt-3 font-lora text-lg font-semibold">{selected.action}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Close details" className="admin-control p-2 focus-visible:outline-2 focus-visible:outline-[#946525]">×</button></div><dl className="mt-5 grid gap-3 text-sm"><div><dt className="text-[#7D6855]">Actor</dt><dd className="font-medium">{selected.actor.name} ({selected.actor.email})</dd></div><div><dt className="text-[#7D6855]">Target</dt><dd className="break-all font-medium">{selected.targetType}: {selected.targetId}</dd></div><div><dt className="text-[#7D6855]">Recorded</dt><dd className="font-medium">{new Date(selected.timestamp).toLocaleString('en-PH')}</dd></div></dl><pre className="mt-5 max-h-64 overflow-auto rounded-xl bg-[#23150F] p-4 text-xs text-[#DED7CB]">{JSON.stringify(selected.details, null, 2)}</pre></div></div>}
  </div>;
}
