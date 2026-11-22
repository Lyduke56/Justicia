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

const cardClass = 'admin-surface';
const linkClass = 'admin-control';

export function AdminDashboardView({ pendingLawyersCount, approvedLawyersCount, totalUsersCount, pendingLawyersPreview, recentAuditEntries }: Props) {
  const stats = [
    { label: 'Awaiting review', value: pendingLawyersCount, note: 'Lawyer applications', href: '/admin/lawyers/verification-queue', icon: ShieldCheckIcon },
    { label: 'Approved lawyers', value: approvedLawyersCount, note: 'Approved profiles', href: '/admin/lawyers', icon: ScaleIcon },
    { label: 'Registered users', value: totalUsersCount, note: 'Across all roles', href: '/admin/users', icon: UserGroupIcon },
  ];

  return <div className="admin-page">
    <h1 className="sr-only">Platform overview</h1>

    <div className="grid gap-5 sm:grid-cols-3">
      {stats.map(({ label, value, note, href, icon: Icon }) => <Link key={href} href={href} className={`admin-metric block p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#946525]`}>
        <div className="flex items-start justify-between gap-3"><span className="text-xs font-semibold text-[#705C49]">{label}</span><span className="flex h-9 w-9 items-center justify-center admin-icon-well rounded-xl"><Icon className="h-5 w-5" /></span></div>
        <div className="admin-plate mt-4 px-5 py-4"><p className="font-lora text-4xl font-semibold leading-none">{value}</p><p className="mt-2 text-xs text-[#5C4535]">{note}</p></div>
      </Link>)}
    </div>

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section className={`${cardClass} min-w-0 p-6`} aria-labelledby="pending-lawyers-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8CAAD] pb-4">
          <div><h2 id="pending-lawyers-heading" className="admin-section-label">Applications to review</h2></div>
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
          <div><h2 id="activity-heading" className="admin-section-label">Recent activity</h2></div>
          <Link href="/admin/settings/security-audit-log" className={linkClass}>View audit log →</Link>
        </div>
        {recentAuditEntries.length ? <ul className="divide-y divide-[#E8DCCB]">
          {recentAuditEntries.map((entry) => <li key={entry.id} className="flex items-start gap-3 py-4">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center admin-icon-well rounded-xl"><DocumentTextIcon className="h-4 w-4" /></span>
            <div className="min-w-0"><p className="break-words text-sm font-medium">{entry.action.replaceAll('_', ' ').replaceAll('.', ' ')}</p><p className="mt-1 text-xs text-[#7D6855]">{new Date(entry.timestamp).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</p></div>
          </li>)}
        </ul> : <p className="py-10 text-center text-sm text-[#7D6855]">No administrative activity has been recorded yet.</p>}
      </section>
    </div>
  </div>;
}
