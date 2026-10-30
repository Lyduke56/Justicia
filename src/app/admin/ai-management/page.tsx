import type { Metadata } from 'next';
import { AdminAIManagementView } from '@/components/admin/views/AdminAIManagementView';

export const metadata: Metadata = {
  title: 'AI Management & RAG Pipeline | Justicia Admin',
  description: 'Govern Google Gemini 3.8 Flash inference, RAG thresholds, system prompts, and lawyer escalation protocols.',
};

export default function AIManagementPage() {
  return <AdminAIManagementView />;
}
