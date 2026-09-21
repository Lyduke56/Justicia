import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Report' };
interface Props { params: Promise<{ reportId: string }> }

/**
 * Report Detail
 * TODO: Full report details: reporter, target, reason, timestamps
 * TODO: Action buttons: dismiss, warn user, suspend user, remove content
 * TODO: Resolution notes field
 * TODO: Log action to audit_log_entries
 */
export default async function AdminReportDetailPage({ params }: Props) {
  const { reportId } = await params;
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Report</h1>
      <p className="text-xs text-muted-foreground font-mono">{reportId}</p>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(admin)/reports/[reportId]/page.tsx</code>
      </div>
    </main>
  );
}
