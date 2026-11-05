import type { Metadata } from 'next';
import { AdminFeatureStatus } from '@/components/admin/AdminFeatureStatus';
import { DocumentTextIcon } from '@/components/admin/AdminIcons';

export const metadata: Metadata = { title: 'Report details | Justicia Admin' };

export default function AdminReportDetailPage() {
  return <AdminFeatureStatus eyebrow="Administration" title="Report details" description="Individual report review is not available yet." icon={<DocumentTextIcon className="h-6 w-6" />} items={['Show the report, reporter, and target.', 'Record review decisions and notes.', 'Keep a history of resolution actions.']} />;
}
