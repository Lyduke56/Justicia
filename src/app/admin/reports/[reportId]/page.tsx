import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getAdminReportsData } from '@/app/actions/reportActions';
import { AdminReportsView } from '@/components/admin/views/AdminReportsView';

export const metadata: Metadata = { title: 'Report details | Justicia Admin' };

export default async function AdminReportDetailPage({ params }: { params: Promise<{ reportId: string }> }) {
  await connection();
  const { reportId } = await params;
  const reports = await getAdminReportsData();
  return <AdminReportsView initialReports={reports} initialSelectedId={reportId} initialFilter="all" />;
}
