import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Security & Audit Log' };

/**
 * Security & Audit Log
 * Immutable record of all sensitive actions across the platform.
 * TODO: Fetch audit_log_entries, paginated, ordered by timestamp DESC
 * TODO: Filter by actor_id, actor_role, action, target_type, date range
 * TODO: Export as CSV for compliance
 * TODO: Real-time tail (new entries appear without page reload)
 * TODO: Highlight suspicious patterns (e.g. multiple failed logins, bulk deletes)
 */
export default function SecurityAuditLogPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Security & Audit Log</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(admin)/settings/security-audit-log/page.tsx</code>
        <br />TODO: Audit log table, filters (actor, action, target, date), CSV export, real-time tail
      </div>
    </main>
  );
}
