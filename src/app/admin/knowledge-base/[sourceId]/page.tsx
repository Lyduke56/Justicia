import type { Metadata } from 'next';
import { AdminFeatureStatus } from '@/components/admin/AdminFeatureStatus';
import { BookOpenIcon } from '@/components/admin/AdminIcons';

export const metadata: Metadata = { title: 'Legal source | Justicia Admin' };

export default function AdminSourceDetailPage() {
  return <AdminFeatureStatus eyebrow="Administration" title="Legal source" description="Source details and review tools are not available in the admin portal yet." icon={<BookOpenIcon className="h-6 w-6" />} items={['Inspect source text and provenance.', 'Review current and superseded versions.', 'Manage indexing after source verification.']} />;
}
