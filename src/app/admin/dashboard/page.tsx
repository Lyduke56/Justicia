import type { Metadata } from 'next';
import { AdminDashboardView } from '@/components/admin/views/AdminDashboardView';

export const metadata: Metadata = {
  title: 'Platform Overview | Justicia Admin',
  description: 'Command center overview of lawyers, verification queues, and system intelligence.',
};

export default function AdminDashboardPage() {
  return <AdminDashboardView />;
}
