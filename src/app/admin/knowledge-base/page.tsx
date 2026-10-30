import type { Metadata } from 'next';
import { AdminKnowledgeBaseView } from '@/components/admin/views/AdminKnowledgeBaseView';

export const metadata: Metadata = {
  title: 'Philippine Legal Knowledge Base | Justicia Admin',
  description: 'Manage legal corpus, Supreme Court rulings, Republic Acts, and vector indexing.',
};

export default function KnowledgeBasePage() {
  return <AdminKnowledgeBaseView />;
}
