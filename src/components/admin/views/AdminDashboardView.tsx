import Link from 'next/link';
import { ShieldCheckIcon, ScaleIcon, UserGroupIcon, DocumentTextIcon } from '@/components/admin/AdminIcons';

type PendingLawyer = { user_id: string; full_name: string; roll_number: string; ibp_chapter: string | null };
type AuditEntry = { id: string; action: string; targetType?: string; timestamp: string };

type Props = {
  pendingLawyersCount: number;
  approvedLawyersCount: number;
  totalUsersCount: number;
  pendingLawyersPreview: PendingLawyer[];
  recentAuditEntries: AuditEntry[];
};

const cardClass = 'rounded-3xl border border-[#E8DCCB] bg-[#EFE5D8] shadow-[6px_6px_16px_rgba(0,0,0,0.06),-6px_-6px_16px_rgba(255,255,255,0.85)]';
const linkClass = 'rounded-lg text-xs font-semibold text-[#946525] hover:text-[#6B4517] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#946525]';

export function AdminDashboardView({ pendingLawyersCount, approvedLawyersCount, totalUsersCount, pendingLawyersPreview, recentAuditEntries }: Props) {
  const stats = [
    { label: 'Awaiting review', value: pendingLawyersCount, note: 'Lawyer applications', href: '/admin/lawyers/verification-queue', icon: ShieldCheckIcon },
    { label: 'Approved lawyers', value: approvedLawyersCount, note: 'Approved profiles', href: '/admin/lawyers', icon: ScaleIcon },
    { label: 'Registered users', value: totalUsersCount, note: 'All account roles', href: '/admin/users', icon: UserGroupIcon },
  ];

  return <div className="mx-auto max-w-7xl space-y-8 p-6 sm:p-10 lg:p-12">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#946525]">Administration</p>
        <h1 className="mt-1 font-cormorant text-4xl font-semibold leading-tight text-[#34150F] sm:text-5xl">Platform overview</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#705C49]">Review lawyer applications, manage accounts, and inspect recent administrative activity.</p>
      </div>
      <Link href="/admin/lawyers/verification-queue" className="inline-flex self-start items-center gap-2 rounded-2xl bg-[#C58B3C] px-5 py-3 text-xs font-semibold text-[#23150F] shadow-[3px_3px_8px_rgba(0,0,0,0.1)] hover:bg-[#B37B2F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#946525]">
        <ShieldCheckIcon className="h-4 w-4" /> Review applications
      </Link>
    </div>

    <div className="grid gap-5 sm:grid-cols-3">
      {stats.map(({ label, value, note, href, icon: Icon }) => <Link key={href} href={href} className={`${cardClass} block p-5 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#946525]`}>
        <div className="flex items-start justify-between gap-3"><span className="text-xs font-semibold text-[#705C49]">{label}</span><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E5D7C5] text-[#946525]"><Icon className="h-5 w-5" /></span></div>
        <p className="mt-3 font-cormorant text-4xl font-bold leading-none">{value}</p>
        <p className="mt-2 text-xs text-[#7D6855]">{note}</p>
      </Link>)}
    </div>

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section className={`${cardClass} min-w-0 p-6`} aria-labelledby="pending-lawyers-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8CAAD] pb-4">
          <div><h2 id="pending-lawyers-heading" className="font-cormorant text-2xl font-bold">Applications to review</h2><p className="mt-1 text-xs text-[#7D6855]">Most recent pending submissions</p></div>
          <Link href="/admin/lawyers/verification-queue" className={linkClass}>View queue →</Link>
        </div>
        {pendingLawyersPreview.length ? <ul className="divide-y divide-[#E8DCCB]">
          {pendingLawyersPreview.map((lawyer) => <li key={lawyer.user_id} className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{lawyer.full_name}</p><p className="mt-1 truncate text-xs text-[#7D6855]">Roll {lawyer.roll_number}{lawyer.ibp_chapter ? ` · ${lawyer.ibp_chapter}` : ''}</p></div>
            <Link href={`/admin/lawyers/${lawyer.user_id}`} className={linkClass}>Review</Link>
          </li>)}
        </ul> : <p className="py-10 text-center text-sm text-[#7D6855]">No applications are waiting for review.</p>}
      </section>

      <section className={`${cardClass} min-w-0 p-6`} aria-labelledby="activity-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8CAAD] pb-4">
          <div><h2 id="activity-heading" className="font-cormorant text-2xl font-bold">Recent activity</h2><p className="mt-1 text-xs text-[#7D6855]">Latest recorded admin actions</p></div>
          <Link href="/admin/settings/security-audit-log" className={linkClass}>View audit log →</Link>
        </div>
        {recentAuditEntries.length ? <ul className="divide-y divide-[#E8DCCB]">
          {recentAuditEntries.map((entry) => <li key={entry.id} className="flex items-start gap-3 py-4">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#E5D7C5] text-[#946525]"><DocumentTextIcon className="h-4 w-4" /></span>
            <div className="min-w-0"><p className="break-words text-sm font-medium">{entry.action.replaceAll('_', ' ').replaceAll('.', ' ')}</p><p className="mt-1 text-xs text-[#7D6855]">{new Date(entry.timestamp).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</p></div>
          </li>)}
        </ul> : <p className="py-10 text-center text-sm text-[#7D6855]">No administrative activity has been recorded yet.</p>}
      </section>
    </div>
  </div>;
}
