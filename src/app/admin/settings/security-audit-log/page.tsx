import type { Metadata } from 'next';
import { getAdminAuditLogsData } from '@/app/actions/adminData';
import { AdminSecurityAuditView } from '@/components/admin/views/AdminSecurityAuditView';

export const metadata: Metadata = {
  title: 'Security & Audit Log | Justicia Admin',
  description: 'Cryptographic immutable trail of all sensitive platform actions and authorizations.',
};

export default async function SecurityAuditLogPage() {
  const logs = await getAdminAuditLogsData();
  return <AdminSecurityAuditView initialLogs={logs} />;
}
