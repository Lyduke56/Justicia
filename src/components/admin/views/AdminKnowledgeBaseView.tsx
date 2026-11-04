import { AdminFeatureStatus } from '@/components/admin/AdminFeatureStatus';
import { BookOpenIcon } from '@/components/admin/AdminIcons';

export function AdminKnowledgeBaseView() {
  return <AdminFeatureStatus
    eyebrow="Administration"
    title="Legal knowledge base"
    description="Source review and indexing are not available in the admin portal yet."
    icon={<BookOpenIcon className="h-6 w-6" />}
    items={['Add and review legal sources with clear provenance.', 'Track source updates and superseded material.', 'Inspect indexing results before sources appear in assistant responses.']}
  />;
}
