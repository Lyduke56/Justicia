import type { Metadata } from 'next';
import { AdminKnowledgeBaseView } from '@/components/admin/views/AdminKnowledgeBaseView';

export const metadata: Metadata = {
  title: 'Philippine Legal Knowledge Base | Justicia Admin',
  description: 'Status of planned legal source review and indexing tools.',
};

export default function KnowledgeBasePage() {
  return <AdminKnowledgeBaseView />;
}
