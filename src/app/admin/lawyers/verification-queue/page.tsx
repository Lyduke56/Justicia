import type { Metadata } from 'next';
import { AdminVerificationQueueView } from '@/components/admin/views/AdminVerificationQueueView';

export const metadata: Metadata = {
  title: 'Lawyer Verification Queue | Justicia Admin',
  description: 'Review and verify Philippine lawyer roll credentials and applications.',
};

export default function AdminVerificationQueuePage() {
  return <AdminVerificationQueueView />;
}
