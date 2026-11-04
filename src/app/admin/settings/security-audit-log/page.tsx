import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getAdminAuditLogsData } from '@/app/actions/adminData';
import { AdminSecurityAuditView } from '@/components/admin/views/AdminSecurityAuditView';

export const metadata: Metadata = {
  title: 'Security & Audit Log | Justicia Admin',
  description: 'Recent administrative actions recorded by the platform.',
};

export default async function SecurityAuditLogPage() {
  await connection();
  const logs = await getAdminAuditLogsData();
  return <AdminSecurityAuditView initialLogs={logs} />;
}
