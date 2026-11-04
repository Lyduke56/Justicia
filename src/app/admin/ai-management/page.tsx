import type { Metadata } from 'next';
import { AdminAIManagementView } from '@/components/admin/views/AdminAIManagementView';

export const metadata: Metadata = {
  title: 'AI Management | Justicia Admin',
  description: 'Status of planned assistant management tools.',
};

export default function AIManagementPage() {
  return <AdminAIManagementView />;
}
