import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getAdminReportsData } from '@/app/actions/reportActions';
import { AdminReportsView } from '@/components/admin/views/AdminReportsView';

export const metadata: Metadata = {
  title: 'Reports | Justicia Admin',
  description: 'Review reported clients and lawyers, their evidence, and decide on suspensions or terminations.',
};

export default async function AdminReportsPage() {
  await connection();
  const reports = await getAdminReportsData();
  return <AdminReportsView initialReports={reports} />;
}
