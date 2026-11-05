import type { Metadata } from 'next';
import { AdminFeatureStatus } from '@/components/admin/AdminFeatureStatus';
import { DocumentTextIcon } from '@/components/admin/AdminIcons';

export const metadata: Metadata = { title: 'Reports | Justicia Admin' };

export default function AdminReportsPage() {
  return <AdminFeatureStatus eyebrow="Administration" title="Reports" description="Report review is not connected to the admin portal yet." icon={<DocumentTextIcon className="h-6 w-6" />} items={['List reports submitted by users.', 'Review the reported content and associated account.', 'Record a resolution and notify the reporter.']} />;
}
